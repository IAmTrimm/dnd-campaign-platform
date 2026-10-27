import type { ReactNode } from 'react'
import { MobileHeader } from './MobileHeader'
import { Sidebar } from './Sidebar'

type LayoutProps = {
  currentRoute: string
  children: ReactNode
}

export function Layout({ currentRoute, children }: LayoutProps) {
  return (
    <div className="relative min-h-screen">
      {/* Hidden until focused: lets keyboard users jump past the navigation */}
      <a
        href="#main-content"
        onClick={(event) => {
          event.preventDefault()
          document.getElementById('main-content')?.focus()
        }}
        className="sr-only z-50 rounded-lg bg-burgundy px-4 py-2 text-sm font-medium text-bone focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Skip to content
      </a>
      {/* Atmospheric lighting behind the page */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_70%_45%_at_75%_-5%,rgba(134,40,54,0.2),transparent_65%),radial-gradient(ellipse_50%_35%_at_10%_105%,rgba(194,165,110,0.06),transparent_70%)]"
      />
      <Sidebar currentRoute={currentRoute} />
      <MobileHeader currentRoute={currentRoute} />
      <div className="relative md:pl-64">
        <main
          id="main-content"
          tabIndex={-1}
          className="mx-auto max-w-6xl px-4 py-6 outline-none sm:px-6 md:py-10 lg:px-10"
        >
          {children}
        </main>
      </div>
    </div>
  )
}
