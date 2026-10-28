// End-to-end login checks against the live project, using a temporary account
// that is always deleted afterwards. Passwords are random and never printed.
//
//   node scripts/auth-smoke-test.mjs

import { createClient } from '@supabase/supabase-js'
import { randomBytes } from 'node:crypto'
import { usernameToLoginEmail } from '../src/config/auth.ts'
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from '../src/config/supabase.ts'

process.loadEnvFile(new URL('./.env.local', import.meta.url))
const noPersist = { auth: { persistSession: false, autoRefreshToken: false } }
const admin = createClient(SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, noPersist)

// A browser-like client whose saved session lives in the given storage object.
const browserClient = (store) =>
  createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: {
      persistSession: true,
      autoRefreshToken: false,
      storage: {
        getItem: (k) => store.get(k) ?? null,
        setItem: (k, v) => store.set(k, v),
        removeItem: (k) => store.delete(k),
      },
    },
  })

let failures = 0
const check = (name, passed, detail = '') => {
  if (!passed) failures++
  console.log(`${passed ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`)
}

const username = 'zz_smoke_' + randomBytes(3).toString('hex')
const email = usernameToLoginEmail(username)
const password = randomBytes(18).toString('base64url')
let userId

try {
  const pub = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, noPersist)
  const signup = await pub.auth.signUp({ email: usernameToLoginEmail('zz_selfsignup'), password })
  check('public sign-up is rejected', !!signup.error, signup.error?.message)

  const created = await admin.auth.admin.createUser({
    email, password, email_confirm: true, user_metadata: { username, display_name: 'Smoke Test' },
  })
  userId = created.data?.user?.id
  check('DM can create an account (username login address)', !!userId, created.error?.message)
  const profile = await admin.from('profiles').select('username').eq('id', userId).single()
  check('profile created with the chosen username', profile.data?.username === username)

  const store = new Map()
  const browser = browserClient(store)
  const wrong = await browser.auth.signInWithPassword({ email, password: password + 'x' })
  check('incorrect password is rejected', !!wrong.error && !wrong.data.session, wrong.error?.message)
  const unknown = await browser.auth.signInWithPassword({ email: usernameToLoginEmail('zz_no_such_user'), password })
  check('unknown username gives the same error', unknown.error?.message === wrong.error?.message, unknown.error?.message)

  const ok = await browser.auth.signInWithPassword({ email, password })
  check('correct username + password signs in', !!ok.data.session, ok.error?.message)

  const reloaded = browserClient(store)
  const restored = await reloaded.auth.getSession()
  check('session is restored after a page reload', restored.data.session?.user.id === userId)
  const refreshed = await reloaded.auth.refreshSession()
  check('restored session can refresh its token', !!refreshed.data.session, refreshed.error?.message)

  const tables = ['profiles', 'worlds', 'campaigns', 'campaign_members']
  const counts = await Promise.all(tables.map((t) => reloaded.from(t).select('*', { count: 'exact', head: true })))
  // With no campaign memberships, a user may only see their own profile (B008 rules).
  check('signed-in user with no campaigns sees only their own profile',
    counts.map((c) => c.count).join() === '1,0,0,0', tables.map((t, i) => `${t}=${counts[i].count}`).join(', '))

  const refreshToken = refreshed.data.session?.refresh_token
  await reloaded.auth.signOut()
  check('sign out clears the saved session', (await reloaded.auth.getSession()).data.session === null && store.size === 0)
  const reuse = await createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, noPersist).auth.refreshSession({ refresh_token: refreshToken })
  check('signed-out session cannot be revived', !!reuse.error, reuse.error?.message)

  // A second device that stays signed in while the DM resets the password.
  const otherDevice = browserClient(new Map())
  await otherDevice.auth.signInWithPassword({ email, password })

  const newPassword = randomBytes(18).toString('base64url')
  const reset = await admin.auth.admin.updateUserById(userId, { password: newPassword })
  check('DM can reset the password', !reset.error, reset.error?.message)
  // Supabase ends sessions on a password change by itself; revoke_user_sessions is a safety net.
  const revoked = await admin.rpc('revoke_user_sessions', { target_user: userId })
  check('sign-out safety net runs for the DM', !revoked.error, revoked.error?.message)
  const stale = await otherDevice.auth.refreshSession()
  check('after a reset, other devices can no longer renew their login', !!stale.error, stale.error?.message)
  const playerCall = await otherDevice.rpc('revoke_user_sessions', { target_user: userId })
  check('players cannot call the sign-out function', !!playerCall.error, playerCall.error?.message)
  const oldLogin = await pub.auth.signInWithPassword({ email, password })
  check('old password stops working', !!oldLogin.error)
  const newLogin = await pub.auth.signInWithPassword({ email, password: newPassword })
  check('new password works', !!newLogin.data.session, newLogin.error?.message)
} finally {
  if (userId) {
    const del = await admin.auth.admin.deleteUser(userId)
    check('temporary account deleted', !del.error, del.error?.message)
  }
}

console.log(failures ? `\n${failures} check(s) failed.` : '\nAll checks passed.')
process.exit(failures ? 1 : 0)
