import { navItems } from '../config/navigation'

export function HomePage() {
  return (
    <div className="space-y-12">
      <section className="text-center">
        <p className="font-display text-sm tracking-[0.3em] text-gold uppercase">Welcome, adventurer</p>
        <h1 className="mt-3 font-display text-4xl font-bold text-gold-light md:text-6xl">
          The Campaign Chronicle
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-lg text-parchment/80 italic">
          Every legend begins with a single step into the unknown. Gather your party, consult the
          Codex and set forth on your next quest.
        </p>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {navItems.map((item) => (
          <a
            key={item.path}
            href={`#/${item.path}`}
            className="group rounded-lg border border-gold/30 bg-ink/70 p-6 transition hover:border-gold hover:bg-ink"
          >
            <div className="text-3xl">{item.icon}</div>
            <h2 className="mt-3 font-display text-xl text-gold-light group-hover:text-gold">
              {item.label}
            </h2>
            <p className="mt-1 text-parchment/70">{item.description}</p>
          </a>
        ))}
      </section>
    </div>
  )
}
