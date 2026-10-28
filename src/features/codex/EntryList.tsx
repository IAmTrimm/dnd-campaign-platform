import { Search, SearchX, Sparkles } from 'lucide-react'
import { EmptyState } from '../../components/ui/EmptyState'
import { Panel } from '../../components/ui/Panel'
import { StatusBadge } from './StatusBadge'
import { filterEntries, type ListFilters } from './filters'
import { CATEGORIES, categoryOf } from './types'
import type { CodexData } from './useCodex'

type EntryListProps = {
  codex: CodexData
  filters: ListFilters
  onFiltersChange: (filters: ListFilters) => void
  selectedId: string | null
}

export function EntryList({ codex, filters, onFiltersChange, selectedId }: EntryListProps) {
  const all = codex.entries ?? []
  // Category counts respect every filter except the category itself.
  const inScope = filterEntries(all, { ...filters, category: 'all' })
  const shown = filterEntries(all, filters)
  const set = (change: Partial<ListFilters>) => onFiltersChange({ ...filters, ...change })
  const selectClass = 'rounded-lg border border-line bg-charcoal/70 px-3 py-2 text-sm text-bone'

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-faint" />
        <input
          type="search"
          value={filters.search}
          onChange={(event) => set({ search: event.target.value })}
          placeholder="Search names, summaries and tags"
          aria-label="Search the Codex"
          className="w-full rounded-lg border border-line bg-charcoal/70 py-2.5 pr-3 pl-9 text-sm text-bone placeholder:text-faint focus:border-gold/60"
        />
      </div>

      <div role="group" aria-label="Filter by category" className="flex flex-wrap gap-1.5">
        {[{ id: 'all' as const, plural: 'All', icon: Sparkles }, ...CATEGORIES].map(({ id, plural, icon: Icon }) => {
          const count = id === 'all' ? inScope.length : inScope.filter((e) => e.category === id).length
          const active = filters.category === id
          return (
            <button
              key={id}
              type="button"
              onClick={() => set({ category: id })}
              aria-pressed={active}
              className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                active ? 'border-gold/40 bg-gold/10 text-gold' : 'border-line text-ash hover:border-gold/25 hover:text-bone'
              }`}
            >
              <Icon className="size-3.5" strokeWidth={2} />
              {plural}
              <span className={active ? 'text-gold/70' : 'text-faint'}>{count}</span>
            </button>
          )
        })}
      </div>

      {(codex.isEditor || codex.worlds.length > 1) && (
        <div className="flex flex-wrap gap-2">
          {codex.isEditor && (
            <select aria-label="Filter by status" value={filters.status} onChange={(e) => set({ status: e.target.value as ListFilters['status'] })} className={selectClass}>
              <option value="all">All statuses</option>
              <option value="draft">Drafts</option>
              <option value="dm">DM only</option>
              <option value="players">Published</option>
            </select>
          )}
          {codex.worlds.length > 1 && (
            <select aria-label="Filter by world" value={filters.worldId} onChange={(e) => set({ worldId: e.target.value })} className={selectClass}>
              <option value="all">All worlds</option>
              {codex.worlds.map((world) => (
                <option key={world.id} value={world.id}>
                  {world.name}
                </option>
              ))}
            </select>
          )}
        </div>
      )}

      {shown.length === 0 ? (
        <Panel>
          {all.length === 0 ? (
            <EmptyState
              icon={Sparkles}
              title="The Codex is empty"
              text={codex.isEditor ? 'Create your first article to start recording the people, places and lore of your world.' : 'No lore has been shared yet. Your DM will publish articles here as the story unfolds.'}
            />
          ) : (
            <EmptyState icon={SearchX} title="No matching articles" text="Try a different search or category." />
          )}
        </Panel>
      ) : (
        <ul className="space-y-1.5" aria-label="Codex articles">
          {shown.map((entry) => {
            const { icon: Icon, label } = categoryOf(entry.category)
            const active = entry.id === selectedId
            return (
              <li key={entry.id}>
                <a
                  href={`#/codex/${entry.id}`}
                  aria-current={active ? 'page' : undefined}
                  className={`group flex gap-3 rounded-xl border p-3 transition-colors ${
                    active ? 'border-gold/35 bg-gold/[0.07]' : 'border-line bg-panel/60 hover:border-burgundy-light/35 hover:bg-panel-raised'
                  }`}
                >
                  <span className="grid size-9 shrink-0 place-items-center rounded-lg border border-line bg-charcoal/60 text-gold" title={label}>
                    <Icon className="size-4" strokeWidth={1.75} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-start justify-between gap-2">
                      <span className="truncate font-medium text-bone">{entry.name}</span>
                      {codex.isEditor && entry.visibility !== 'players' && <StatusBadge visibility={entry.visibility} />}
                    </span>
                    {entry.summary && <span className="mt-0.5 line-clamp-1 block text-sm text-ash">{entry.summary}</span>}
                    <span className="mt-1 block text-xs text-faint">
                      {label} · {codex.scopeLabel(entry)}
                    </span>
                  </span>
                </a>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
