import type { LucideIcon } from 'lucide-react'
import {
  ArrowRight,
  BookOpen,
  CalendarDays,
  Compass,
  Crown,
  Feather,
  LoaderCircle,
  Map as MapIcon,
  MapPin,
  Plus,
  RefreshCw,
  ScrollText,
  Shield,
  Sparkles,
  UserRound,
  Users,
} from 'lucide-react'
import { displayNameOf, useAuth } from '../auth/AuthContext'
import { EmptyState } from '../components/ui/EmptyState'
import { Panel } from '../components/ui/Panel'
import { StatusBadge } from '../features/codex/StatusBadge'
import { categoryOf } from '../features/codex/types'
import { useDashboard, type CampaignDetails, type DashboardCampaign, type PartyMember, type RecentEntry } from '../features/dashboard/useDashboard'

const ROLE_LABELS: Record<DashboardCampaign['role'], { label: string; icon: LucideIcon }> = {
  owner: { label: 'World Owner', icon: Crown },
  dm: { label: 'Dungeon Master', icon: Feather },
  player: { label: 'Player', icon: UserRound },
}

// "Today", "Yesterday", "3 days ago", or a date.
function friendlyDate(iso: string) {
  const day = (date: Date) => Math.floor(new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime() / 86_400_000)
  const days = day(new Date()) - day(new Date(iso))
  if (days <= 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 7) return `${days} days ago`
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: days > 300 ? 'numeric' : undefined })
}

export function DashboardPage() {
  const { session } = useAuth()
  const dashboard = useDashboard()
  const { campaign, campaigns, details } = dashboard
  const name = dashboard.name ?? (session ? displayNameOf(session) : 'adventurer')
  const isEditor = campaign !== null && campaign.role !== 'player'

  if (dashboard.loading) {
    return (
      <div className="grid place-items-center py-24">
        <LoaderCircle aria-label="Loading your dashboard" className="size-6 animate-spin text-gold" />
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-2xl border border-line bg-linear-to-br from-panel-raised via-panel to-slate shadow-2xl shadow-black/40">
        <div aria-hidden className="absolute inset-0 bg-[radial-gradient(ellipse_60%_90%_at_100%_0%,rgba(177,62,77,0.22),transparent_60%)]" />
        <Compass aria-hidden className="absolute -right-20 -bottom-28 hidden size-96 text-gold/[0.05] sm:block" strokeWidth={0.6} />
        <div className="relative grid gap-8 p-6 sm:p-10 lg:grid-cols-[1fr_auto] lg:items-end">
          <div className="max-w-xl min-w-0">
            <p className="flex items-center gap-2 text-xs font-medium tracking-[0.16em] text-gold/80 uppercase">
              <span className="h-px w-6 bg-gold/50" />
              {campaign ? campaign.worldName : 'Campaign dashboard'}
            </p>
            <h1 className="mt-4 font-display text-4xl leading-tight font-semibold text-bone sm:text-5xl">Welcome back, {name}</h1>
            {campaign ? (
              <div className="mt-4 flex flex-wrap items-center gap-2.5">
                <p className="font-display text-2xl text-bone/90">{campaign.name}</p>
                <RoleBadge role={campaign.role} />
              </div>
            ) : (
              <p className="mt-4 leading-relaxed text-ash">You're not part of a campaign yet. Once your DM adds you, it will appear here.</p>
            )}
            {campaigns.length > 1 && campaign && (
              <label className="mt-5 block max-w-sm">
                <span className="text-xs font-medium tracking-wide text-faint uppercase">Switch campaign</span>
                <select
                  value={campaign.id}
                  onChange={(event) => dashboard.chooseCampaign(event.target.value)}
                  className="mt-1.5 w-full rounded-lg border border-line bg-charcoal/70 px-3.5 py-2.5 text-sm text-bone focus:border-gold/60"
                >
                  {[...new Set(campaigns.map((c) => c.worldName))].map((world) => (
                    <optgroup key={world} label={world}>
                      {campaigns
                        .filter((c) => c.worldName === world)
                        .map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name} ({ROLE_LABELS[c.role].label})
                          </option>
                        ))}
                    </optgroup>
                  ))}
                </select>
              </label>
            )}
            <div className="mt-7 flex flex-wrap gap-3">
              <a
                href="#/codex"
                className="inline-flex items-center gap-2 rounded-lg bg-burgundy px-4 py-2.5 text-sm font-medium text-bone shadow-lg shadow-burgundy/25 transition hover:bg-burgundy-light"
              >
                Open the Codex
                <ArrowRight className="size-4" />
              </a>
              {isEditor && (
                <a
                  href="#/codex/new"
                  className="inline-flex items-center gap-2 rounded-lg border border-line bg-white/[0.03] px-4 py-2.5 text-sm font-medium text-bone transition hover:bg-white/[0.07]"
                >
                  <Plus className="size-4" />
                  New article
                </a>
              )}
            </div>
          </div>

          <div className="w-full rounded-xl border border-line bg-charcoal/60 p-5 backdrop-blur lg:w-64">
            <p className="flex items-center gap-2 text-xs font-medium tracking-[0.14em] text-faint uppercase">
              <CalendarDays className="size-4" strokeWidth={1.75} />
              Next session
            </p>
            <p className="mt-3 font-display text-2xl font-semibold text-bone">Coming soon</p>
            <p className="mt-1 text-sm text-ash">Session dates will appear here once session scheduling is added.</p>
          </div>
        </div>
      </section>

      {dashboard.error ? (
        <Panel>
          <div className="flex flex-col items-center px-6 py-12 text-center" role="alert">
            <p className="font-medium text-bone">Something went wrong</p>
            <p className="mt-1 max-w-sm text-sm text-ash">{dashboard.error}</p>
            <button
              type="button"
              onClick={dashboard.retry}
              className="mt-5 inline-flex items-center gap-2 rounded-lg border border-line bg-white/[0.03] px-4 py-2 text-sm text-bone hover:bg-white/[0.07]"
            >
              <RefreshCw className="size-4" />
              Try again
            </button>
          </div>
        </Panel>
      ) : campaign ? (
        <CampaignOverview campaign={campaign} details={details} />
      ) : (
        <Panel>
          <EmptyState icon={Compass} title="No campaign yet" text="Ask your Dungeon Master to add you to their campaign. Its articles and party will then appear here." />
        </Panel>
      )}

      <ComingSoon />
    </div>
  )
}

function RoleBadge({ role }: { role: DashboardCampaign['role'] }) {
  const { label, icon: Icon } = ROLE_LABELS[role]
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${
        role === 'player' ? 'border-line bg-charcoal/60 text-ash' : 'border-burgundy-light/40 bg-burgundy/15 text-[#d46b79]'
      }`}
    >
      <Icon className="size-3.5" strokeWidth={2} />
      {label}
    </span>
  )
}

function CampaignOverview({ campaign, details }: { campaign: DashboardCampaign; details: CampaignDetails | null }) {
  const isEditor = campaign.role !== 'player'
  const stats = details?.stats
  const tiles: { label: string; icon: LucideIcon; value?: number; note?: string }[] = [
    {
      label: 'Codex articles',
      icon: BookOpen,
      value: stats?.total,
      // Draft and secret counts are only for the people who can read them.
      note: isEditor && stats ? `${stats.drafts} draft${stats.drafts === 1 ? '' : 's'} · ${stats.secrets} DM only` : undefined,
    },
    { label: 'NPCs', icon: UserRound, value: stats?.byCategory.npc },
    { label: 'Locations', icon: MapPin, value: stats?.byCategory.location },
    { label: 'Factions', icon: Shield, value: stats?.byCategory.faction },
  ]

  return (
    <>
      <section aria-label={`${campaign.name} at a glance`} aria-busy={!details} className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {tiles.map(({ label, icon: Icon, value, note }) => (
          <Panel key={label} className="p-4 sm:p-5">
            <div className="flex items-center justify-between text-faint">
              <span className="text-xs font-medium sm:text-sm">{label}</span>
              <Icon className="size-4 text-gold/80" strokeWidth={1.75} />
            </div>
            {value === undefined ? (
              <span aria-hidden className="mt-3 block h-8 w-12 animate-pulse rounded-md bg-white/[0.06]" />
            ) : (
              <p className="mt-2 font-display text-4xl font-semibold text-bone [font-variant-numeric:lining-nums_tabular-nums]">{value}</p>
            )}
            {note && <p className="mt-1 text-xs text-faint">{note}</p>}
          </Panel>
        ))}
      </section>

      <section className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Panel>
          <div className="flex items-center justify-between border-b border-line px-5 py-4">
            <h2 className="font-semibold text-bone">Recently updated in the Codex</h2>
            <a href="#/codex" className="text-sm text-gold hover:underline">
              View all
            </a>
          </div>
          {!details ? (
            <ListSkeleton rows={4} />
          ) : details.recent.length === 0 ? (
            <div className="pb-2">
              <EmptyState
                icon={BookOpen}
                title="The Codex is still empty"
                text={
                  isEditor
                    ? `No articles for ${campaign.name} or its world yet. Write the first one to start building the realm.`
                    : `Your DM hasn't shared any articles for ${campaign.name} yet. Check back after the next session.`
                }
              />
              {isEditor && (
                <div className="-mt-4 flex justify-center pb-8">
                  <a href="#/codex/new" className="inline-flex items-center gap-2 rounded-lg bg-burgundy px-4 py-2 text-sm font-medium text-bone hover:bg-burgundy-light">
                    <Plus className="size-4" />
                    Write an article
                  </a>
                </div>
              )}
            </div>
          ) : (
            <ul className="divide-y divide-line">
              {details.recent.map((entry) => (
                <RecentRow key={entry.id} entry={entry} campaign={campaign} />
              ))}
            </ul>
          )}
        </Panel>

        <Panel>
          <div className="flex items-center justify-between border-b border-line px-5 py-4">
            <h2 className="font-semibold text-bone">The party</h2>
            <Users className="size-4 text-faint" strokeWidth={1.75} />
          </div>
          {!details ? <ListSkeleton rows={3} /> : <Party members={details.party} />}
        </Panel>
      </section>
    </>
  )
}

function RecentRow({ entry, campaign }: { entry: RecentEntry; campaign: DashboardCampaign }) {
  const { icon: Icon, label } = categoryOf(entry.category)
  const isNew = new Date(entry.updated_at).getTime() - new Date(entry.created_at).getTime() < 60_000
  return (
    <li>
      <a href={`#/codex/${entry.id}`} className="group flex items-center gap-3.5 px-5 py-3.5 transition-colors hover:bg-white/[0.03]">
        <span className="grid size-10 shrink-0 place-items-center rounded-lg border border-line bg-charcoal/60 text-gold">
          <Icon aria-label={label} className="size-5" strokeWidth={1.75} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="truncate font-medium text-bone group-hover:text-gold">{entry.name}</span>
            {campaign.role !== 'player' && entry.visibility !== 'players' && <StatusBadge visibility={entry.visibility} />}
          </span>
          <span className="block truncate text-sm text-ash">{entry.summary || `${label} · ${entry.campaign_id ? campaign.name : 'World lore'}`}</span>
        </span>
        <span className="hidden shrink-0 text-right text-xs text-faint sm:block">
          {isNew ? 'Added' : 'Updated'}
          <br />
          {friendlyDate(entry.updated_at)}
        </span>
      </a>
    </li>
  )
}

function Party({ members }: { members: PartyMember[] }) {
  if (members.every((m) => m.role !== 'player')) {
    return <EmptyState icon={Users} title="No players yet" text="Players will appear here once the DM adds them to the campaign." />
  }
  return (
    <ul className="space-y-1 p-3">
      {members.map((member) => (
        <li key={member.id} className="flex items-center gap-3 rounded-lg px-2 py-2">
          <span aria-hidden className="grid size-8 shrink-0 place-items-center rounded-full border border-line bg-panel font-display text-sm font-semibold text-gold">
            {member.name.charAt(0).toUpperCase()}
          </span>
          <span className="min-w-0 flex-1 truncate text-sm text-bone">{member.name}</span>
          {member.role === 'dm' && <span className="rounded-full border border-burgundy-light/40 px-2 py-0.5 text-[11px] font-medium text-[#d46b79]">DM</span>}
        </li>
      ))}
    </ul>
  )
}

function ListSkeleton({ rows }: { rows: number }) {
  return (
    <ul aria-label="Loading" className="space-y-3 p-5">
      {Array.from({ length: rows }, (_, index) => (
        <li key={index} className="flex animate-pulse items-center gap-3">
          <span className="size-10 rounded-lg bg-white/[0.05]" />
          <span className="flex-1 space-y-2">
            <span className="block h-3 w-1/2 rounded bg-white/[0.06]" />
            <span className="block h-3 w-3/4 rounded bg-white/[0.04]" />
          </span>
        </li>
      ))}
    </ul>
  )
}

// Modules that don't exist yet: shown honestly, with no made-up records.
function ComingSoon() {
  const modules = [
    { title: 'Quests', text: 'Active, completed and rumoured quests will be tracked here.', icon: MapIcon },
    { title: 'Session recaps', text: 'Recaps of each game session will be collected here.', icon: ScrollText },
  ]
  return (
    <section aria-label="Coming soon" className="grid gap-4 sm:grid-cols-2">
      {modules.map(({ title, text, icon: Icon }) => (
        <div key={title} className="flex items-start gap-4 rounded-xl border border-dashed border-line bg-panel/30 p-5">
          <span className="grid size-10 shrink-0 place-items-center rounded-lg border border-line bg-charcoal/60 text-faint">
            <Icon className="size-5" strokeWidth={1.75} />
          </span>
          <div>
            <h2 className="flex flex-wrap items-center gap-2 font-semibold text-bone">
              {title}
              <span className="inline-flex items-center gap-1 rounded-full border border-gold/25 bg-gold/5 px-2 py-0.5 text-[11px] font-medium text-gold/80">
                <Sparkles className="size-3" />
                Coming soon
              </span>
            </h2>
            <p className="mt-1 text-sm leading-relaxed text-ash">{text}</p>
          </div>
        </div>
      ))}
    </section>
  )
}
