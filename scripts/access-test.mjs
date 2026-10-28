// Live access-control checks (B008). Creates a temporary world, campaigns and
// accounts, signs in as each through the public API (exactly as a browser or a
// direct API request would), checks what they can see and change, then deletes
// everything it created. Real campaign data is never modified.
//
//   node scripts/access-test.mjs

import { createClient } from '@supabase/supabase-js'
import { randomBytes } from 'node:crypto'
import { usernameToLoginEmail } from '../src/config/auth.ts'
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from '../src/config/supabase.ts'

process.loadEnvFile(new URL('./.env.local', import.meta.url))
const noPersist = { auth: { persistSession: false, autoRefreshToken: false } }
const admin = createClient(SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, noPersist)

let failures = 0
const check = (name, passed, detail = '') => {
  if (!passed) failures++
  console.log(`${passed ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`)
}
const must = ({ data, error }, what) => {
  if (error) throw new Error(`${what}: ${error.message}`)
  return data
}

const tag = randomBytes(2).toString('hex')
const roles = ['owner', 'dm', 'both', 'only_b', 'outsider']
const users = {} // role -> { id, password, client }
let worldId

try {
  // ---- Temporary setup (secret key) ----
  for (const role of roles) {
    const username = `zz_${role}_${tag}`
    const password = randomBytes(18).toString('base64url')
    const user = must(await admin.auth.admin.createUser({
      email: usernameToLoginEmail(username), password, email_confirm: true, user_metadata: { username },
    }), `create ${role}`).user
    users[role] = { id: user.id, username, password }
  }
  worldId = must(await admin.from('worlds').insert({ name: `zz World ${tag}`, owner_id: users.owner.id }).select('id').single(), 'world').id
  const campaigns = must(await admin.from('campaigns').insert([
    { world_id: worldId, name: `zz A ${tag}` }, { world_id: worldId, name: `zz B ${tag}` },
  ]).select('id, name'), 'campaigns')
  const A = campaigns.find((c) => c.name.startsWith('zz A')).id
  const B = campaigns.find((c) => c.name.startsWith('zz B')).id
  must(await admin.from('campaign_members').insert([
    { campaign_id: A, user_id: users.dm.id, role: 'dm' },
    { campaign_id: A, user_id: users.both.id, role: 'player' },
    { campaign_id: B, user_id: users.both.id, role: 'player' },
    { campaign_id: B, user_id: users.only_b.id, role: 'player' },
  ]), 'memberships')
  const realWorlds = must(await admin.from('worlds').select('id').neq('id', worldId), 'real worlds').map((w) => w.id)
  const realCampaign = must(await admin.from('campaigns').select('id').neq('world_id', worldId).limit(1), 'real campaign')[0]?.id

  for (const role of roles) {
    const client = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, noPersist)
    must(await client.auth.signInWithPassword({ email: usernameToLoginEmail(users[role].username), password: users[role].password }), `sign in ${role}`)
    users[role].client = client
  }
  const db = (role) => users[role].client
  const ids = async (role, table, column = 'id') => (await db(role).from(table).select(column)).data?.map((r) => r[column]) ?? []
  const sameSet = (a, b) => a.length === b.length && a.every((x) => b.includes(x))
  const changed = (res) => !res.error && (res.data?.length ?? 0) > 0 // with .select(): rows actually affected

  // ---- Owner ----
  check('Owner sees their world', sameSet(await ids('owner', 'worlds'), [worldId]))
  check('Owner sees all campaigns in their world', sameSet(await ids('owner', 'campaigns'), [A, B]))
  check('Owner sees all memberships in their world', (await ids('owner', 'campaign_members', 'user_id')).length === 4)
  check('Owner can rename their world', changed(await db('owner').from('worlds').update({ name: `zz World ${tag}!` }).eq('id', worldId).select()))
  check('Owner cannot give the world away', !!(await db('owner').from('worlds').update({ owner_id: users.dm.id }).eq('id', worldId)).error)
  const created = await db('owner').from('campaigns').insert({ world_id: worldId, name: `zz C ${tag}` }).select('id').single()
  check('Owner can create a campaign in their world', !!created.data, created.error?.message)
  check('Owner can add a member', !(await db('owner').from('campaign_members').insert({ campaign_id: B, user_id: users.dm.id })).error)
  check('Owner cannot delete a campaign', !!(await db('owner').from('campaigns').delete().eq('id', A)).error)
  if (realWorlds[0]) check('Owner cannot create campaigns in someone else\'s world',
    !!(await db('owner').from('campaigns').insert({ world_id: realWorlds[0], name: 'zz sneaky' })).error)

  // The Owner added the DM to B above; take them out again before the DM checks.
  must(await admin.from('campaign_members').delete().eq('campaign_id', B).eq('user_id', users.dm.id), 'reset')

  // ---- DM ----
  check('DM sees only their campaign', sameSet(await ids('dm', 'campaigns'), [A]))
  check('DM can rename their campaign', changed(await db('dm').from('campaigns').update({ name: `zz A ${tag}!` }).eq('id', A).select()))
  check('DM cannot rename the world', !changed(await db('dm').from('worlds').update({ name: 'hacked' }).eq('id', worldId).select()))
  check('DM can add a member to their campaign', !(await db('dm').from('campaign_members').insert({ campaign_id: A, user_id: users.only_b.id })).error)
  check('DM can change a member\'s role', changed(await db('dm').from('campaign_members').update({ role: 'dm' }).eq('campaign_id', A).eq('user_id', users.only_b.id).select()))
  check('DM can remove a member', changed(await db('dm').from('campaign_members').delete().eq('campaign_id', A).eq('user_id', users.only_b.id).select()))
  check('DM cannot add members to another campaign', !!(await db('dm').from('campaign_members').insert({ campaign_id: B, user_id: users.outsider.id })).error)
  check('DM cannot move the campaign to another world', !!(await db('dm').from('campaigns').update({ world_id: realWorlds[0] ?? worldId }).eq('id', A)).error)

  // ---- Players ----
  check('Player in two campaigns sees both', sameSet(await ids('both', 'campaigns'), [A, B]))
  check('Player sees the campaigns\' world', sameSet(await ids('both', 'worlds'), [worldId]))
  check('Player in campaign B only cannot see campaign A', sameSet(await ids('only_b', 'campaigns'), [B]))
  check('Player sees only members of their own campaigns', (await db('only_b').from('campaign_members').select('campaign_id')).data?.every((m) => m.campaign_id === B))
  check('Player sees only fellow members\' profiles',
    sameSet(await ids('only_b', 'profiles'), [users.only_b.id, users.both.id]))
  check('Player cannot make themselves DM', !changed(await db('both').from('campaign_members').update({ role: 'dm' }).eq('user_id', users.both.id).select()))
  check('Player cannot join another campaign', !!(await db('only_b').from('campaign_members').insert({ campaign_id: A, user_id: users.only_b.id, role: 'dm' })).error)
  check('Player cannot remove members', !changed(await db('both').from('campaign_members').delete().eq('campaign_id', A).select()))
  check('Player cannot rename a campaign', !changed(await db('both').from('campaigns').update({ name: 'mine' }).eq('id', A).select()))
  check('Player can change their own display name', changed(await db('both').from('profiles').update({ display_name: 'Hero' }).eq('id', users.both.id).select()))
  check('Player cannot change their username', !!(await db('both').from('profiles').update({ username: 'admin' }).eq('id', users.both.id)).error)
  check('Player cannot edit someone else\'s profile', !changed(await db('both').from('profiles').update({ display_name: 'x' }).eq('id', users.dm.id).select()))
  check('Player cannot create worlds', !!(await db('both').from('worlds').insert({ name: 'zz mine', owner_id: users.both.id })).error)

  // ---- Outsider and isolation from real data ----
  check('Signed-in user with no campaigns sees nothing but their own profile',
    (await ids('outsider', 'worlds')).length === 0 && (await ids('outsider', 'campaigns')).length === 0 &&
    sameSet(await ids('outsider', 'profiles'), [users.outsider.id]))
  for (const role of roles) {
    const seen = [...await ids(role, 'worlds'), ...await ids(role, 'campaigns')]
    check(`${role}: none of the real campaign data is visible`, !realWorlds.some((w) => seen.includes(w)) && !seen.includes(realCampaign))
  }

  // ---- Signed out and direct API requests ----
  const anon = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, noPersist)
  for (const table of ['profiles', 'worlds', 'campaigns', 'campaign_members']) {
    const res = await anon.from(table).select('*')
    check(`Signed out: ${table} is denied`, !!res.error || res.data.length === 0, res.error?.message)
  }
  check('Signed out: cannot insert', !!(await anon.from('worlds').insert({ name: 'x', owner_id: users.outsider.id })).error)
  const raw = await fetch(`${SUPABASE_URL}/rest/v1/campaign_members?select=*`, { headers: { apikey: SUPABASE_PUBLISHABLE_KEY } })
  check('Direct HTTP request without a login is refused', raw.status === 401 || raw.status === 403 || (await raw.json()).length === 0, `HTTP ${raw.status}`)
  const token = (await db('only_b').auth.getSession()).data.session.access_token
  const direct = await fetch(`${SUPABASE_URL}/rest/v1/campaigns?select=id&id=eq.${A}`, {
    headers: { apikey: SUPABASE_PUBLISHABLE_KEY, Authorization: `Bearer ${token}` },
  })
  check('Direct HTTP request for a campaign you are not in returns nothing', direct.ok && (await direct.json()).length === 0)
  const rpc = await fetch(`${SUPABASE_URL}/rest/v1/rpc/can_manage_campaign`, {
    method: 'POST', headers: { apikey: SUPABASE_PUBLISHABLE_KEY, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ target_campaign: A }),
  })
  check('Helper checks cannot be called through the API', !rpc.ok, `HTTP ${rpc.status}`)
  const trigger = await fetch(`${SUPABASE_URL}/rest/v1/rpc/handle_new_user`, {
    method: 'POST', headers: { apikey: SUPABASE_PUBLISHABLE_KEY, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: '{}',
  })
  check('Profile trigger function cannot be called through the API', !trigger.ok, `HTTP ${trigger.status}`)
} finally {
  // ---- Clean up everything created above ----
  if (worldId) must(await admin.from('worlds').delete().eq('id', worldId), 'delete world') // campaigns + memberships cascade
  for (const role of roles) if (users[role]) await admin.auth.admin.deleteUser(users[role].id)
  const leftovers = must(await admin.from('profiles').select('username').like('username', `zz\\_%\\_${tag}`), 'leftovers')
  const leftoverWorlds = must(await admin.from('worlds').select('id').like('name', `zz World ${tag}%`), 'leftover worlds')
  check('All temporary accounts, campaigns and memberships deleted', leftovers.length === 0 && leftoverWorlds.length === 0)
}

console.log(failures ? `\n${failures} check(s) failed.` : '\nAll access checks passed.')
process.exit(failures ? 1 : 0)
