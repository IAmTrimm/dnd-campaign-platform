import type { CodexCategory, CodexListItem, CodexVisibility } from './types'

export type ListFilters = {
  category: CodexCategory | 'all'
  search: string
  status: CodexVisibility | 'all'
  worldId: string | 'all'
}

export function filterEntries(entries: CodexListItem[], filters: ListFilters) {
  const words = filters.search.trim().toLowerCase().split(/\s+/).filter(Boolean)
  return entries.filter(
    (entry) =>
      (filters.category === 'all' || entry.category === filters.category) &&
      (filters.status === 'all' || entry.visibility === filters.status) &&
      (filters.worldId === 'all' || entry.world_id === filters.worldId) &&
      words.every((word) =>
        [entry.name, entry.summary ?? '', ...entry.tags].some((text) => text.toLowerCase().includes(word)),
      ),
  )
}
