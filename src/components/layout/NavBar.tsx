import { navItems } from '../../config/navigation'

type NavBarProps = {
  currentRoute: string
}

export function NavBar({ currentRoute }: NavBarProps) {
  return (
    <header className="border-b border-gold/30 bg-ink/90">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-4 md:flex-row md:items-center md:justify-between">
        <a href="#/" className="font-display text-xl font-bold tracking-wide text-gold-light">
          ⚜ D&amp;D Campaign Platform
        </a>
        <nav>
          <ul className="flex flex-wrap gap-1">
            {navItems.map((item) => {
              const isActive = currentRoute === item.path
              return (
                <li key={item.path}>
                  <a
                    href={`#/${item.path}`}
                    className={`block rounded px-3 py-1.5 font-display text-sm tracking-wide transition-colors ${
                      isActive
                        ? 'bg-gold/20 text-gold-light'
                        : 'text-parchment/80 hover:bg-gold/10 hover:text-gold-light'
                    }`}
                  >
                    {item.label}
                  </a>
                </li>
              )
            })}
          </ul>
        </nav>
      </div>
    </header>
  )
}
