import {
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  CalendarDays,
  Compass,
  Feather,
  Hourglass,
  Map as MapIcon,
  ScrollText,
  Users,
} from 'lucide-react'
import { useAuth } from '../auth/AuthContext'
import { visibleNavItems } from '../config/navigation'
import { EmptyState } from '../components/ui/EmptyState'
import { Panel } from '../components/ui/Panel'

// Placeholder figures until campaign data is connected.
const stats = [
  { label: 'Active quests', icon: MapIcon },
  { label: 'Sessions played', icon: ScrollText },
  { label: 'Party members', icon: Users },
  { label: 'Codex entries', icon: BookOpen },
]

export function DashboardPage() {
  const { isDm: showDmSections } = useAuth()
  const sections = visibleNavItems(showDmSections).filter((item) => item.path !== 'dashboard')

  return (
    <div className="space-y-10">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-2xl border border-line bg-linear-to-br from-panel-raised via-panel to-slate shadow-2xl shadow-black/40">
        <div
          aria-hidden
          className="absolute inset-0 bg-[radial-gradient(ellipse_60%_90%_at_100%_0%,rgba(177,62,77,0.22),transparent_60%)]"
        />
        <Compass
          aria-hidden
          className="absolute -right-20 -bottom-28 hidden size-96 text-gold/[0.05] sm:block"
          strokeWidth={0.6}
        />
        <div className="relative grid gap-8 p-6 sm:p-10 lg:grid-cols-[1fr_auto] lg:items-end">
          <div className="max-w-xl">
            <p className="flex items-center gap-2 text-xs font-medium tracking-[0.16em] text-gold/80 uppercase">
              <span className="h-px w-6 bg-gold/50" />
              Campaign dashboard
            </p>
            <h1 className="mt-4 font-display text-4xl leading-tight font-semibold text-bone sm:text-5xl">
              Welcome back, adventurer
            </h1>
            <p className="mt-4 leading-relaxed text-ash">
              Your companion for the lore, quests and stories told around the table. Pick up where
              the party left off, or explore what the realm has to offer.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <a
                href="#/codex"
                className="inline-flex items-center gap-2 rounded-lg bg-burgundy px-4 py-2.5 text-sm font-medium text-bone shadow-lg shadow-burgundy/25 transition hover:bg-burgundy-light"
              >
                Open the Codex
                <ArrowRight className="size-4" />
              </a>
              <a
                href="#/sessions"
                className="inline-flex items-center gap-2 rounded-lg border border-line bg-white/[0.03] px-4 py-2.5 text-sm font-medium text-bone transition hover:bg-white/[0.07]"
              >
                Session log
              </a>
            </div>
          </div>

          <div className="w-full rounded-xl border border-line bg-charcoal/60 p-5 backdrop-blur lg:w-64">
            <p className="flex items-center gap-2 text-xs font-medium tracking-[0.14em] text-faint uppercase">
              <CalendarDays className="size-4" strokeWidth={1.75} />
              Next session
            </p>
            <p className="mt-3 font-display text-2xl font-semibold text-bone">Not yet scheduled</p>
            <p className="mt-1 text-sm text-ash">The DM will announce the next date.</p>
          </div>
        </div>
      </section>

      {/* At a glance */}
      <section className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {stats.map(({ label, icon: Icon }) => (
          <Panel key={label} className="p-4 sm:p-5">
            <div className="flex items-center justify-between text-faint">
              <span className="text-xs font-medium sm:text-sm">{label}</span>
              <Icon className="size-4" strokeWidth={1.75} />
            </div>
            <p className="mt-3 text-2xl font-semibold text-bone/40">—</p>
          </Panel>
        ))}
      </section>

      {/* Sections */}
      <section>
        <h2 className="text-lg font-semibold text-bone">Explore the campaign</h2>
        <p className="mt-1 text-sm text-ash">Everything your party needs, in one place.</p>
        <div className={`mt-5 grid gap-4 sm:grid-cols-2 ${showDmSections ? 'lg:grid-cols-3' : ''}`}>
          {sections.map((item) => {
            const Icon = item.icon
            const isDm = item.group === 'dm'
            return (
              <a
                key={item.path}
                href={`#/${item.path}`}
                className={`group relative flex flex-col overflow-hidden rounded-xl border p-5 transition hover:-translate-y-0.5 ${
                  isDm
                    ? 'border-burgundy/40 bg-linear-to-br from-burgundy-dark/60 to-panel/70 hover:border-burgundy-light/60 sm:col-span-2 lg:col-span-1 lg:col-start-3 lg:row-span-2 lg:row-start-1'
                    : 'border-line bg-panel/70 hover:border-burgundy-light/40 hover:bg-panel-raised'
                }`}
              >
                <div className="flex items-start justify-between">
                  <span
                    className={`grid size-10 place-items-center rounded-lg border ${
                      isDm ? 'border-burgundy-light/30 bg-burgundy/30' : 'border-line bg-charcoal/60'
                    } text-gold`}
                  >
                    <Icon className="size-5" strokeWidth={1.75} />
                  </span>
                  {isDm ? (
                    <span className="rounded-full border border-burgundy-light/30 px-2 py-0.5 text-[11px] font-medium text-[#d46b79]">
                      DM only
                    </span>
                  ) : (
                    <ArrowUpRight className="size-4 text-faint opacity-0 transition group-hover:opacity-100" />
                  )}
                </div>
                <h3 className={`mt-4 font-semibold text-bone ${isDm ? 'lg:mt-auto lg:font-display lg:text-2xl' : ''}`}>
                  {item.label}
                </h3>
                <p className="mt-1 text-sm leading-relaxed text-ash">{item.description}</p>
              </a>
            )
          })}
        </div>
      </section>

      {/* Activity */}
      <section className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <Panel>
          <div className="flex items-center justify-between border-b border-line px-5 py-4">
            <h2 className="font-semibold text-bone">Latest from the chronicle</h2>
            <Hourglass className="size-4 text-faint" strokeWidth={1.75} />
          </div>
          <EmptyState
            icon={ScrollText}
            title="No tales recorded yet"
            text="Session recaps and campaign updates will appear here once the adventure begins."
          />
        </Panel>
        <Panel>
          <div className="flex items-center justify-between border-b border-line px-5 py-4">
            <h2 className="font-semibold text-bone">From the DM</h2>
            <Feather className="size-4 text-faint" strokeWidth={1.75} />
          </div>
          <EmptyState
            icon={Feather}
            title="No announcements"
            text="Notes and messages from the Dungeon Master will be shown here."
          />
        </Panel>
      </section>
    </div>
  )
}
