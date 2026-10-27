import type { Session } from '@supabase/supabase-js'
import { useEffect, useState, type ReactNode } from 'react'
import { isValidUsername, loginIdentifierToEmail, normaliseUsername } from '../config/auth'
import { setKeepSignedIn, supabase } from '../lib/supabase'
import { AuthContext, type AuthState } from './AuthContext'

const WRONG_DETAILS = 'Incorrect username or password.'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  // Restores a saved session on load, then follows sign-ins, sign-outs and token refreshes.
  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
      setLoading(false)
    })
    return () => data.subscription.unsubscribe()
  }, [])

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
    <AuthContext.Provider value={{ session, loading, signIn, signOut }}>{children}</AuthContext.Provider>
  )
}
