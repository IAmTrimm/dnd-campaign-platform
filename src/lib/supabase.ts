import { createClient } from '@supabase/supabase-js'
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from '../config/supabase'

// "Keep me signed in": sessions are saved in localStorage (survives closing the
// browser) or sessionStorage (cleared when the browser closes).
const REMEMBER_KEY = 'dnd-keep-signed-in'

function chosenStorage(): Storage | undefined {
  try {
    return localStorage.getItem(REMEMBER_KEY) === 'no' ? sessionStorage : localStorage
  } catch {
    return undefined
  }
}

export function setKeepSignedIn(keep: boolean) {
  try {
    localStorage.setItem(REMEMBER_KEY, keep ? 'yes' : 'no')
  } catch {
    // Storage unavailable (e.g. private mode): the session lasts for this page only.
  }
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
    storage: {
      getItem: (key) => chosenStorage()?.getItem(key) ?? null,
      setItem: (key, value) => chosenStorage()?.setItem(key, value),
      removeItem: (key) => {
        try {
          localStorage.removeItem(key)
          sessionStorage.removeItem(key)
        } catch {
          // Nothing stored.
        }
      },
    },
  },
})
