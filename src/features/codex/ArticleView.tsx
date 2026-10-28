import { ArrowLeft, BookX, LoaderCircle, PencilLine, Tag } from 'lucide-react'
import { EmptyState } from '../../components/ui/EmptyState'
import { Panel } from '../../components/ui/Panel'
import { DmNotesPanel } from './DmNotesPanel'
import { RelatedEntries } from './RelatedEntries'
import { RichTextViewer } from './RichTextViewer'
import { StatusBadge } from './StatusBadge'
import { categoryOf } from './types'
import { useCodexEntry } from './useCodexEntry'
import type { CodexData } from './useCodex'

export function ArticleView({ id, codex }: { id: string; codex: CodexData }) {
  const { loading, entry } = useCodexEntry(id)

  if (loading) {
    return (
      <div className="grid place-items-center py-24">
        <LoaderCircle aria-label="Loading article" className="size-6 animate-spin text-gold" />
      </div>
    )
  }

  if (!entry) {
    return (
      <Panel>
        <EmptyState icon={BookX} title="Article not found" text="It may have been removed, or it isn't available to you." />
      </Panel>
    )
  }

  const { icon: Icon, label } = categoryOf(entry.category)
  const canEdit = codex.canEdit({ worldId: entry.world_id, campaignId: entry.campaign_id })
  const updated = new Date(entry.updated_at).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })

  return (
    <div className="space-y-6">
      <article className="relative overflow-hidden rounded-2xl border border-line bg-panel/60 shadow-2xl shadow-black/30">
        <div aria-hidden className="absolute inset-x-0 top-0 h-48 bg-[radial-gradient(ellipse_70%_100%_at_50%_0%,rgba(134,40,54,0.18),transparent_70%)]" />
        <div className="relative px-5 py-6 sm:px-10 sm:py-10">
          <a href="#/codex" className="mb-6 inline-flex items-center gap-1.5 text-sm text-ash hover:text-bone lg:hidden">
            <ArrowLeft className="size-4" />
            All articles
          </a>

          <div className="flex flex-wrap items-center gap-2 text-xs font-medium">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-charcoal/60 px-2.5 py-1 text-gold">
              <Icon className="size-3.5" strokeWidth={2} />
              {label}
            </span>
            <span className="rounded-full border border-line bg-charcoal/60 px-2.5 py-1 text-ash">{codex.scopeLabel(entry)}</span>
            {codex.isEditor ? (
              <StatusBadge visibility={entry.visibility} size="md" />
            ) : (
              entry.visibility === 'dm' && (
                <span className="rounded-full border border-gold/30 bg-gold/10 px-2.5 py-1 text-gold">Discovered</span>
              )
            )}
            {canEdit && (
              <a
                href={`#/codex/${entry.id}/edit`}
                className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-line bg-white/[0.03] px-3 py-1.5 text-sm text-bone hover:bg-white/[0.07]"
              >
                <PencilLine className="size-4" />
                Edit
              </a>
            )}
          </div>

          <h1 className="mt-5 font-display text-4xl leading-tight font-semibold text-bone sm:text-5xl">{entry.name}</h1>
          {entry.summary && <p className="mt-3 max-w-2xl text-lg leading-relaxed text-ash italic">{entry.summary}</p>}

          {entry.tags.length > 0 && (
            <ul className="mt-4 flex flex-wrap gap-1.5" aria-label="Tags">
              {entry.tags.map((tag) => (
                <li key={tag} className="inline-flex items-center gap-1 rounded-md bg-white/[0.05] px-2 py-0.5 text-xs text-ash">
                  <Tag className="size-3" />
                  {tag}
                </li>
              ))}
            </ul>
          )}

          <div className="my-7 h-px bg-linear-to-r from-gold/30 via-line to-transparent" />

          <div className="max-w-3xl">
            {entry.description ? (
              <RichTextViewer html={entry.description} entryIds={codex.entryIds} />
            ) : (
              <p className="text-faint italic">This article has no text yet.</p>
            )}
          </div>

          <p className="mt-10 text-xs text-faint">Last updated {updated}</p>
        </div>
      </article>
      <RelatedEntries key={`related-${entry.id}`}entry={entry} codex={codex} />
      <DmNotesPanel key={entry.id} entry={entry} codex={codex} />
    </div>
  )
}
