import { useEffect, useState } from 'react'

// Minimal hash-based routing (e.g. /#/quests). Hash URLs work on GitHub Pages
// without any server configuration.
function readHash() {
  return window.location.hash.replace(/^#\/?/, '')
}

export function useHashRoute() {
  const [route, setRoute] = useState(readHash)

  useEffect(() => {
    const onChange = () => setRoute(readHash())
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])

  return route
}
