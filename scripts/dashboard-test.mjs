// Live Dashboard checks (B010). Creates a temporary world, two campaigns,
// accounts and Codex entries, then runs the same queries and campaign filter as
// the Dashboard for each person and campaign, and deletes everything again.
//
//   node scripts/dashboard-test.mjs

import { createClient } from '@supabase/supabase-js'
import { randomBytes } from 'node:crypto'
import { usernameToLoginEmail } from '../src/config/auth.ts'
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from '../src/config/supabase.ts'
import { codexStats, entriesForCampaign } from '../src/features/dashboard/campaignView.ts'

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
// dm_a runs campaign A and also plays in campaign B.
const roles = ['owner', 'dm_a', 'p_a', 'p_ab', 'outsider']
const users = {}
let worldId

// The Dashboard's queries, as in src/features/dashboard/useDashboard.ts.
async function dashboard(role, campaignId) {
  const db = users[role].client
  const userId = users[role].id
  const worlds = must(await db.from('worlds').select('id, name, owner_id'), 'worlds')
  const campaigns = must(await db.from('campaigns').select('id, name, world_id'), 'campaigns')
  const mine = must(await db.from('campaign_members').select('campaign_id, role').eq('user_id', userId), 'memberships')
  const list = campaigns
    .map((c) => ({ ...c, role: worlds.find((w) => w.id === c.world_id)?.owner_id === userId ? 'owner' : mine.find((m) => m.campaign_id === c.id)?.role }))
    .filter((c) => c.role)
  const campaign = list.find((c) => c.id === campaignId)
  if (!campaign) return { list, campaign: null }
  let query = db.from('codex_entries').select('id, world_id, campaign_id, category, name, summary, visibility, created_at, updated_at')
    .eq('world_id', campaign.world_id).or(`campaign_id.is.null,campaign_id.eq.${campaign.id}`).order('updated_at', { ascending: false })
  if (campaign.role === 'player') query = query.in('visibility', ['players', 'dm'])
  const entries = must(await query, 'entries')
  const reveals = must(await db.from('codex_reveals').select('entry_id').eq('campaign_id', campaign.id), 'reveals')
  const members = must(await db.from('campaign_members').select('user_id, role').eq('campaign_id', campaign.id), 'members')
  const shown = entriesForCampaign(entries, campaign, campaign.role, new Set(reveals.map((r) => r.entry_id)))
  return { list, campaign, names: shown.map((e) => e.name).sort().join(','), stats: codexStats(shown), members }
}

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
  worldId = must(await admin.from('worlds').insert({ name: `zz World ${tag}`, owner_id: users.owner.id }).select('id').single(), 'world').id
  const [A, B] = must(await admin.from('campaigns').insert([
    { world_id: worldId, name: `zz A ${tag}` }, { world_id: worldId, name: `zz B ${tag}` },
  ]).select('id, name').order('name'), 'campaigns').map((c) => c.id)
  must(await admin.from('campaign_members').insert([
    { campaign_id: A, user_id: users.dm_a.id, role: 'dm' }, { campaign_id: B, user_id: users.dm_a.id, role: 'player' },
    { campaign_id: A, user_id: users.p_a.id, role: 'player' },
    { campaign_id: A, user_id: users.p_ab.id, role: 'player' }, { campaign_id: B, user_id: users.p_ab.id, role: 'player' },
  ]), 'memberships')

  const add = async (name, category, visibility, campaignId = null) =>
    must(await admin.from('codex_entries').insert({ world_id: worldId, campaign_id: campaignId, name, category, visibility, tags: ['zz-test'] }).select('id').single(), name).id
  const e = {
    w_pub: await add('w_pub', 'npc', 'players'),
    w_draft: await add('w_draft', 'location', 'draft'),
    w_secret: await add('w_secret', 'faction', 'dm'),
    w_rev_a: await add('w_rev_a', 'npc', 'dm'),
    w_rev_b: await add('w_rev_b', 'location', 'dm'),
    a_pub: await add('a_pub', 'location', 'players', A),
    a_draft: await add('a_draft', 'npc', 'draft', A),
    a_secret: await add('a_secret', 'faction', 'dm', A),
    b_pub: await add('b_pub', 'npc', 'players', B),
    b_secret: await add('b_secret', 'item', 'dm', B),
  }
  must(await admin.from('codex_reveals').insert([
    { entry_id: e.w_rev_a, campaign_id: A, world_id: worldId }, { entry_id: e.w_rev_b, campaign_id: B, world_id: worldId },
  ]), 'reveals')
  must(await admin.from('codex_notes').insert({ entry_id: e.w_pub, world_id: worldId, campaign_id: A, body: '<p>zz secret note</p>' }), 'note')

  // ---- Campaigns each person can pick ----
  const listOf = async (role) => (await dashboard(role, null)).list.map((c) => `${c.id === A ? 'A' : 'B'}:${c.role}`).sort().join(',')
  check('Owner can pick both campaigns as Owner', await listOf('owner') === 'A:owner,B:owner', await listOf('owner'))
  check('DM A picks A as DM and B as a player', await listOf('dm_a') === 'A:dm,B:player', await listOf('dm_a'))
  check('Player A can only pick campaign A', await listOf('p_a') === 'A:player', await listOf('p_a'))
  check('Player in both campaigns can pick both', await listOf('p_ab') === 'A:player,B:player', await listOf('p_ab'))
  check('Someone in no campaign gets the "no campaign" state', await listOf('outsider') === '', await listOf('outsider') || 'none')

  // ---- What each campaign's dashboard shows ----
  const expected = [
    ['owner', A, 'a_draft,a_pub,a_secret,w_draft,w_pub,w_rev_a,w_rev_b,w_secret', 'Owner on A: everything in A and the world, nothing of B'],
    ['owner', B, 'b_pub,b_secret,w_draft,w_pub,w_rev_a,w_rev_b,w_secret', 'Owner on B: everything in B and the world, nothing of A'],
    ['dm_a', A, 'a_draft,a_pub,a_secret,w_pub,w_rev_a,w_rev_b,w_secret', 'DM on A: A\'s drafts and secrets, world secrets; no world drafts'],
    ['dm_a', B, 'b_pub,w_pub,w_rev_b', 'Same person as a player on B: only what B\'s party may see'],
    ['p_a', A, 'a_pub,w_pub,w_rev_a', 'Player A: published articles + A\'s discovery'],
    ['p_ab', A, 'a_pub,w_pub,w_rev_a', 'Player in both, viewing A: no B articles or B discoveries'],
    ['p_ab', B, 'b_pub,w_pub,w_rev_b', 'Player in both, viewing B: no A articles or A discoveries'],
  ]
  for (const [role, campaignId, want, why] of expected) {
    const got = (await dashboard(role, campaignId)).names
    check(why, got === want, got === want ? '' : `got ${got}`)
  }
  const ownerA = (await dashboard('owner', A)).stats
  check('Owner\'s statistics count drafts and DM-only articles', ownerA.total === 8 && ownerA.drafts === 2 && ownerA.secrets === 4, JSON.stringify(ownerA))
  const playerA = (await dashboard('p_ab', A)).stats
  check('Player statistics only count what they can read', playerA.total === 3 && playerA.drafts === 0 && playerA.byCategory.npc === 2 && playerA.byCategory.location === 1,
    JSON.stringify(playerA))
  check('A player is not shown campaign B even if they ask for it', (await dashboard('p_a', B)).campaign === null)
  const party = (await dashboard('p_a', A)).members.map((m) => m.role).sort().join(',')
  check('Player A sees campaign A\'s party (1 DM, 2 players)', party === 'dm,player,player', party)

  // ---- The database itself refuses, whatever the website asks for ----
  const token = (await users.p_a.client.auth.getSession()).data.session.access_token
  const get = async (path) => {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { headers: { apikey: SUPABASE_PUBLISHABLE_KEY, Authorization: `Bearer ${token}` } })
    return res.ok ? (await res.json()).length : `HTTP ${res.status}`
  }
  check('Direct request: player A gets no campaign B articles', await get(`codex_entries?select=name&campaign_id=eq.${B}`) === 0)
  check('Direct request: player A gets no drafts or undiscovered secrets', await get(`codex_entries?select=name&visibility=in.(draft,dm)&id=neq.${e.w_rev_a}`) === 0)
  check('Direct request: player A gets no campaign B members or discoveries',
    await get(`campaign_members?select=user_id&campaign_id=eq.${B}`) === 0 && await get(`codex_reveals?select=entry_id&campaign_id=eq.${B}`) === 0)
  check('Direct request: player A reads no DM notes', await get('codex_notes?select=body') === 0)
} finally {
  if (worldId) must(await admin.from('worlds').delete().eq('id', worldId), 'delete world') // campaigns, members and Codex cascade
  for (const role of roles) if (users[role]) await admin.auth.admin.deleteUser(users[role].id)
  const left = must(await admin.from('codex_entries').select('id').contains('tags', ['zz-test']), 'leftover entries')
  const leftUsers = must(await admin.from('profiles').select('id').like('username', `zz\\_%\\_${tag}`), 'leftover users')
  check('All temporary accounts, campaigns and Codex entries deleted', left.length === 0 && leftUsers.length === 0)
}

console.log(failures ? `\n${failures} check(s) failed.` : '\nAll Dashboard checks passed.')
process.exit(failures ? 1 : 0)
