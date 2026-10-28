import type { Session } from '@supabase/supabase-js'
import { useEffect, useState, type ReactNode } from 'react'
import { isValidUsername, loginIdentifierToEmail, normaliseUsername } from '../config/auth'
import { setKeepSignedIn, supabase } from '../lib/supabase'
import { AuthContext, type AuthState } from './AuthContext'

const WRONG_DETAILS = 'Incorrect username or password.'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [isDm, setIsDm] = useState(false)
  const userId = session?.user.id

  // Restores a saved session on load, then follows sign-ins, sign-outs and token refreshes.
  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
      setLoading(false)
    })
    return () => data.subscription.unsubscribe()
  }, [])

  // Is the signed-in user a DM of any campaign, or the Owner of any world?
  useEffect(() => {
    if (!userId) return
    let cancelled = false
    Promise.all([
      supabase.from('campaign_members').select('*', { count: 'exact', head: true }).eq('user_id', userId).eq('role', 'dm'),
      supabase.from('worlds').select('*', { count: 'exact', head: true }).eq('owner_id', userId),
    ]).then(([dmOf, owns]) => {
      if (!cancelled) setIsDm((dmOf.count ?? 0) + (owns.count ?? 0) > 0)
    })
    return () => {
      cancelled = true
      setIsDm(false)
    }
  }, [userId])

  const signIn: AuthState['signIn'] = async (identifier, password, keepSignedIn) => {
    const value = identifier.trim()
    if (!value || !password) return 'Enter your username and password.'
    // Same message as a wrong password, so it doesn't reveal which usernames exist.
    if (!value.includes('@') && !isValidUsername(normaliseUsername(value))) return WRONG_DETAILS

    setKeepSignedIn(keepSignedIn)
    const { error } = await supabase.auth.signInWithPassword({
      email: loginIdentifierToEmail(value),
      password,
    })
    if (!error) return null
    if (error.status === 429) return 'Too many attempts. Please wait a minute and try again.'
    if (error.status === 400) return WRONG_DETAILS
    return 'Could not sign in right now. Please try again shortly.'
  }

  const signOut = async () => {
    await supabase.auth.signOut()
  }

  return (
    <AuthContext.Provider value={{ session, loading, isDm, signIn, signOut }}>{children}</AuthContext.Provider>
  )
}
