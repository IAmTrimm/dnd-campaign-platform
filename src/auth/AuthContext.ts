import type { Session } from '@supabase/supabase-js'
import { createContext, useContext } from 'react'

export type AuthState = {
  session: Session | null
  loading: boolean
  // Returns an error message to show, or null on success.
  signIn: (identifier: string, password: string, keepSignedIn: boolean) => Promise<string | null>
  signOut: () => Promise<void>
}

export const AuthContext = createContext<AuthState | null>(null)

export function useAuth(): AuthState {
  const auth = useContext(AuthContext)
  if (!auth) throw new Error('useAuth must be used inside <AuthProvider>')
  return auth
}

// Friendly name for the signed-in user, without reading the (still locked) database.
export function displayNameOf(session: Session): string {
  const meta = session.user.user_metadata ?? {}
  return meta.display_name ?? meta.username ?? session.user.email?.split('@')[0] ?? 'Adventurer'
}
