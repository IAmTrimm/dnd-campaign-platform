import { Brand } from './Brand'
import { NavList } from './NavList'

type SidebarProps = {
  currentRoute: string
}

// Fixed navigation sidebar, shown on medium screens and wider.
export function Sidebar({ currentRoute }: SidebarProps) {
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-line bg-slate/90 backdrop-blur md:flex">
      <div className="px-5 py-6">
        <Brand />
      </div>
      <div className="mx-5 h-px bg-linear-to-r from-transparent via-gold/25 to-transparent" />
      <div className="flex-1 overflow-y-auto px-3 py-6">
        <NavList currentRoute={currentRoute} />
      </div>
      <div className="border-t border-line px-5 py-4 text-xs text-faint">
        A personal campaign companion
      </div>
    </aside>
  )
}
