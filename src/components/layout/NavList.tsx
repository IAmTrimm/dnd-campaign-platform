import { useAuth } from '../../auth/AuthContext'
import { navGroups, visibleNavItems } from '../../config/navigation'

type NavListProps = {
  currentRoute: string
  onNavigate?: () => void
}

// The grouped list of section links, shared by the desktop sidebar and mobile menu.
export function NavList({ currentRoute, onNavigate }: NavListProps) {
  const items = visibleNavItems(useAuth().isDm)
  const groups = navGroups.filter((group) => items.some((item) => item.group === group.id))

  return (
    <nav className="space-y-7">
      {groups.map((group) => (
        <div key={group.id}>
          <p className="px-3 pb-2 text-[11px] font-medium tracking-[0.14em] text-faint uppercase">
            {group.label}
          </p>
          <ul className="space-y-0.5">
            {items
              .filter((item) => item.group === group.id)
              .map((item) => {
                const Icon = item.icon
                const isActive = currentRoute === item.path
                return (
                  <li key={item.path}>
                    <a
                      href={`#/${item.path}`}
                      onClick={onNavigate}
                      aria-current={isActive ? 'page' : undefined}
                      className={`group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                        isActive
                          ? 'bg-burgundy/15 text-bone'
                          : 'text-ash hover:bg-white/[0.04] hover:text-bone'
                      }`}
                    >
                      {isActive && (
                        <span className="absolute inset-y-1.5 left-0 w-0.5 rounded-full bg-burgundy-light" />
                      )}
                      <Icon
                        className={`size-[18px] ${isActive ? 'text-gold' : 'text-faint group-hover:text-ash'}`}
                        strokeWidth={1.75}
                      />
                      {item.label}
                    </a>
                  </li>
                )
              })}
          </ul>
        </div>
      ))}
    </nav>
  )
}
