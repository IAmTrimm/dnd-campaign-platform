// DM-only account tool. Runs on the DM's computer with the Supabase SECRET key,
// which is read from scripts/.env.local (never committed, never printed).
//
//   node scripts/accounts.mjs create <username> [display name]
//   node scripts/accounts.mjs reset-password <username>
//   node scripts/accounts.mjs list
//   node scripts/accounts.mjs campaigns
//   node scripts/accounts.mjs add-member <username> "<campaign name>" [player|dm]
//   node scripts/accounts.mjs remove-member <username> "<campaign name>"
//
// New passwords are generated randomly and copied to the clipboard rather than
// printed, so they don't end up in terminal history or logs.

import { createClient } from '@supabase/supabase-js'
import { randomInt } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { createInterface } from 'node:readline/promises'
import { isValidUsername, normaliseUsername, usernameToLoginEmail, USERNAME_RULES } from '../src/config/auth.ts'
import { SUPABASE_URL } from '../src/config/supabase.ts'

const usage = `Usage:
  node scripts/accounts.mjs create <username> [display name]
  node scripts/accounts.mjs reset-password <username>
  node scripts/accounts.mjs list
  node scripts/accounts.mjs campaigns
  node scripts/accounts.mjs add-member <username> "<campaign name>" [player|dm]
  node scripts/accounts.mjs remove-member <username> "<campaign name>"`

function fail(message) {
  console.error(`\n  ${message}\n`)
  process.exit(1)
}

function loadSecretKey() {
  try {
    process.loadEnvFile(new URL('./.env.local', import.meta.url))
  } catch {
    fail('Missing scripts/.env.local. Create it with a line: SUPABASE_SECRET_KEY=<your secret key>')
  }
  const key = process.env.SUPABASE_SECRET_KEY?.trim()
  if (!key) fail('SUPABASE_SECRET_KEY is empty in scripts/.env.local.')
  return key
}

// 4 groups of 5 characters from an alphabet without look-alikes (~100 bits).
function generatePassword() {
  const alphabet = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const group = () => Array.from({ length: 5 }, () => alphabet[randomInt(alphabet.length)]).join('')
  return [group(), group(), group(), group()].join('-')
}

function copyToClipboard(text) {
  const command = process.platform === 'win32' ? 'clip' : process.platform === 'darwin' ? 'pbcopy' : 'xclip'
  const args = command === 'xclip' ? ['-selection', 'clipboard'] : []
  const result = spawnSync(command, args, { input: text })
  return result.status === 0
}

async function deliverPassword(password, username) {
  if (copyToClipboard(password)) {
    console.log(`  Password for "${username}" copied to your clipboard.`)
    console.log('  Paste it into a private message to the player; it is not shown or saved anywhere else.\n')
    return
  }
  const rl = createInterface({ input: process.stdin, output: process.stdout })
  const answer = await rl.question('  Could not use the clipboard. Show the password on screen instead? (y/N) ')
  rl.close()
  if (answer.trim().toLowerCase() === 'y') console.log(`\n  ${password}\n\n  Clear your terminal after copying it.\n`)
  else console.log('  Password not shown. Run reset-password to generate a new one.\n')
}

async function findProfile(admin, username) {
  const { data, error } = await admin.from('profiles').select('id, username, display_name').eq('username', username).maybeSingle()
  if (error) fail(`Could not look up "${username}": ${error.message}`)
  return data
}

const [command, rawUsername, ...nameParts] = process.argv.slice(2)
if (!command) fail(usage)

const admin = createClient(SUPABASE_URL, loadSecretKey(), {
  auth: { persistSession: false, autoRefreshToken: false },
})

if (command === 'list') {
  const { data, error } = await admin.from('profiles').select('username, display_name, created_at').order('username')
  if (error) fail(error.message)
  console.table(data.map((p) => ({ username: p.username, 'display name': p.display_name, created: p.created_at.slice(0, 10) })))
  process.exit(0)
}

if (command === 'campaigns') {
  const { data, error } = await admin
    .from('campaigns')
    .select('name, worlds(name), campaign_members(role, profiles(username))')
    .order('name')
  if (error) fail(error.message)
  for (const campaign of data) {
    console.log(`\n  ${campaign.name}  (world: ${campaign.worlds.name})`)
    const members = campaign.campaign_members
      .map((m) => `${m.profiles.username}${m.role === 'dm' ? ' (DM)' : ''}`)
      .sort()
    console.log(`    ${members.length ? members.join(', ') : 'no members yet'}`)
  }
  console.log()
  process.exit(0)
}

// Finds one campaign by its exact name (ignoring upper/lower case).
async function findCampaign(name) {
  if (!name) fail(usage)
  const { data, error } = await admin.from('campaigns').select('id, name').ilike('name', name.replace(/[\\%_]/g, '\\$&'))
  if (error) fail(error.message)
  if (data.length === 0) fail(`No campaign called "${name}". Run "campaigns" to see them all.`)
  if (data.length > 1) fail(`More than one campaign is called "${name}". Rename one first.`)
  return data[0]
}

if (command === 'add-member' || command === 'remove-member') {
  const memberName = normaliseUsername(rawUsername ?? '')
  const profile = await findProfile(admin, memberName)
  if (!profile) fail(`No account found with the username "${memberName}".`)
  const [campaignName, roleArg] = command === 'add-member' && ['player', 'dm'].includes(nameParts.at(-1)?.toLowerCase())
    ? [nameParts.slice(0, -1).join(' '), nameParts.at(-1).toLowerCase()]
    : [nameParts.join(' '), 'player']
  const campaign = await findCampaign(campaignName.trim())

  if (command === 'add-member') {
    // Adding someone already in the campaign just updates their role.
    const { error } = await admin
      .from('campaign_members')
      .upsert({ campaign_id: campaign.id, user_id: profile.id, role: roleArg }, { onConflict: 'campaign_id,user_id' })
    if (error) fail(`Could not add the member: ${error.message}`)
    console.log(`\n  ${profile.username} is now ${roleArg === 'dm' ? 'a DM' : 'a player'} in "${campaign.name}".\n`)
  } else {
    const { data, error } = await admin
      .from('campaign_members')
      .delete()
      .eq('campaign_id', campaign.id)
      .eq('user_id', profile.id)
      .select()
    if (error) fail(`Could not remove the member: ${error.message}`)
    if (data.length === 0) fail(`${profile.username} is not in "${campaign.name}".`)
    console.log(`\n  ${profile.username} has been removed from "${campaign.name}".\n`)
  }
  process.exit(0)
}

if (command !== 'create' && command !== 'reset-password') fail(usage)
const username = normaliseUsername(rawUsername ?? '')
if (!isValidUsername(username)) fail(`Invalid username "${rawUsername ?? ''}". Usernames are ${USERNAME_RULES}.`)

if (command === 'create') {
  if (await findProfile(admin, username)) fail(`The username "${username}" is already taken.`)
  const displayName = nameParts.join(' ').trim() || username
  const password = generatePassword()
  const { error } = await admin.auth.admin.createUser({
    email: usernameToLoginEmail(username),
    password,
    email_confirm: true,
    user_metadata: { username, display_name: displayName },
  })
  if (error) fail(`Could not create the account: ${error.message}`)
  console.log(`\n  Created account "${username}" (${displayName}).`)
  await deliverPassword(password, username)
}

if (command === 'reset-password') {
  const profile = await findProfile(admin, username)
  if (!profile) fail(`No account found with the username "${username}".`)
  const password = generatePassword()
  const { error } = await admin.auth.admin.updateUserById(profile.id, { password })
  if (error) fail(`Could not reset the password: ${error.message}`)
  // Supabase already ends all sessions when a password changes; this makes sure
  // of it, so an old or stolen login can't carry on.
  const { error: revokeError } = await admin.rpc('revoke_user_sessions', { target_user: profile.id })
  console.log(`\n  New password set for "${username}".`)
  if (revokeError) console.log(`  WARNING: could not confirm sign-out of other devices: ${revokeError.message}`)
  else console.log('  Signed out on all devices (any open page loses access within an hour at most).')
  await deliverPassword(password, username)
}
