import { Layout } from './components/layout/Layout'
import { navItems } from './config/navigation'
import { useHashRoute } from './hooks/useHashRoute'
import { DashboardPage } from './pages/DashboardPage'
import { PlaceholderPage } from './pages/PlaceholderPage'

function App() {
  const route = useHashRoute()
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
