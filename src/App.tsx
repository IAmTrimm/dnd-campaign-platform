import { Layout } from './components/layout/Layout'
import { navItems } from './config/navigation'
import { useHashRoute } from './hooks/useHashRoute'
import { HomePage } from './pages/HomePage'
import { PlaceholderPage } from './pages/PlaceholderPage'

function App() {
  const route = useHashRoute()
  const section = navItems.find((item) => item.path === route)

  return (
    <Layout currentRoute={route}>
      {section ? <PlaceholderPage item={section} /> : <HomePage />}
    </Layout>
  )
}

export default App
