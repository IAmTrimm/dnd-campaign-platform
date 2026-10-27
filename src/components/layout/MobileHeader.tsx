import { Menu, X } from 'lucide-react'
import { useState } from 'react'
import { Brand } from './Brand'
import { NavList } from './NavList'

type MobileHeaderProps = {
  currentRoute: string
}

// Top bar with a slide-out menu, shown on small screens instead of the sidebar.
export function MobileHeader({ currentRoute }: MobileHeaderProps) {
  const [isOpen, setIsOpen] = useState(false)
  const close = () => setIsOpen(false)

  return (
    <>
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-line bg-slate/90 px-4 py-3 backdrop-blur md:hidden">
        <Brand />
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          aria-label="Open navigation"
          className="rounded-lg p-2 text-ash hover:bg-white/5 hover:text-bone"
        >
          <Menu className="size-5" />
        </button>
      </header>

      {isOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={close} />
          <aside className="absolute inset-y-0 left-0 flex w-72 max-w-[85%] flex-col border-r border-line bg-slate shadow-2xl">
            <div className="flex items-center justify-between px-5 py-5">
              <Brand onNavigate={close} />
              <button
                type="button"
                onClick={close}
                aria-label="Close navigation"
                className="rounded-lg p-2 text-ash hover:bg-white/5 hover:text-bone"
              >
                <X className="size-5" />
              </button>
            </div>
            <div className="mx-5 h-px bg-linear-to-r from-transparent via-gold/25 to-transparent" />
            <div className="px-3 py-6">
              <NavList currentRoute={currentRoute} onNavigate={close} />
            </div>
          </aside>
        </div>
      )}
    </>
  )
}
