import { Search } from 'lucide-react'
import { useId, useMemo, useState, type KeyboardEvent } from 'react'
import { categoryOf, type CodexListItem } from './types'

type EntryPickerProps = {
  entries: CodexListItem[]
  onSelect: (entry: CodexListItem) => void
  describe: (entry: CodexListItem) => string
  label: string
  autoFocus?: boolean
  onEscape?: () => void
}

// Search box for choosing an existing Codex article. Only lists the articles
// passed in, which are already limited to those the user is allowed to see.
export function EntryPicker({ entries, onSelect, describe, label, autoFocus, onEscape }: EntryPickerProps) {
  const listId = useId()
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase()
    const found = q ? entries.filter((e) => e.name.toLowerCase().includes(q) || e.tags.some((t) => t.includes(q))) : entries
    // Names starting with the search come first.
    return [...found].sort((a, b) => Number(!a.name.toLowerCase().startsWith(q)) - Number(!b.name.toLowerCase().startsWith(q))).slice(0, 8)
  }, [entries, query])
  const current = Math.min(active, matches.length - 1)

  const onKey = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      const step = event.key === 'ArrowDown' ? 1 : -1
      setActive((current + step + matches.length) % Math.max(matches.length, 1))
    } else if (event.key === 'Enter') {
      event.preventDefault()
      if (matches[current]) onSelect(matches[current])
    } else if (event.key === 'Escape' && onEscape) {
      event.preventDefault()
      onEscape()
    }
  }

  return (
    <div>
      <div className="relative">
        <Search aria-hidden className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-faint" />
        <input
          role="combobox"
          aria-label={label}
          aria-expanded={matches.length > 0}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={matches[current] ? `${listId}-${matches[current].id}` : undefined}
          autoFocus={autoFocus}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setActive(0)
          }}
          onKeyDown={onKey}
          placeholder="Search articles by name or tag…"
          className="w-full rounded-lg border border-line bg-charcoal/70 py-2 pr-3 pl-9 text-sm text-bone placeholder:text-faint focus:border-gold/60"
        />
      </div>
      <ul id={listId} role="listbox" aria-label="Matching articles" className="mt-1.5 max-h-64 overflow-y-auto rounded-lg border border-line bg-panel/90 p-1">
        {matches.length === 0 && <li className="px-3 py-2 text-sm text-faint italic">No matching articles.</li>}
        {matches.map((entry, index) => {
          const { icon: Icon, label: category } = categoryOf(entry.category)
          return (
            <li
              key={entry.id}
              id={`${listId}-${entry.id}`}
              role="option"
              aria-selected={index === current}
              // Keep focus in the search box (and the editor's selection) while choosing.
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => onSelect(entry)}
              onMouseEnter={() => setActive(index)}
              className={`flex cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-2 text-sm ${index === current ? 'bg-gold/10 text-bone' : 'text-ash'}`}
            >
              <Icon aria-label={category} className="size-4 shrink-0 text-gold" strokeWidth={1.75} />
              <span className="min-w-0 flex-1 truncate font-medium">{entry.name}</span>
              <span className="shrink-0 text-xs text-faint">{describe(entry)}</span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
