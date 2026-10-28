// Live checks for private Codex images (B015). Creates a temporary world, two
// campaigns, accounts, articles and tiny generated images, checks who can
// upload, see, replace and delete them through the real Storage service, then
// deletes everything (including the files).
//
//   node scripts/images-test.mjs

import { createClient } from '@supabase/supabase-js'
import { randomBytes, randomUUID } from 'node:crypto'
import { usernameToLoginEmail } from '../src/config/auth.ts'
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from '../src/config/supabase.ts'

process.loadEnvFile(new URL('./.env.local', import.meta.url))
const noPersist = { auth: { persistSession: false, autoRefreshToken: false } }
const admin = createClient(SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, noPersist)
const BUCKET = 'codex-images'

let failures = 0
const check = (name, passed, detail = '') => {
  if (!passed) failures++
  console.log(`${passed ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`)
}
const must = ({ data, error }, what) => {
  if (error) throw new Error(`${what}: ${error.message}`)
  return data
}

// A real 1x1 PNG.
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64')
const tag = randomBytes(2).toString('hex')
const roles = ['owner', 'dm_a', 'dm_b', 'p_a', 'p_b', 'p_ab', 'outsider']
const users = {}
let worldId
const entryIds = []

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
  const storage = (role) => db(role).storage.from(BUCKET)
  worldId = must(await admin.from('worlds').insert({ name: `zz World ${tag}`, owner_id: users.owner.id }).select('id').single(), 'world').id
  const [A, B] = must(await admin.from('campaigns').insert([
    { world_id: worldId, name: `zz A ${tag}` }, { world_id: worldId, name: `zz B ${tag}` },
  ]).select('id, name').order('name'), 'campaigns').map((c) => c.id)
  must(await admin.from('campaign_members').insert([
    { campaign_id: A, user_id: users.dm_a.id, role: 'dm' }, { campaign_id: B, user_id: users.dm_b.id, role: 'dm' },
    { campaign_id: A, user_id: users.p_a.id, role: 'player' }, { campaign_id: B, user_id: users.p_b.id, role: 'player' },
    { campaign_id: A, user_id: users.p_ab.id, role: 'player' }, { campaign_id: B, user_id: users.p_ab.id, role: 'player' },
  ]), 'memberships')
  const add = async (role, campaignId, category, name, visibility) => {
    const id = must(await db(role).from('codex_entries')
      .insert({ world_id: worldId, campaign_id: campaignId, category, name, visibility, tags: ['zz-test'] }).select('id').single(), name).id
    entryIds.push(id)
    return id
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

  // ---- Uploading ----
  const upload = (role, entry, opts = {}) => storage(role).upload(`${entry}/${randomUUID()}.png`, opts.body ?? PNG, { contentType: opts.type ?? 'image/png', upsert: false })
  const paths = {}
  for (const [role, key] of [['owner', 'w_pub'], ['owner', 'w_draft'], ['owner', 'w_secret'], ['dm_a', 'a_pub'], ['dm_a', 'a_draft'], ['dm_a', 'a_secret'], ['dm_b', 'b_pub']]) {
    const res = await upload(role, e[key])
    paths[key] = res.data?.path
    const set = res.error ? res : await db(role).from('codex_entries').update({ image_path: paths[key], image_alt: `Picture of ${key}` }).eq('id', e[key]).select('id')
    check(`${role} uploads and sets the image for ${key}`, !res.error && !set.error && set.data?.length === 1, res.error?.message ?? set.error?.message)
  }
  check('DM A cannot upload to a world article', !!(await upload('dm_a', e.w_pub)).error)
  check('DM A cannot upload to campaign B', !!(await upload('dm_a', e.b_pub)).error)
  check('Players cannot upload', !!(await upload('p_a', e.a_pub)).error)
  const anon = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, noPersist)
  check('Signed-out visitors cannot upload', !!(await anon.storage.from(BUCKET).upload(`${e.w_pub}/x.png`, PNG, { contentType: 'image/png' })).error)
  check('Files outside an article folder are refused', !!(await storage('owner').upload(`loose-${tag}.png`, PNG, { contentType: 'image/png' })).error)
  check('SVG files are refused', !!(await upload('owner', e.w_pub, { type: 'image/svg+xml', body: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>') })).error)
  check('HTML files are refused', !!(await upload('owner', e.w_pub, { type: 'text/html', body: Buffer.from('<script>alert(1)</script>') })).error)
  check('Files over 5 MB are refused', !!(await upload('owner', e.w_pub, { body: Buffer.alloc(5 * 1024 * 1024 + 1) })).error)
  check('An existing image cannot be overwritten', !!(await storage('owner').upload(paths.w_pub, PNG, { contentType: 'image/png', upsert: true })).error)
  check('An article cannot point at another article\'s image',
    !!(await db('owner').from('codex_entries').update({ image_path: paths.a_secret }).eq('id', e.w_pub)).error)

  // ---- Reading ----
  // Downloads the way the website does (src/features/codex/codexImages.ts): with
  // the person's login and a unique address, so Storage checks access every time.
  const fetchAs = async (role, path) => {
    const token = (await db(role).auth.getSession()).data.session.access_token
    const res = await fetch(`${SUPABASE_URL}/storage/v1/object/authenticated/${BUCKET}/${path}?fresh=${Date.now()}`, {
      headers: { apikey: SUPABASE_PUBLISHABLE_KEY, Authorization: `Bearer ${token}` },
    })
    return res.ok
  }
  const canRead = (role, key) => fetchAs(role, paths[key])
  const reads = async (role) => {
    const keys = []
    for (const key of Object.keys(paths)) if (await canRead(role, key)) keys.push(key)
    return keys.sort().join(',')
  }
  const expected = {
    owner: ['a_draft,a_pub,a_secret,b_pub,w_draft,w_pub,w_secret', 'every image in their world'],
    dm_a: ['a_draft,a_pub,a_secret,w_pub,w_secret', 'own campaign + world images; no world drafts, nothing of B'],
    dm_b: ['b_pub,w_pub,w_secret', 'own campaign + world images; nothing of A'],
    p_a: ['a_pub,w_pub', 'published articles only'],
    p_b: ['b_pub,w_pub', 'published articles only'],
    p_ab: ['a_pub,b_pub,w_pub', 'published articles in both campaigns'],
    outsider: ['', 'nothing'],
  }
  for (const [role, [want, why]] of Object.entries(expected)) {
    const got = await reads(role)
    check(`Images, ${role}: ${why}`, got === want, got === want ? '' : `got ${got || 'none'}`)
  }
  must(await db('dm_b').from('codex_reveals').insert({ entry_id: e.w_secret, campaign_id: B, world_id: worldId }), 'reveal')
  check('Once campaign B discovers the secret NPC, its players can see the image', await canRead('p_b', 'w_secret') && !(await canRead('p_a', 'w_secret')))
  must(await db('dm_a').from('codex_entries').update({ visibility: 'draft' }).eq('id', e.a_pub), 'unpublish')
  check('Unpublishing an article hides its image at once, even from a player who already viewed it', !(await canRead('p_a', 'a_pub')) && await canRead('dm_a', 'a_pub'))
  must(await db('dm_a').from('codex_entries').update({ visibility: 'players' }).eq('id', e.a_pub), 'republish')
  check('Signed-out visitors cannot download images', !(await anon.storage.from(BUCKET).download(paths.w_pub)).data)
  const listed = ((await storage('p_a').list(e.a_secret)).data ?? []).length
  check('Players cannot list the files of a hidden article', listed === 0, `${listed} listed`)

  // Direct HTTP requests, bypassing the website entirely.
  const token = (await db('p_ab').auth.getSession()).data.session.access_token
  const raw = (kind, key, auth = true) => fetch(`${SUPABASE_URL}/storage/v1/object/${kind}/${BUCKET}/${paths[key]}`, {
    headers: auth ? { apikey: SUPABASE_PUBLISHABLE_KEY, Authorization: `Bearer ${token}` } : { apikey: SUPABASE_PUBLISHABLE_KEY },
  })
  check('Direct request: a player can fetch a published image with their login', (await raw('authenticated', 'a_pub')).ok)
  for (const key of ['w_draft', 'a_draft', 'a_secret']) {
    const res = await raw('authenticated', key)
    check(`Direct request: a player cannot fetch the ${key} image`, !res.ok, `HTTP ${res.status}`)
  }
  const pub = await raw('public', 'w_pub', false)
  check('There are no public image URLs, even for published articles', !pub.ok, `HTTP ${pub.status}`)
  check('A player cannot create a shareable link to a hidden image', !!(await storage('p_ab').createSignedUrl(paths.a_draft, 60)).error)

  // ---- Replacing and removing ----
  const newer = (await upload('dm_a', e.a_pub)).data?.path
  must(await db('dm_a').from('codex_entries').update({ image_path: newer }).eq('id', e.a_pub), 'point at new image')
  const removedOld = ((await storage('dm_a').remove([paths.a_pub])).data ?? []).length === 1
  check('DM A replaces their image (new file in, old file deleted)', !!newer && removedOld && !(await fetchAs('dm_a', paths.a_pub)))
  paths.a_pub = newer
  check('...and players see the new image', await canRead('p_a', 'a_pub'))
  check('Players cannot delete images', ((await storage('p_a').remove([paths.a_pub])).data ?? []).length === 0 && await canRead('p_a', 'a_pub'))
  check('DM B cannot delete campaign A\'s images', ((await storage('dm_b').remove([paths.w_pub, paths.a_secret])).data ?? []).length === 0)
  must(await db('owner').from('codex_entries').update({ image_path: null }).eq('id', e.w_pub), 'clear image')
  check('Owner removes a world image', ((await storage('owner').remove([paths.w_pub])).data ?? []).length === 1 && !(await canRead('owner', 'w_pub')))
  check('Players cannot change an article\'s image', ((await db('p_a').from('codex_entries').update({ image_path: null }).eq('id', e.a_pub).select()).data ?? []).length === 0)
} finally {
  // Storage files aren't removed with the database rows, so delete them first.
  for (const id of entryIds) {
    const files = (await admin.storage.from(BUCKET).list(id)).data ?? []
    if (files.length) await admin.storage.from(BUCKET).remove(files.map((f) => `${id}/${f.name}`))
  }
  if (worldId) must(await admin.from('worlds').delete().eq('id', worldId), 'delete world')
  for (const role of roles) if (users[role]) await admin.auth.admin.deleteUser(users[role].id)
  const leftFiles = (await Promise.all(entryIds.map(async (id) => ((await admin.storage.from(BUCKET).list(id)).data ?? []).length))).reduce((a, b) => a + b, 0)
  const left = must(await admin.from('codex_entries').select('id').contains('tags', ['zz-test']), 'leftover entries')
  const leftUsers = must(await admin.from('profiles').select('id').like('username', `zz\\_%\\_${tag}`), 'leftover users')
  check('All temporary accounts, articles and image files deleted', leftFiles === 0 && left.length === 0 && leftUsers.length === 0, `${leftFiles} files left`)
}

console.log(failures ? `\n${failures} check(s) failed.` : '\nAll image checks passed.')
process.exit(failures ? 1 : 0)
