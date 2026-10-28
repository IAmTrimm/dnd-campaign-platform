// Live Codex access checks (B011, private DM notes from B013 and relationships from B014). Creates a temporary world, two campaigns and
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

  // ---- Private DM notes (B013) ----
  const addNote = (role, entry, campaignId, body) =>
    db(role).from('codex_notes').insert({ entry_id: entry.id, world_id: worldId, campaign_id: campaignId, body })
  check('Owner writes an Owner-only note', !(await addNote('owner', e.w_pub, null, '<p>owner note</p>')).error)
  check('Owner writes a note on the discovered world secret', !(await addNote('owner', e.w_secret, null, '<p>tower note</p>')).error)
  check('DM A writes a campaign A note on shared world lore', !(await addNote('dm_a', e.w_pub, A, '<p>A note</p>')).error)
  check('DM B writes a campaign B note on the same article', !(await addNote('dm_b', e.w_pub, B, '<p>B note</p>')).error)
  check('DM A writes a note on their campaign secret', !(await addNote('dm_a', e.a_secret, A, '<p>A secret note</p>')).error)
  const notes = async (role) => ((await db(role).from('codex_notes').select('body')).data ?? []).map((n) => n.body.replace(/<\/?p>/g, '')).sort().join(',')
  check('Owner reads every note in their world', await notes('owner') === 'A note,A secret note,B note,owner note,tower note', await notes('owner'))
  check('DM A reads only campaign A notes', await notes('dm_a') === 'A note,A secret note', await notes('dm_a'))
  check('DM B reads only campaign B notes', await notes('dm_b') === 'B note', await notes('dm_b'))
  for (const role of ['p_a', 'p_b', 'p_ab', 'outsider']) check(`${role} reads no notes`, await notes(role) === '', await notes(role) || 'none')
  check('DM cannot write the Owner-only note', !!(await addNote('dm_a', e.w_secret, null, 'x')).error)
  check('DM cannot write another campaign\'s note', !!(await addNote('dm_a', e.w_pub, B, 'x')).error)
  check('Players cannot write notes', !!(await addNote('p_a', e.a_pub, A, 'x')).error)
  check('Players cannot change notes', ((await db('p_a').from('codex_notes').update({ body: 'hacked' }).eq('entry_id', e.w_pub.id).select()).data ?? []).length === 0)
  must(await db('dm_a').from('codex_entries').update({ visibility: 'players' }).eq('id', e.a_secret.id), 'publish a_secret')
  check('Publishing an article shows players the article but not its notes',
    (await sees('p_a')).includes('a_secret') && await notes('p_a') === '')
  check('Campaign B discovered the world secret, but its player sees no notes',
    (await sees('p_b')).includes('w_secret') && await notes('p_b') === '')
  const playerToken = (await db('p_ab').auth.getSession()).data.session.access_token
  const directNotes = await fetch(`${SUPABASE_URL}/rest/v1/codex_notes?select=body`, {
    headers: { apikey: SUPABASE_PUBLISHABLE_KEY, Authorization: `Bearer ${playerToken}` },
  })
  check('Direct HTTP request for notes as a player returns nothing', directNotes.ok && (await directNotes.json()).length === 0)
  const anonNotes = await fetch(`${SUPABASE_URL}/rest/v1/codex_notes?select=body`, { headers: { apikey: SUPABASE_PUBLISHABLE_KEY } })
  check('Direct HTTP request for notes while signed out is refused', !anonNotes.ok, `HTTP ${anonNotes.status}`)

  // ---- Relationships between articles (B014) ----
  Object.assign(e, {
    w_guild: await add('owner', null, 'faction', 'w_guild', 'players'),
    w_sword: await add('owner', null, 'item', 'w_sword', 'players'),
    a_inn: await add('dm_a', A, 'location', 'a_inn', 'players'),
    b_npc: await add('dm_b', B, 'npc', 'b_npc', 'players'),
  })
  const link = (role, campaignId, from, to, relation, visibility) =>
    db(role).from('codex_links').insert({ world_id: worldId, campaign_id: campaignId, from_entry_id: from.id, to_entry_id: to.id, relation, visibility }).select('id').single()
  const made = {}
  for (const [key, role, campaignId, from, to, relation, visibility] of [
    ['located', 'owner', null, e.w_guild, e.w_pub, 'located in', 'players'],
    ['stolen', 'owner', null, e.w_sword, e.w_guild, 'stolen from', 'dm'],
    ['founded', 'owner', null, e.w_guild, e.w_draft, 'founded in', 'players'],
    ['member', 'dm_a', A, e.a_pub, e.w_guild, 'member of', 'players'],
    ['owns', 'dm_a', A, e.a_pub, e.w_sword, 'owns', 'players'],
    ['secretly', 'dm_a', A, e.a_pub, e.a_inn, 'secretly owns', 'dm'],
    ['spy', 'dm_b', B, e.b_npc, e.w_guild, 'spy in', 'players'],
  ]) {
    const res = await link(role, campaignId, from, to, relation, visibility)
    check(`${role} links ${from.id === e.a_pub.id ? 'a_pub' : relation} (${relation}, ${visibility})`, !res.error, res.error?.message)
    made[key] = res.data?.id
  }
  const newRelations = ['located in', 'stolen from', 'founded in', 'member of', 'owns', 'secretly owns', 'spy in']
  const rels = async (role) =>
    ((await db(role).from('codex_links').select('relation').in('relation', newRelations)).data ?? []).map((r) => r.relation).sort().join(',')
  const expectedLinks = {
    owner: ['founded in,located in,member of,owns,secretly owns,spy in,stolen from', 'every relationship in their world'],
    dm_a: ['located in,member of,owns,secretly owns,stolen from', 'world + campaign A links; not the link to a world draft or campaign B'],
    dm_b: ['located in,spy in,stolen from', 'world + campaign B links; nothing of A'],
    p_a: ['located in,member of,owns', 'published links only; no secret links, no link to a draft, nothing of B'],
    p_b: ['located in,spy in', 'world + own campaign published links'],
    p_ab: ['located in,member of,owns,spy in', 'both campaigns\' published links'],
    outsider: ['', 'nothing'],
  }
  for (const [role, [want, why]] of Object.entries(expectedLinks)) {
    const got = await rels(role)
    check(`Links, ${role}: ${why}`, got === want, got === want ? '' : `got ${got || 'none'}`)
  }
  check('Players cannot add relationships', !!(await link('p_a', A, e.a_pub, e.a_inn, 'zz x', 'players')).error)
  check('DMs cannot add world-wide relationships', !!(await link('dm_a', null, e.w_pub, e.w_guild, 'zz x', 'players')).error)
  check('DMs cannot add relationships to another campaign', !!(await link('dm_a', B, e.b_npc, e.w_pub, 'zz x', 'players')).error)
  check('Players cannot change relationships', ((await db('p_a').from('codex_links').update({ relation: 'hacked' }).eq('id', made.member).select()).data ?? []).length === 0)
  check('DM B cannot change campaign A\'s relationship', ((await db('dm_b').from('codex_links').update({ relation: 'hacked' }).eq('id', made.member).select()).data ?? []).length === 0)
  check('DM B cannot remove campaign A\'s relationship', ((await db('dm_b').from('codex_links').delete().eq('id', made.member).select()).data ?? []).length === 0)
  check('DMs cannot change the Owner\'s world relationship', ((await db('dm_a').from('codex_links').update({ relation: 'hacked' }).eq('id', made.located).select()).data ?? []).length === 0)
  check('A relationship can\'t be re-pointed at another article', !!(await db('dm_a').from('codex_links').update({ to_entry_id: e.w_pub.id }).eq('id', made.owns)).error)
  check('DM A makes their "owns" link secret',
    ((await db('dm_a').from('codex_links').update({ relation: 'owns', visibility: 'dm' }).eq('id', made.owns).select()).data ?? []).length === 1)
  check('...and player A no longer sees it', await rels('p_a') === 'located in,member of', await rels('p_a'))
  must(await db('dm_a').from('codex_links').update({ visibility: 'players' }).eq('id', made.owns), 'republish owns')
  must(await db('owner').from('codex_entries').update({ name: 'w_guild renamed' }).eq('id', e.w_guild.id), 'rename')
  const memberLink = (await db('p_a').from('codex_links').select('to_entry_id').eq('id', made.member).maybeSingle()).data
  const renamed = (await db('p_a').from('codex_entries').select('name').eq('id', memberLink?.to_entry_id ?? '').maybeSingle()).data
  check('Renaming an article keeps its relationships pointing at it', renamed?.name === 'w_guild renamed', renamed?.name)
  check('Unpublishing an article hides its relationships from players',
    !(await db('owner').from('codex_entries').update({ visibility: 'draft' }).eq('id', e.w_sword.id)).error && await rels('p_a') === 'located in,member of', await rels('p_a'))
  must(await db('owner').from('codex_entries').update({ visibility: 'players' }).eq('id', e.w_sword.id), 'republish sword')
  check('DM A removes their secret relationship', ((await db('dm_a').from('codex_links').delete().eq('id', made.secretly).select()).data ?? []).length === 1)
  must(await db('owner').from('codex_entries').delete().eq('id', e.w_sword.id), 'delete sword')
  check('Deleting an article removes its relationships', !(await rels('owner')).includes('owns') && !(await rels('owner')).includes('stolen from'), await rels('owner'))
  const linkToken = (await db('p_ab').auth.getSession()).data.session.access_token
  const directLink = await fetch(`${SUPABASE_URL}/rest/v1/codex_links?select=relation&id=in.(${made.stolen},${made.founded})`, {
    headers: { apikey: SUPABASE_PUBLISHABLE_KEY, Authorization: `Bearer ${linkToken}` },
  })
  check('Direct HTTP request for secret or hidden relationships as a player returns nothing', directLink.ok && (await directLink.json()).length === 0)

  // ---- Signed out and direct requests ----
  const anon = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, noPersist)
  for (const table of ['codex_entries', 'codex_links', 'codex_reveals', 'codex_notes']) {
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
