// Live Codex access checks (B011). Creates a temporary world, two campaigns and
// accounts, adds Codex entries through the public API as the people who would
// really add them, checks who can see and change what, then deletes everything.
//
//   node scripts/codex-test.mjs

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
const roles = ['owner', 'dm_a', 'dm_b', 'p_a', 'p_b', 'p_ab', 'outsider']
const users = {}
let worldId

try {
  for (const role of roles) {
    const username = `zz_${role}_${tag}`
    const password = randomBytes(18).toString('base64url')
    const user = must(await admin.auth.admin.createUser({
      email: usernameToLoginEmail(username), password, email_confirm: true, user_metadata: { username },
    }), `create ${role}`).user
    const client = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, noPersist)
    must(await client.auth.signInWithPassword({ email: usernameToLoginEmail(username), password }), `sign in ${role}`)
    users[role] = { id: user.id, client }
  }
  const db = (role) => users[role].client
  worldId = must(await admin.from('worlds').insert({ name: `zz World ${tag}`, owner_id: users.owner.id }).select('id').single(), 'world').id
  const [A, B] = must(await admin.from('campaigns').insert([
    { world_id: worldId, name: `zz A ${tag}` }, { world_id: worldId, name: `zz B ${tag}` },
  ]).select('id, name').order('name'), 'campaigns').map((c) => c.id)
  must(await admin.from('campaign_members').insert([
    { campaign_id: A, user_id: users.dm_a.id, role: 'dm' }, { campaign_id: B, user_id: users.dm_b.id, role: 'dm' },
    { campaign_id: A, user_id: users.p_a.id, role: 'player' }, { campaign_id: B, user_id: users.p_b.id, role: 'player' },
    { campaign_id: A, user_id: users.p_ab.id, role: 'player' }, { campaign_id: B, user_id: users.p_ab.id, role: 'player' },
  ]), 'memberships')

  // ---- Entries added through the public API by the people who'd add them ----
  const add = async (role, campaignId, category, name, visibility) => {
    const res = await db(role).from('codex_entries')
      .insert({ world_id: worldId, campaign_id: campaignId, category, name, visibility, tags: ['zz-test'] })
      .select('id, created_by').single()
    if (res.error) throw new Error(`${role} adding ${name}: ${res.error.message}`)
    return res.data
  }
  const e = {
    w_pub: await add('owner', null, 'location', 'w_pub', 'players'),
    w_draft: await add('owner', null, 'lore', 'w_draft', 'draft'),
    w_secret: await add('owner', null, 'npc', 'w_secret', 'dm'),
    a_pub: await add('dm_a', A, 'npc', 'a_pub', 'players'),
    a_draft: await add('dm_a', A, 'item', 'a_draft', 'draft'),
    a_secret: await add('dm_a', A, 'faction', 'a_secret', 'dm'),
    b_pub: await add('dm_b', B, 'location', 'b_pub', 'players'),
  }
  check('Owner adds world entries and DMs add campaign entries through the API', true)
  check('Creator is recorded automatically', e.a_pub.created_by === users.dm_a.id)
  check('DM B records that their party discovered the world secret',
    !(await db('dm_b').from('codex_reveals').insert({ entry_id: e.w_secret.id, campaign_id: B, world_id: worldId })).error)
  check('Owner links the secret NPC to a public location',
    !(await db('owner').from('codex_links').insert({ world_id: worldId, from_entry_id: e.w_secret.id, to_entry_id: e.w_pub.id, relation: 'lives in', visibility: 'players' })).error)
  check('DM A links a campaign NPC to the location',
    !(await db('dm_a').from('codex_links').insert({ world_id: worldId, campaign_id: A, from_entry_id: e.a_pub.id, to_entry_id: e.w_pub.id, relation: 'drinks at', visibility: 'players' })).error)

  // ---- Who sees what ----
  const sees = async (role) => ((await db(role).from('codex_entries').select('name')).data ?? []).map((r) => r.name).sort().join(',')
  const expected = {
    owner: ['a_draft,a_pub,a_secret,b_pub,w_draft,w_pub,w_secret', 'everything in their world, including drafts'],
    dm_a: ['a_draft,a_pub,a_secret,w_pub,w_secret', 'own campaign + published world lore and DM secrets; no world drafts, nothing of B'],
    dm_b: ['b_pub,w_pub,w_secret', 'own campaign + world lore; nothing of A'],
    p_a: ['a_pub,w_pub', 'published world lore + own campaign; no drafts, secrets or B'],
    p_b: ['b_pub,w_pub,w_secret', 'published world lore + own campaign + the secret their party discovered'],
    p_ab: ['a_pub,b_pub,w_pub,w_secret', 'both campaigns combined'],
    outsider: ['', 'nothing'],
  }
  for (const [role, [want, why]] of Object.entries(expected)) {
    const got = await sees(role)
    check(`${role}: ${why}`, got === want, got === want ? '' : `got ${got || 'none'}`)
  }
  const links = async (role) => ((await db(role).from('codex_links').select('relation')).data ?? []).map((r) => r.relation).sort().join(',')
  check('Player A sees only links whose both ends they can see', await links('p_a') === 'drinks at', await links('p_a'))
  check('Player B sees the discovered NPC\'s link, not campaign A\'s', await links('p_b') === 'lives in', await links('p_b'))

  // ---- What people can't do ----
  const tryAdd = (role, campaignId) => db(role).from('codex_entries').insert({ world_id: worldId, campaign_id: campaignId, category: 'lore', name: 'zz x' })
  check('Players cannot add entries', !!(await tryAdd('p_a', A)).error)
  check('DMs cannot add world-level entries', !!(await tryAdd('dm_a', null)).error)
  check('DMs cannot add entries to another campaign', !!(await tryAdd('dm_a', B)).error)
  check('Players cannot edit entries', ((await db('p_a').from('codex_entries').update({ name: 'hacked' }).eq('id', e.a_pub.id).select()).data ?? []).length === 0)
  check('Players cannot publish drafts', ((await db('p_a').from('codex_entries').update({ visibility: 'players' }).eq('id', e.a_draft.id).select()).data ?? []).length === 0)
  check('DMs cannot edit world entries', ((await db('dm_a').from('codex_entries').update({ name: 'hacked' }).eq('id', e.w_pub.id).select()).data ?? []).length === 0)
  check('Entries cannot be moved to another campaign', !!(await db('owner').from('codex_entries').update({ campaign_id: B }).eq('id', e.a_pub.id)).error)
  check('Players cannot reveal secrets to themselves', !!(await db('p_a').from('codex_reveals').insert({ entry_id: e.w_secret.id, campaign_id: A, world_id: worldId })).error)
  check('Players cannot delete entries', ((await db('p_a').from('codex_entries').delete().eq('id', e.a_pub.id).select()).data ?? []).length === 0)
  check('DM A can publish their campaign draft', ((await db('dm_a').from('codex_entries').update({ visibility: 'players' }).eq('id', e.a_draft.id).select()).data ?? []).length === 1)
  check('...and player A then sees it', (await sees('p_a')).includes('a_draft'))

  // ---- Signed out and direct requests ----
  const anon = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, noPersist)
  for (const table of ['codex_entries', 'codex_links', 'codex_reveals']) {
    const res = await anon.from(table).select('*')
    check(`Signed out: ${table} is denied`, !!res.error, res.error?.message)
  }
  const token = (await db('p_a').auth.getSession()).data.session.access_token
  const direct = await fetch(`${SUPABASE_URL}/rest/v1/codex_entries?select=name&id=eq.${e.w_secret.id}`, {
    headers: { apikey: SUPABASE_PUBLISHABLE_KEY, Authorization: `Bearer ${token}` },
  })
  check('Direct HTTP request for a hidden secret returns nothing', direct.ok && (await direct.json()).length === 0)
  const rpc = await fetch(`${SUPABASE_URL}/rest/v1/rpc/codex_visible`, {
    method: 'POST', headers: { apikey: SUPABASE_PUBLISHABLE_KEY, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: '{}',
  })
  check('Codex helper checks cannot be called through the API', !rpc.ok, `HTTP ${rpc.status}`)
} finally {
  if (worldId) must(await admin.from('worlds').delete().eq('id', worldId), 'delete world') // campaigns, members and Codex cascade
  for (const role of roles) if (users[role]) await admin.auth.admin.deleteUser(users[role].id)
  const left = must(await admin.from('codex_entries').select('id').contains('tags', ['zz-test']), 'leftover entries')
  const leftUsers = must(await admin.from('profiles').select('id').like('username', `zz\\_%\\_${tag}`), 'leftover users')
  check('All temporary accounts, campaigns and Codex entries deleted', left.length === 0 && leftUsers.length === 0)
}

console.log(failures ? `\n${failures} check(s) failed.` : '\nAll Codex checks passed.')
process.exit(failures ? 1 : 0)
