import { LogOut } from 'lucide-react'
import { displayNameOf, useAuth } from '../../auth/AuthContext'

// Signed-in user and sign-out button, shown at the foot of the sidebar and mobile menu.
export function UserMenu() {
  const { session, signOut } = useAuth()
  if (!session) return null
  const name = displayNameOf(session)

  return (
    <div className="flex items-center gap-3">
      <span
        aria-hidden
        className="grid size-8 shrink-0 place-items-center rounded-full border border-line bg-panel font-display text-sm font-semibold text-gold"
      >
        {name.charAt(0).toUpperCase()}
      </span>
      <div className="min-w-0 flex-1 leading-tight">
        <p className="truncate text-sm font-medium text-bone">{name}</p>
        <p className="text-xs text-faint">Signed in</p>
      </div>
      <button
        type="button"
        onClick={signOut}
        aria-label="Sign out"
        title="Sign out"
        className="rounded-lg p-2 text-ash hover:bg-white/5 hover:text-bone"
      >
        <LogOut className="size-[18px]" strokeWidth={1.75} />
      </button>
    </div>
  )
}
