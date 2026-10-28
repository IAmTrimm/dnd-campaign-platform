import type { CodexCategory, CodexVisibility } from '../codex/types'

// Plain logic (no React), so scripts/dashboard-test.mjs can run it against live data.

export type DashboardRole = 'owner' | 'dm' | 'player'

type ScopedEntry = { id: string; world_id: string; campaign_id: string | null; category: CodexCategory; visibility: CodexVisibility }

// Which of the Codex articles the database returned belong on one campaign's
// dashboard. The database has already removed everything the user may not see;
// this keeps campaigns apart for people in several of them. A player sees the
// campaign's and world's published articles plus world secrets *this* party has
// discovered (not ones another of their campaigns discovered). DMs and the
// Owner see everything they're allowed to in the campaign and its world.
export function entriesForCampaign<T extends ScopedEntry>(
  entries: T[],
  campaign: { id: string; world_id: string },
  role: DashboardRole,
  revealedToCampaign: Set<string>,
): T[] {
  return entries.filter((entry) => {
    if (entry.world_id !== campaign.world_id) return false
    if (entry.campaign_id !== null && entry.campaign_id !== campaign.id) return false
    if (role !== 'player') return true
    if (entry.visibility === 'players') return true
    return entry.visibility === 'dm' && revealedToCampaign.has(entry.id)
  })
}

export type CodexStats = {
  total: number
  byCategory: Record<CodexCategory, number>
  drafts: number
  secrets: number
}

export function codexStats(entries: ScopedEntry[]): CodexStats {
  const byCategory: Record<CodexCategory, number> = { npc: 0, location: 0, faction: 0, item: 0, lore: 0 }
  for (const entry of entries) byCategory[entry.category]++
  return {
    total: entries.length,
    byCategory,
    drafts: entries.filter((e) => e.visibility === 'draft').length,
    secrets: entries.filter((e) => e.visibility === 'dm').length,
  }
}
