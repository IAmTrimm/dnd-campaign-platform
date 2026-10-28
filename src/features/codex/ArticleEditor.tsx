import { ArrowLeft, Eye, EyeOff, Lock, PencilLine, Save, X } from 'lucide-react'
import { useEffect, useMemo, useState, type KeyboardEvent } from 'react'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { navigateTo } from '../../hooks/useHashRoute'
import { supabase } from '../../lib/supabase'
import { DmNotesPanel } from './DmNotesPanel'
import { StatusBadge } from './StatusBadge'
import { RichTextEditor } from './RichTextEditor'
import { CATEGORIES, normaliseTags, type CodexCategory, type CodexEntry, type CodexVisibility } from './types'
import type { CodexData } from './useCodex'

type ArticleEditorProps = {
  codex: CodexData
  entry: CodexEntry | null // null = new article
}

// Who will be able to read the article at each status (matches the database rules).
function audience(visibility: CodexVisibility, worldName: string, campaignName: string | null) {
  if (visibility === 'players') {
    return campaignName
      ? `All players in ${campaignName} will be able to read it.`
      : `Every player in every campaign of ${worldName} will be able to read it.`
  }
  if (visibility === 'dm') {
    return campaignName
      ? `Only the DMs of ${campaignName} and the world Owner will be able to read it. Players won't see it unless it's revealed to them later.`
      : `The world Owner and every DM running a campaign in ${worldName} will be able to read it. Players won't see it unless it's revealed to their campaign later.`
  }
  return campaignName
    ? `Only the DMs of ${campaignName} and the world Owner will see it.`
    : `Only you, as the world Owner, will see it.`
}

const CONFIRM_TITLES: Record<CodexVisibility, string> = {
  players: 'Publish to players?',
  dm: 'Make this article DM only?',
  draft: 'Move back to draft?',
}

export function ArticleEditor({ codex, entry }: ArticleEditorProps) {
  const isNew = entry === null
  const scopes = codex.editableScopes
  const [scopeIndex, setScopeIndex] = useState(0)
  const [name, setName] = useState(entry?.name ?? '')
  const [category, setCategory] = useState<CodexCategory>(entry?.category ?? 'npc')
  const [summary, setSummary] = useState(entry?.summary ?? '')
  const [description, setDescription] = useState<string | null>(entry?.description ?? null)
  const [tags, setTags] = useState<string[]>(entry?.tags ?? [])
  const [tagDraft, setTagDraft] = useState('')
  const [confirming, setConfirming] = useState<CodexVisibility | 'discard' | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const status: CodexVisibility = entry?.visibility ?? 'draft'
  const worldId = entry?.world_id ?? scopes[scopeIndex]?.worldId
  const campaignId = entry ? entry.campaign_id : (scopes[scopeIndex]?.campaignId ?? null)
  const worldName = codex.worlds.find((w) => w.id === worldId)?.name ?? 'this world'
  const campaignName = campaignId ? (codex.campaigns.find((c) => c.id === campaignId)?.name ?? 'this campaign') : null

  const snapshot = JSON.stringify([name, category, summary, description, tags, scopeIndex])
  const [initialSnapshot] = useState(snapshot)
  const dirty = snapshot !== initialSnapshot || tagDraft.trim() !== ''

  // Warn before closing the tab with unsaved changes.
  useEffect(() => {
    if (!dirty) return
    const warn = (event: BeforeUnloadEvent) => event.preventDefault()
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  const allTags = useMemo(() => normaliseTags([...tags, tagDraft]), [tags, tagDraft])
  const addTag = () => {
    setTags(normaliseTags([...tags, ...tagDraft.split(',')]))
    setTagDraft('')
  }
  const onTagKey = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault()
      addTag()
    } else if (event.key === 'Backspace' && tagDraft === '' && tags.length) {
      setTags(tags.slice(0, -1))
    }
  }

  const leave = (id?: string) => navigateTo(id ? `codex/${id}` : entry ? `codex/${entry.id}` : 'codex')

  const save = async (visibility: CodexVisibility) => {
    if (!name.trim()) {
      setConfirming(null)
      setError('Give the article a name before saving.')
      return
    }
    setSaving(true)
    setError(null)
    const fields = { category, name: name.trim(), summary: summary.trim() || null, description, tags: allTags }
    const result = isNew
      ? await supabase
          .from('codex_entries')
          .insert({ ...fields, world_id: worldId, campaign_id: campaignId, visibility: 'draft' })
          .select('id')
          .maybeSingle()
      : await supabase.from('codex_entries').update({ ...fields, visibility }).eq('id', entry.id).select('id').maybeSingle()
    setSaving(false)
    setConfirming(null)
    if (result.error || !result.data) {
      setError("The article couldn't be saved. You may not have permission to edit it, or the connection dropped.")
      return
    }
    codex.reload()
    leave(result.data.id)
  }

  // Changing who can read the article always asks first; saving without a status change doesn't.
  const actions: { visibility: CodexVisibility; label: string; icon: typeof Save; primary?: boolean }[] = isNew
    ? [{ visibility: 'draft', label: 'Save draft', icon: Save, primary: true }]
    : [
        { visibility: status, label: status === 'draft' ? 'Save draft' : 'Save', icon: Save, primary: true },
        ...(status !== 'draft' ? [{ visibility: 'draft' as const, label: 'Move to draft', icon: PencilLine }] : []),
        ...(status !== 'dm' ? [{ visibility: 'dm' as const, label: 'DM only', icon: EyeOff }] : []),
        ...(status !== 'players' ? [{ visibility: 'players' as const, label: 'Publish', icon: Eye }] : []),
      ]

  const labelClass = 'text-sm font-medium text-bone'
  const fieldClass = 'mt-1.5 w-full rounded-lg border border-line bg-charcoal/70 px-3.5 py-2.5 text-bone placeholder:text-faint focus:border-gold/60'

  if (isNew && scopes.length === 0) {
    return <p className="text-ash">You don't have permission to create Codex articles.</p>
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => (dirty ? setConfirming('discard') : leave())}
          className="inline-flex items-center gap-1.5 text-sm text-ash hover:text-bone"
        >
          <ArrowLeft className="size-4" />
          {isNew ? 'Back to the Codex' : 'Back to article'}
        </button>
        <span className="ml-auto flex items-center gap-2 text-sm text-ash">
          {isNew ? 'New article' : 'Editing'}
          <StatusBadge visibility={status} size="md" />
        </span>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_17rem]">
        <div className="space-y-5">
          <label className="block">
            <span className={labelClass}>Name</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={120}
              placeholder="e.g. The Ember Gate"
              className={`${fieldClass} font-display text-2xl font-semibold`}
            />
          </label>
          <label className="block">
            <span className={labelClass}>Summary</span>
            <span className="ml-2 text-xs text-faint">One or two lines, shown in the article list</span>
            <textarea value={summary} onChange={(e) => setSummary(e.target.value)} rows={2} maxLength={300} className={`${fieldClass} resize-y`} />
          </label>
          <div>
            <span id="article-text-label" className={labelClass}>
              Article
            </span>
            <div className="mt-1.5">
              <RichTextEditor initialHtml={entry?.description ?? ''} onChange={setDescription} labelledBy="article-text-label" />
            </div>
          </div>
        </div>

        <aside className="space-y-5">
          <fieldset>
            <legend className={labelClass}>Category</legend>
            <div className="mt-1.5 grid grid-cols-3 gap-1.5 lg:grid-cols-2">
              {CATEGORIES.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setCategory(id)}
                  aria-pressed={category === id}
                  className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-2 text-sm transition-colors ${
                    category === id ? 'border-gold/40 bg-gold/10 text-gold' : 'border-line text-ash hover:text-bone'
                  }`}
                >
                  <Icon className="size-4" strokeWidth={1.75} />
                  {label}
                </button>
              ))}
            </div>
          </fieldset>

          <label className="block">
            <span className={labelClass}>Belongs to</span>
            {isNew ? (
              <select value={scopeIndex} onChange={(e) => setScopeIndex(Number(e.target.value))} className={fieldClass}>
                {scopes.map((scope, index) => (
                  <option key={`${scope.worldId}-${scope.campaignId}`} value={index}>
                    {scope.label}
                  </option>
                ))}
              </select>
            ) : (
              <span className={`${fieldClass} block text-ash`}>{campaignName ?? `${worldName}: world lore`}</span>
            )}
            <span className="mt-1.5 block text-xs leading-relaxed text-faint">
              {isNew ? 'World lore can be shared with every campaign. This can’t be changed after the first save.' : 'This can’t be changed after the first save.'}
            </span>
          </label>

          <div>
            <label htmlFor="tag-input" className={labelClass}>
              Tags
            </label>
            <div className="mt-1.5 flex flex-wrap gap-1.5 rounded-lg border border-line bg-charcoal/70 p-2 focus-within:border-gold/60">
              {tags.map((tag) => (
                <span key={tag} className="inline-flex items-center gap-1 rounded-md bg-white/[0.06] py-0.5 pr-1 pl-2 text-xs text-bone">
                  {tag}
                  <button type="button" onClick={() => setTags(tags.filter((t) => t !== tag))} aria-label={`Remove tag ${tag}`} className="rounded p-0.5 text-faint hover:text-bone">
                    <X className="size-3" />
                  </button>
                </span>
              ))}
              <input
                id="tag-input"
                value={tagDraft}
                onChange={(e) => setTagDraft(e.target.value)}
                onKeyDown={onTagKey}
                onBlur={() => tagDraft.trim() && addTag()}
                placeholder={tags.length ? '' : 'e.g. noble, harbour'}
                className="min-w-24 flex-1 bg-transparent px-1 py-0.5 text-sm text-bone placeholder:text-faint focus-visible:outline-none"
              />
            </div>
            <span className="mt-1.5 block text-xs text-faint">Press Enter or comma to add a tag.</span>
          </div>
        </aside>
      </div>

      {entry ? (
        <DmNotesPanel entry={entry} codex={codex} />
      ) : (
        codex.noteScopes({ world_id: worldId, campaign_id: campaignId }).length > 0 && (
          <p className="flex items-center gap-2 rounded-xl border border-dashed border-burgundy/35 px-4 py-3 text-sm text-ash">
            <Lock className="size-4 text-gold" />
            Save the article first to add private DM notes.
          </p>
        )
      )}

      <div className="sticky bottom-0 z-10 -mx-4 border-t border-line bg-slate/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-10 lg:px-10">
        {error && (
          <p role="alert" className="mb-3 rounded-lg border border-burgundy/40 bg-burgundy-dark/40 px-3.5 py-2.5 text-sm text-bone">
            {error}
          </p>
        )}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <p className="text-xs leading-relaxed text-faint sm:mr-auto sm:max-w-sm">
            {isNew
              ? 'New articles are saved as drafts. You can publish or make them DM only after the first save.'
              : status === 'players'
                ? 'This article is published: saved changes are visible to players straight away.'
                : audience(status, worldName, campaignName)}
          </p>
          <div className="flex flex-wrap gap-2">
            {actions.map(({ visibility, label, icon: Icon, primary }) => (
              <button
                key={label}
                type="button"
                disabled={saving}
                onClick={() => (primary ? save(visibility) : setConfirming(visibility))}
                className={`inline-flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition disabled:opacity-60 sm:flex-none ${
                  primary
                    ? 'bg-burgundy text-bone shadow-lg shadow-burgundy/25 hover:bg-burgundy-light'
                    : 'border border-line bg-white/[0.03] text-bone hover:bg-white/[0.07]'
                }`}
              >
                <Icon className="size-4" />
                {primary && saving ? 'Saving…' : label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {confirming === 'discard' && (
        <ConfirmDialog title="Discard your changes?" confirmLabel="Discard changes" onConfirm={() => leave()} onCancel={() => setConfirming(null)}>
          <p>Your unsaved changes to this article will be lost.</p>
        </ConfirmDialog>
      )}
      {confirming && confirming !== 'discard' && (
        <ConfirmDialog
          title={CONFIRM_TITLES[confirming]}
          confirmLabel={confirming === 'players' ? 'Publish' : confirming === 'dm' ? 'Make DM only' : 'Move to draft'}
          busy={saving}
          onConfirm={() => save(confirming)}
          onCancel={() => setConfirming(null)}
        >
          <p className="text-bone">{audience(confirming, worldName, campaignName)}</p>
          {status === 'players' && <p>Players will no longer be able to read it.</p>}
          {confirming === 'players' && <p>Check it doesn't contain any secrets before publishing.</p>}
          <p>Any other changes you've made will be saved too.</p>
        </ConfirmDialog>
      )}
    </div>
  )
}
