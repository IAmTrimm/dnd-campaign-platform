import type { NavItem } from '../config/navigation'

type PlaceholderPageProps = {
  item: NavItem
}

// Temporary page shown for each section until its real feature is built.
export function PlaceholderPage({ item }: PlaceholderPageProps) {
  return (
    <div className="mx-auto max-w-2xl rounded-lg border border-gold/30 bg-ink/70 p-10 text-center">
      <div className="text-5xl">{item.icon}</div>
      <h1 className="mt-4 font-display text-3xl font-bold text-gold-light">{item.label}</h1>
      <p className="mt-2 text-lg text-parchment/80">{item.description}</p>
      <p className="mt-6 text-parchment/50 italic">
        This chapter has yet to be written. Check back soon.
      </p>
    </div>
  )
}
