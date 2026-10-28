import { LoaderCircle } from 'lucide-react'
import { lazy, Suspense } from 'react'
import { useAuth } from './auth/AuthContext'
import { AmbientBackground } from './components/layout/AmbientBackground'
import { Layout } from './components/layout/Layout'
import { visibleNavItems } from './config/navigation'
import { useHashRoute } from './hooks/useHashRoute'
import { DashboardPage } from './pages/DashboardPage'
import { LoginPage } from './pages/LoginPage'
import { PlaceholderPage } from './pages/PlaceholderPage'

// The Codex (and its editor) loads only when first opened.
const CodexPage = lazy(() => import('./features/codex/CodexPage'))

function Spinner({ label }: { label: string }) {
  return <LoaderCircle aria-label={label} className="relative size-6 animate-spin text-gold" />
}

function App() {
  const { session, loading, isDm } = useAuth()
  const route = useHashRoute()

  // Briefly shown while a saved session is restored.
  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center">
        <AmbientBackground />
        <Spinner label="Loading" />
      </div>
    )
  }

  // Every page requires signing in.
  if (!session) return <LoginPage />

  // The first part of the route picks the section (e.g. "codex/<id>/edit").
  // The homepage is the Dashboard; unknown or hidden routes fall back to it too.
  const [sectionPath, ...rest] = route.split('/')
  const section = visibleNavItems(isDm).find((item) => item.path === sectionPath)
  const activeRoute = section?.path ?? 'dashboard'

  let page = <DashboardPage />
  if (section?.path === 'codex') {
    page = (
      <Suspense fallback={<div className="grid place-items-center py-24"><Spinner label="Loading the Codex" /></div>}>
        <CodexPage path={rest} />
      </Suspense>
    )
  } else if (section && section.path !== 'dashboard') {
    page = <PlaceholderPage item={section} />
  }

  return <Layout currentRoute={activeRoute}>{page}</Layout>
}

export default App
