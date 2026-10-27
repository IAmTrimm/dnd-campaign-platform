import { EmptyState } from '../components/ui/EmptyState'
import { Panel } from '../components/ui/Panel'
import type { NavItem } from '../config/navigation'

type PlaceholderPageProps = {
  item: NavItem
}

// Temporary page shown for each section until its real feature is built.
export function PlaceholderPage({ item }: PlaceholderPageProps) {
  const Icon = item.icon

  return (
    <div className="space-y-8">
      <header className="flex items-start gap-4">
        <span className="grid size-12 shrink-0 place-items-center rounded-xl border border-line bg-panel text-gold shadow-lg shadow-black/30">
          <Icon className="size-6" strokeWidth={1.75} />
        </span>
        <div>
          <h1 className="font-display text-3xl font-semibold text-bone sm:text-4xl">{item.label}</h1>
          <p className="mt-1 text-ash">{item.description}</p>
        </div>
      </header>
      <div className="h-px bg-linear-to-r from-gold/25 via-line to-transparent" />
      <Panel>
        <EmptyState
          icon={Icon}
          title="This chapter has yet to be written"
          text={`The ${item.label} section is being prepared and will be available in a future update.`}
        />
      </Panel>
    </div>
  )
}
