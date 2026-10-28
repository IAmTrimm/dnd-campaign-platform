import { ArrowLeftRight, EyeOff, Link2, LoaderCircle, PencilLine, Plus, Save, Trash2, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { supabase } from '../../lib/supabase'
import { EntryPicker } from './EntryPicker'
import { CATEGORIES, categoryOf, type CodexListItem, type CodexVisibility } from './types'
import type { CodexData } from './useCodex'

// Mirrors the codex_links table (B011 migration).
type Link = {
  id: string
  world_id: string
  campaign_id: string | null
  from_entry_id: string
  to_entry_id: string
  relation: string
  visibility: CodexVisibility
}

const RELATION_SUGGESTIONS = ['Lives in', 'Member of', 'Leader of', 'Owns', 'Located in', 'Part of', 'Ally of', 'Enemy of', 'Associated with']

// "this location", "this NPC"...
const thisNoun = (entry: CodexListItem) => (entry.category === 'lore' ? 'this article' : `this ${categoryOf(entry.category).label.toLowerCase().replace('npc', 'NPC')}`)
const capitalise = (text: string) => text.charAt(0).toUpperCase() + text.slice(1)

// Relationships between this article and others. The database only returns
// links the user may know about: the link itself and both articles must be
// visible to them. A link to anything not in the user's article list is skipped.
export function RelatedEntries({ entry, codex }: { entry: CodexListItem; codex: CodexData }) {
  const [links, setLinks] = useState<Link[] | null>(null)
  const [version, setVersion] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState<Link | 'new' | null>(null)
  const [removing, setRemoving] = useState<Link | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let cancelled = false
    supabase
      .from('codex_links')
      .select('id, world_id, campaign_id, from_entry_id, to_entry_id, relation, visibility')
      .or(`from_entry_id.eq.${entry.id},to_entry_id.eq.${entry.id}`)
      .then(({ data, error }) => {
        if (cancelled) return
        if (error) setError('The related articles could not be loaded.')
        else setLinks(data as Link[])
      })
    return () => {
      cancelled = true
    }
  }, [entry.id, version])

  const byId = useMemo(() => new Map(codex.entries?.map((e) => [e.id, e])), [codex.entries])
  const rows = useMemo(() => {
    const order = (e: CodexListItem) => CATEGORIES.findIndex((c) => c.id === e.category)
    return (links ?? [])
      .map((link) => {
        const outgoing = link.from_entry_id === entry.id
        const other = byId.get(outgoing ? link.to_entry_id : link.from_entry_id)
        return other ? { link, other, outgoing } : null
      })
      .filter((row) => row !== null)
      .sort((a, b) => order(a.other) - order(b.other) || a.other.name.localeCompare(b.other.name))
  }, [links, byId, entry.id])

  const canAdd = codex.canLink(entry)
  if (!canAdd && rows.length === 0) return null

  const done = () => {
    setForm(null)
    setVersion((v) => v + 1)
  }
  const remove = async () => {
    if (!removing) return
    setBusy(true)
    const { data, error } = await supabase.from('codex_links').delete().eq('id', removing.id).select('id')
    setBusy(false)
    setRemoving(null)
    if (error || !data?.length) setError("The relationship couldn't be removed. You may not have permission.")
    else done()
  }

  return (
    <section aria-labelledby="related-title" className="@container rounded-2xl border border-line bg-panel/60 px-5 py-5 shadow-xl shadow-black/25 sm:px-8 sm:py-6">
      <div className="flex flex-wrap items-center gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-lg border border-line bg-charcoal/60 text-gold">
          <Link2 className="size-4" strokeWidth={2} />
        </span>
        <h2 id="related-title" className="mr-auto font-display text-2xl font-semibold text-bone">
          Related entries
        </h2>
        {canAdd && form === null && (
          <button
            type="button"
            onClick={() => setForm('new')}
            className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-white/[0.03] px-3 py-1.5 text-sm text-bone hover:bg-white/[0.07]"
          >
            <Plus className="size-4" />
            Add relationship
          </button>
        )}
      </div>

      {form !== null && (
        <RelationForm entry={entry} codex={codex} link={form === 'new' ? null : form} byId={byId} onDone={done} onCancel={() => setForm(null)} />
      )}

      <div className="mt-4">
        {links === null && !error ? (
          <LoaderCircle aria-label="Loading related articles" className="size-5 animate-spin text-gold" />
        ) : rows.length === 0 ? (
          <p className="text-sm text-faint italic">No related articles yet.</p>
        ) : (
          <ul className="grid gap-2 @xl:grid-cols-2">
            {rows.map(({ link, other, outgoing }) => {
              const { icon: Icon, label } = categoryOf(other.category)
              const editable = codex.canEdit({ worldId: link.world_id, campaignId: link.campaign_id })
              const hiddenFromPlayers = link.visibility !== 'players' || other.visibility !== 'players' || entry.visibility !== 'players'
              const campaign = !entry.campaign_id && link.campaign_id ? codex.campaigns.find((c) => c.id === link.campaign_id)?.name : null
              const caption = outgoing ? capitalise(link.relation) : `${capitalise(link.relation)} ${thisNoun(entry)}`
              return (
                <li key={link.id} className="group relative flex items-center gap-3 rounded-xl border border-line bg-charcoal/50 p-3 transition-colors hover:border-gold/35 hover:bg-white/[0.04]">
                  <span className="grid size-10 shrink-0 place-items-center rounded-lg border border-line bg-panel text-gold">
                    <Icon aria-label={label} className="size-5" strokeWidth={1.75} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs text-ash">{caption}</span>
                    <a href={`#/codex/${other.id}`} className="block truncate font-medium text-bone after:absolute after:inset-0 after:rounded-xl group-hover:text-gold">
                      {other.name}
                    </a>
                    {codex.isEditor && (hiddenFromPlayers || campaign) && (
                      <span className="mt-0.5 flex flex-wrap gap-x-2 text-[11px] text-faint">
                        {link.visibility !== 'players' ? (
                          <span className="inline-flex items-center gap-1 text-[#d46b79]">
                            <EyeOff className="size-3" />
                            Secret
                          </span>
                        ) : (
                          hiddenFromPlayers && <span title="Players only see a relationship once they can read both articles">Not yet visible to players</span>
                        )}
                        {campaign && <span>{campaign} only</span>}
                      </span>
                    )}
                  </span>
                  {editable && (
                    // Above the full-card link, so these stay clickable.
                    <span className="relative z-10 flex shrink-0 gap-0.5">
                      <button type="button" onClick={() => setForm(link)} aria-label={`Change relationship with ${other.name}`} title="Change" className="rounded-md p-1.5 text-faint hover:bg-white/[0.06] hover:text-bone">
                        <PencilLine className="size-4" />
                      </button>
                      <button type="button" onClick={() => setRemoving(link)} aria-label={`Remove relationship with ${other.name}`} title="Remove" className="rounded-md p-1.5 text-faint hover:bg-white/[0.06] hover:text-bone">
                        <Trash2 className="size-4" />
                      </button>
                    </span>
                  )}
                </li>
              )
            })}
          </ul>
        )}
        {error && (
          <p role="alert" className="mt-3 rounded-lg border border-burgundy/40 bg-burgundy-dark/40 px-3.5 py-2.5 text-sm text-bone">
            {error}
          </p>
        )}
      </div>

      {removing && (
        <ConfirmDialog title="Remove this relationship?" confirmLabel="Remove" busy={busy} onConfirm={remove} onCancel={() => setRemoving(null)}>
          <p>Both articles stay as they are; only the link between them is removed.</p>
        </ConfirmDialog>
      )}
    </section>
  )
}

type RelationFormProps = {
  entry: CodexListItem
  codex: CodexData
  link: Link | null // null = new relationship
  byId: Map<string, CodexListItem>
  onDone: () => void
  onCancel: () => void
}

function RelationForm({ entry, codex, link, byId, onDone, onCancel }: RelationFormProps) {
  const [other, setOther] = useState<CodexListItem | null>(link ? (byId.get(link.from_entry_id === entry.id ? link.to_entry_id : link.from_entry_id) ?? null) : null)
  const [outgoing, setOutgoing] = useState(link ? link.from_entry_id === entry.id : true)
  const [relation, setRelation] = useState(link?.relation ?? '')
  const [visibility, setVisibility] = useState<CodexVisibility>(link?.visibility === 'players' ? 'players' : 'dm')
  const [scopeIndex, setScopeIndex] = useState(0)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Articles this user could link to from here.
  const candidates = useMemo(
    () => (codex.entries ?? []).filter((e) => e.id !== entry.id && codex.linkScopes(entry, e).length > 0),
    [codex, entry],
  )
  const scopes = other && !link ? codex.linkScopes(entry, other) : []
  const scope = scopes[Math.min(scopeIndex, scopes.length - 1)]
  const [from, to] = outgoing ? [entry, other] : [other, entry]
  const OtherIcon = other ? categoryOf(other.category).icon : Link2

  const save = async () => {
    const text = relation.trim().replace(/\s+/g, ' ')
    if (!other || !text) {
      setError(!other ? 'Choose the related article.' : 'Describe the relationship, e.g. “Lives in”.')
      return
    }
    setSaving(true)
    setError(null)
    const result = link
      ? await supabase.from('codex_links').update({ relation: text, visibility }).eq('id', link.id).select('id')
      : await supabase
          .from('codex_links')
          .insert({ world_id: entry.world_id, campaign_id: scope.campaignId, from_entry_id: from!.id, to_entry_id: to!.id, relation: text, visibility })
          .select('id')
    setSaving(false)
    if (result.error?.code === '23505') setError('That relationship already exists.')
    else if (result.error || !result.data?.length) setError("The relationship couldn't be saved. You may not have permission, or the connection dropped.")
    else onDone()
  }

  const labelClass = 'text-sm font-medium text-bone'
  const scopeName = (campaignId: string | null) =>
    campaignId ? `${codex.campaigns.find((c) => c.id === campaignId)?.name ?? 'Campaign'} only` : 'All campaigns in the world'

  return (
    <div className="mt-4 space-y-4 rounded-xl border border-gold/25 bg-charcoal/60 p-4">
      <div className="flex items-center gap-2">
        <h3 className="mr-auto font-medium text-bone">{link ? 'Change relationship' : 'New relationship'}</h3>
        <button type="button" onClick={onCancel} aria-label="Close" className="rounded-md p-1 text-faint hover:text-bone">
          <X className="size-4" />
        </button>
      </div>

      {other ? (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-ash">Related article:</span>
          <span className="inline-flex items-center gap-1.5 rounded-md border border-line bg-panel px-2 py-1 text-bone">
            <OtherIcon className="size-3.5 text-gold" />
            {other.name}
          </span>
          {!link && (
            <button type="button" onClick={() => setOther(null)} className="text-xs text-gold hover:underline">
              Change
            </button>
          )}
        </div>
      ) : (
        <div>
          <span className={labelClass}>Related article</span>
          <div className="mt-1.5">
            <EntryPicker
              entries={candidates}
              onSelect={(e) => {
                setOther(e)
                setScopeIndex(0)
              }}
              describe={codex.scopeLabel}
              label="Search for the related article"
              autoFocus
              onEscape={onCancel}
            />
          </div>
        </div>
      )}

      <label className="block">
        <span className={labelClass}>Relationship</span>
        <input
          value={relation}
          onChange={(e) => setRelation(e.target.value)}
          maxLength={60}
          placeholder="e.g. Lives in"
          className="mt-1.5 w-full rounded-lg border border-line bg-charcoal/70 px-3.5 py-2 text-bone placeholder:text-faint focus:border-gold/60"
        />
      </label>
      <div className="-mt-2 flex flex-wrap gap-1.5" aria-label="Suggestions">
        {RELATION_SUGGESTIONS.map((suggestion) => (
          <button
            key={suggestion}
            type="button"
            onClick={() => setRelation(suggestion)}
            className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${
              relation === suggestion ? 'border-gold/40 bg-gold/10 text-gold' : 'border-line text-ash hover:text-bone'
            }`}
          >
            {suggestion}
          </button>
        ))}
      </div>

      {other && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-line bg-panel/70 px-3 py-2 text-sm">
          <p className="mr-auto text-ash">
            Reads as: <span className="text-bone">{from!.name}</span> <span className="text-gold">{relation.trim().toLowerCase() || '…'}</span>{' '}
            <span className="text-bone">{to!.name}</span>
          </p>
          {!link && (
            <button type="button" onClick={() => setOutgoing(!outgoing)} className="inline-flex items-center gap-1 text-xs text-gold hover:underline">
              <ArrowLeftRight className="size-3.5" />
              Swap direction
            </button>
          )}
        </div>
      )}

      <fieldset>
        <legend className={labelClass}>Who can see it</legend>
        <div className="mt-1.5 grid gap-1.5 sm:grid-cols-2">
          {(
            [
              ['players', 'Players', 'Once they can read both articles'],
              ['dm', 'Secret', 'DMs and the world Owner only'],
            ] as const
          ).map(([value, title, hint]) => (
            <button
              key={value}
              type="button"
              aria-pressed={visibility === value}
              onClick={() => setVisibility(value)}
              className={`rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                visibility === value ? 'border-gold/40 bg-gold/10 text-gold' : 'border-line text-ash hover:text-bone'
              }`}
            >
              <span className="block font-medium">{title}</span>
              <span className="block text-xs text-faint">{hint}</span>
            </button>
          ))}
        </div>
      </fieldset>

      {scopes.length > 1 && (
        <label className="block">
          <span className={labelClass}>Shared with</span>
          <select
            value={scopeIndex}
            onChange={(e) => setScopeIndex(Number(e.target.value))}
            className="mt-1.5 w-full rounded-lg border border-line bg-charcoal/70 px-3.5 py-2 text-bone focus:border-gold/60"
          >
            {scopes.map((s, index) => (
              <option key={s.campaignId ?? 'world'} value={index}>
                {scopeName(s.campaignId)}
              </option>
            ))}
          </select>
        </label>
      )}
      {scopes.length === 1 && scope.campaignId && !entry.campaign_id && !other?.campaign_id && (
        <p className="text-xs text-faint">Only {scopeName(scope.campaignId).replace(' only', '')} will see this relationship.</p>
      )}

      {error && (
        <p role="alert" className="rounded-lg border border-burgundy/40 bg-burgundy-dark/40 px-3.5 py-2.5 text-sm text-bone">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-lg bg-burgundy px-4 py-2 text-sm font-medium text-bone shadow-lg shadow-burgundy/25 hover:bg-burgundy-light disabled:opacity-60"
        >
          <Save className="size-4" />
          {saving ? 'Saving…' : link ? 'Save changes' : 'Add relationship'}
        </button>
        <button type="button" onClick={onCancel} disabled={saving} className="rounded-lg border border-line px-4 py-2 text-sm font-medium text-bone hover:bg-white/[0.06]">
          Cancel
        </button>
      </div>
    </div>
  )
}
