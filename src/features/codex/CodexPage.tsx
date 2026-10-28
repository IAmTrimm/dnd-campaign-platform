import { BookOpen, LoaderCircle, Plus, ScrollText } from 'lucide-react'
import { useEffect, useState } from 'react'
import { EmptyState } from '../../components/ui/EmptyState'
import { Panel } from '../../components/ui/Panel'
import { ArticleEditor } from './ArticleEditor'
import { ArticleView } from './ArticleView'
import { EntryList } from './EntryList'
import type { ListFilters } from './filters'
import { useCodex, type CodexData } from './useCodex'
import { useCodexEntry } from './useCodexEntry'

// Routes inside the Codex:
//   #/codex             list
//   #/codex/<id>        list + article (article only on small screens)
//   #/codex/new         new article
//   #/codex/<id>/edit   edit article
export default function CodexPage({ path }: { path: string[] }) {
  const codex = useCodex()
  const [filters, setFilters] = useState<ListFilters>({ category: 'all', search: '', status: 'all', worldId: 'all' })
  const [first, second] = path
  const route = first === 'new' ? 'new' : first && second === 'edit' ? 'edit' : first ? 'view' : 'list'
  const selectedId = route === 'view' ? first : null

  useEffect(() => {
    window.scrollTo({ top: 0 })
  }, [first, second])

  if (codex.error) {
    return (
      <Panel>
        <EmptyState icon={BookOpen} title="Something went wrong" text={codex.error} />
      </Panel>
    )
  }
  if (!codex.entries) {
    return (
      <div className="grid place-items-center py-24">
        <LoaderCircle aria-label="Loading the Codex" className="size-6 animate-spin text-gold" />
      </div>
    )
  }

  if (route === 'new') return <ArticleEditor codex={codex} entry={null} />
  if (route === 'edit') return <EditRoute id={first} codex={codex} />

  return (
    <div className="space-y-6">
      <header className={`flex flex-wrap items-end gap-4 ${selectedId ? 'hidden lg:flex' : ''}`}>
        <div className="mr-auto flex items-start gap-4">
          <span className="grid size-12 shrink-0 place-items-center rounded-xl border border-line bg-panel text-gold shadow-lg shadow-black/30">
            <BookOpen className="size-6" strokeWidth={1.75} />
          </span>
          <div>
            <h1 className="font-display text-3xl font-semibold text-bone sm:text-4xl">Codex</h1>
            <p className="mt-1 text-ash">The people, places, powers and history of the realm.</p>
          </div>
        </div>
        {codex.isEditor && (
          <a
            href="#/codex/new"
            className="inline-flex items-center gap-2 rounded-lg bg-burgundy px-4 py-2.5 text-sm font-medium text-bone shadow-lg shadow-burgundy/25 transition hover:bg-burgundy-light"
          >
            <Plus className="size-4" />
            New article
          </a>
        )}
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(16rem,22rem)_minmax(0,1fr)]">
        <div className={selectedId ? 'hidden lg:block' : ''}>
          <EntryList codex={codex} filters={filters} onFiltersChange={setFilters} selectedId={selectedId} />
        </div>
        <div className={selectedId ? '' : 'hidden lg:block'}>
          {selectedId ? (
            <ArticleView id={selectedId} codex={codex} />
          ) : (
            <Panel className="lg:sticky lg:top-10">
              <EmptyState
                icon={ScrollText}
                title={codex.entries.length ? 'Choose an article' : 'Nothing to read yet'}
                text={codex.entries.length ? 'Select an entry from the list to read it here.' : 'Articles will appear here once they are written.'}
              />
            </Panel>
          )}
        </div>
      </div>
    </div>
  )
}

function EditRoute({ id, codex }: { id: string; codex: CodexData }) {
  const { loading, entry } = useCodexEntry(id)
  if (loading) {
    return (
      <div className="grid place-items-center py-24">
        <LoaderCircle aria-label="Loading article" className="size-6 animate-spin text-gold" />
      </div>
    )
  }
  if (!entry || !codex.canEdit({ worldId: entry.world_id, campaignId: entry.campaign_id })) {
    return (
      <Panel>
        <EmptyState icon={BookOpen} title="You can't edit this article" text="It may have been removed, or you don't have permission to change it." />
      </Panel>
    )
  }
  return <ArticleEditor key={entry.id} codex={codex} entry={entry} />
}
