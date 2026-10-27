import { LoaderCircle, LogIn } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useAuth } from '../auth/AuthContext'
import { AmbientBackground } from '../components/layout/AmbientBackground'
import { Brand } from '../components/layout/Brand'
import { Panel } from '../components/ui/Panel'

const fieldClass =
  'mt-1.5 w-full rounded-lg border border-line bg-charcoal/70 px-3.5 py-2.5 text-bone placeholder:text-faint transition-colors focus:border-gold/60'

export function LoginPage() {
  const { signIn } = useAuth()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [keepSignedIn, setKeepSignedIn] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setSubmitting(true)
    setError(null)
    const message = await signIn(username, password, keepSignedIn)
    // On success the app switches away from this page, so only failures need handling.
    if (message) {
      setError(message)
      setPassword('')
      setSubmitting(false)
    }
  }

  return (
    <div className="relative grid min-h-screen place-items-center px-4 py-10">
      <AmbientBackground />
      <div className="relative w-full max-w-sm">
        <div className="mb-8 flex justify-center">
          <Brand />
        </div>
        <Panel className="p-6 sm:p-8">
          <h1 className="font-display text-3xl font-semibold text-bone">Welcome, adventurer</h1>
          <p className="mt-1 text-sm text-ash">Sign in to continue your campaign.</p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4" noValidate>
            <label className="block">
              <span className="text-sm font-medium text-bone">Username</span>
              <input
                type="text"
                name="username"
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
                required
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                className={fieldClass}
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-bone">Password</span>
              <input
                type="password"
                name="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className={fieldClass}
              />
            </label>
            <label className="flex items-center gap-2.5 text-sm text-ash">
              <input
                type="checkbox"
                checked={keepSignedIn}
                onChange={(event) => setKeepSignedIn(event.target.checked)}
                className="size-4 accent-burgundy"
              />
              Keep me signed in on this device
            </label>

            {error && (
              <p role="alert" className="rounded-lg border border-burgundy/40 bg-burgundy-dark/40 px-3.5 py-2.5 text-sm text-bone">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-burgundy px-4 py-2.5 text-sm font-medium text-bone shadow-lg shadow-burgundy/25 transition hover:bg-burgundy-light disabled:opacity-70"
            >
              {submitting ? <LoaderCircle className="size-4 animate-spin" /> : <LogIn className="size-4" />}
              {submitting ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        </Panel>
        <p className="mt-6 text-center text-sm text-faint">
          Accounts are created by your Dungeon Master.
          <br />
          Forgotten your password? Ask your DM to reset it.
        </p>
      </div>
    </div>
  )
}
