import { Menu, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Brand } from './Brand'
import { NavList } from './NavList'
import { UserMenu } from './UserMenu'

type MobileHeaderProps = {
  currentRoute: string
}

// Top bar with a slide-out menu, shown on small screens instead of the sidebar.
export function MobileHeader({ currentRoute }: MobileHeaderProps) {
  const [isOpen, setIsOpen] = useState(false)
  const close = () => setIsOpen(false)
  const headerRef = useRef<HTMLElement>(null)
  const menuButtonRef = useRef<HTMLButtonElement>(null)
  const closeButtonRef = useRef<HTMLButtonElement>(null)

  // While the menu is open: stop the page behind it scrolling, let Escape close it,
  // keep keyboard focus inside the menu, then return focus to the menu button on close.
  useEffect(() => {
    if (!isOpen) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false)
    }
    const menuButton = menuButtonRef.current
    const background = [headerRef.current, document.getElementById('main-content')]
    document.body.style.overflow = 'hidden'
    background.forEach((el) => el?.setAttribute('inert', ''))
    window.addEventListener('keydown', onKeyDown)
    closeButtonRef.current?.focus()
    return () => {
      document.body.style.overflow = ''
      background.forEach((el) => el?.removeAttribute('inert'))
      window.removeEventListener('keydown', onKeyDown)
      menuButton?.focus()
    }
  }, [isOpen])

  return (
    <>
      <header
        ref={headerRef}
        className="sticky top-0 z-30 flex items-center justify-between border-b border-line bg-slate/90 px-4 py-3 backdrop-blur md:hidden"
      >
        <Brand />
        <button
          ref={menuButtonRef}
          type="button"
          onClick={() => setIsOpen(true)}
          aria-label="Open navigation"
          aria-expanded={isOpen}
          aria-controls="mobile-menu"
          className="rounded-lg p-2 text-ash hover:bg-white/5 hover:text-bone"
        >
          <Menu className="size-5" />
        </button>
      </header>

      {isOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={close} />
          <aside
            id="mobile-menu"
            role="dialog"
            aria-modal="true"
            aria-label="Navigation"
            className="absolute inset-y-0 left-0 flex w-72 max-w-[85%] flex-col border-r border-line bg-slate shadow-2xl"
          >
            <div className="flex items-center justify-between px-5 py-5">
              <Brand onNavigate={close} />
              <button
                ref={closeButtonRef}
                type="button"
                onClick={close}
                aria-label="Close navigation"
                className="rounded-lg p-2 text-ash hover:bg-white/5 hover:text-bone"
              >
                <X className="size-5" />
              </button>
            </div>
            <div className="mx-5 h-px bg-linear-to-r from-transparent via-gold/25 to-transparent" />
            <div className="flex-1 overflow-y-auto px-3 py-6">
              <NavList currentRoute={currentRoute} onNavigate={close} />
            </div>
            <div className="border-t border-line px-4 py-3">
              <UserMenu />
            </div>
          </aside>
        </div>
      )}
    </>
  )
}
