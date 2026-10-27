import { LoaderCircle } from 'lucide-react'
import { useAuth } from './auth/AuthContext'
import { AmbientBackground } from './components/layout/AmbientBackground'
import { Layout } from './components/layout/Layout'
import { navItems } from './config/navigation'
import { useHashRoute } from './hooks/useHashRoute'
import { DashboardPage } from './pages/DashboardPage'
import { LoginPage } from './pages/LoginPage'
import { PlaceholderPage } from './pages/PlaceholderPage'

function App() {
  const { session, loading } = useAuth()
  const route = useHashRoute()

  // Briefly shown while a saved session is restored.
  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center">
        <AmbientBackground />
        <LoaderCircle aria-label="Loading" className="relative size-6 animate-spin text-gold" />
      </div>
    )
  }

  // Every page requires signing in.
  if (!session) return <LoginPage />

  // The homepage is the Dashboard; unknown routes fall back to it too.
  const section = navItems.find((item) => item.path === route)
  const activeRoute = section?.path ?? 'dashboard'

  return (
    <Layout currentRoute={activeRoute}>
      {section && section.path !== 'dashboard' ? <PlaceholderPage item={section} /> : <DashboardPage />}
    </Layout>
  )
}

export default App
