import type { ReactNode } from 'react'
import { NavBar } from './NavBar'

type LayoutProps = {
  currentRoute: string
  children: ReactNode
}

export function Layout({ currentRoute, children }: LayoutProps) {
  return (
    <div className="flex min-h-screen flex-col bg-[radial-gradient(ellipse_at_top,_#2a1f17_0%,_#0f0c0a_70%)]">
      <NavBar currentRoute={currentRoute} />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-10">{children}</main>
      <footer className="border-t border-gold/20 py-4 text-center text-sm text-parchment/50">
        A personal campaign companion · Roll for initiative
      </footer>
    </div>
  )
}
