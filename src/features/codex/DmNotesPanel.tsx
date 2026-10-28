import { LoaderCircle, Lock, PencilLine, Plus, Save } from 'lucide-react'
import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { RichTextEditor } from './RichTextEditor'
import { RichTextViewer } from './RichTextViewer'
import type { CodexListItem } from './types'
import type { CodexData } from './useCodex'

type Note = { id: string; campaign_id: string | null; body: string; updated_at: string }

// Private DM notes on an article. Only shown to people with at least one note
// section; the database only ever returns notes the user is allowed to read.
export function DmNotesPanel({ entry, codex }: { entry: Pick<CodexListItem, 'id' | 'world_id' | 'campaign_id'>; codex: CodexData }) {
  const scopes = codex.noteScopes(entry)
  const [notes, setNotes] = useState<Note[] | null>(null)
  const [version, setVersion] = useState(0)
  const [active, setActive] = useState(0)
  const [draft, setDraft] = useState<string | null | undefined>(undefined) // undefined = not editing
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const hasScopes = scopes.length > 0

  useEffect(() => {
    if (!hasScopes) return
    let cancelled = false
    supabase
      .from('codex_notes')
      .select('id, campaign_id, body, updated_at')
      .eq('entry_id', entry.id)
      .then(({ data, error }) => {
        if (cancelled) return
        if (error) setError('The DM notes could not be loaded.')
        else setNotes(data as Note[])
      })
    return () => {
      cancelled = true
    }
  }, [entry.id, hasScopes, version])

  if (!hasScopes) return null

  const scope = scopes[Math.min(active, scopes.length - 1)]
  const note = notes?.find((n) => n.campaign_id === scope.campaignId)
  const editing = draft !== undefined

  const save = async () => {
    setSaving(true)
    setError(null)
    const body = draft ?? null
    // Clearing all the text deletes the note.
    const result =
      body === null
        ? note
          ? await supabase.from('codex_notes').delete().eq('id', note.id).select('id')
          : { data: [{}], error: null }
        : note
          ? await supabase.from('codex_notes').update({ body }).eq('id', note.id).select('id')
          : await supabase
              .from('codex_notes')
              .insert({ entry_id: entry.id, world_id: entry.world_id, campaign_id: scope.campaignId, body })
              .select('id')
    setSaving(false)
    if (result.error || !result.data?.length) {
      setError("The notes couldn't be saved. You may not have permission, or the connection dropped.")
      return
    }
    setDraft(undefined)
    setVersion((v) => v + 1)
  }

  return (
    <section
      aria-labelledby="dm-notes-title"
      className="relative overflow-hidden rounded-2xl border border-burgundy/35 bg-linear-to-br from-burgundy-dark/35 to-panel/70 shadow-xl shadow-black/30"
    >
      <div className="px-5 py-5 sm:px-8 sm:py-6">
        <div className="flex flex-wrap items-start gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-lg border border-burgundy-light/30 bg-burgundy/30 text-gold">
            <Lock className="size-4" strokeWidth={2} />
          </span>
          <div className="mr-auto">
            <h2 id="dm-notes-title" className="font-display text-2xl font-semibold text-bone">
              DM Notes
            </h2>
            <p className="text-sm text-ash">Private: never shown to players. Saved separately from the article.</p>
          </div>
        </div>

        {scopes.length > 1 && (
          <div role="tablist" aria-label="Note sections" className="mt-5 flex flex-wrap gap-1.5">
            {scopes.map((s, index) => {
              const selected = index === active
              const filled = notes?.some((n) => n.campaign_id === s.campaignId)
              return (
                <button
                  key={s.campaignId ?? 'owner'}
                  role="tab"
                  type="button"
                  aria-selected={selected}
                  disabled={editing}
                  onClick={() => setActive(index)}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50 ${
                    selected ? 'border-gold/40 bg-gold/10 text-gold' : 'border-line text-ash hover:text-bone'
                  }`}
                >
                  {s.label}
                  {filled && <span aria-label="has notes" className="size-1.5 rounded-full bg-burgundy-light" />}
                </button>
              )
            })}
          </div>
        )}

        <p className="mt-4 text-xs text-faint">
          {scopes.length === 1 && <span className="font-medium text-ash">{scope.label}. </span>}
          Visible to: {scope.audience}.
        </p>

        <div className="mt-3">
          {notes === null && !error ? (
            <LoaderCircle aria-label="Loading notes" className="size-5 animate-spin text-gold" />
          ) : editing ? (
            <div className="space-y-3">
              <span id="dm-notes-editor-label" className="sr-only">
                {scope.label}
              </span>
              <RichTextEditor key={scope.campaignId ?? 'owner'} initialHtml={note?.body ?? ''} onChange={setDraft} labelledBy="dm-notes-editor-label" linking={codex.articleLinking(entry)} />
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={save}
                  disabled={saving}
                  className="inline-flex items-center gap-2 rounded-lg bg-burgundy px-4 py-2 text-sm font-medium text-bone shadow-lg shadow-burgundy/25 hover:bg-burgundy-light disabled:opacity-60"
                >
                  <Save className="size-4" />
                  {saving ? 'Saving…' : 'Save notes'}
                </button>
                <button
                  type="button"
                  onClick={() => setDraft(undefined)}
                  disabled={saving}
                  className="rounded-lg border border-line px-4 py-2 text-sm font-medium text-bone hover:bg-white/[0.06]"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : note ? (
            <div className="space-y-3">
              <RichTextViewer html={note.body} entryIds={codex.entryIds} />
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => setDraft(note.body)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-white/[0.03] px-3 py-1.5 text-sm text-bone hover:bg-white/[0.07]"
                >
                  <PencilLine className="size-4" />
                  Edit notes
                </button>
                <span className="text-xs text-faint">
                  Updated {new Date(note.updated_at).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })}
                </span>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-3">
              <p className="text-sm text-faint italic">No notes yet.</p>
              <button
                type="button"
                onClick={() => setDraft(null)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-white/[0.03] px-3 py-1.5 text-sm text-bone hover:bg-white/[0.07]"
              >
                <Plus className="size-4" />
                Add notes
              </button>
            </div>
          )}
          {error && (
            <p role="alert" className="mt-3 rounded-lg border border-burgundy/40 bg-burgundy-dark/40 px-3.5 py-2.5 text-sm text-bone">
              {error}
            </p>
          )}
        </div>
      </div>
    </section>
  )
}
