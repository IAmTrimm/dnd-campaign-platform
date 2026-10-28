import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '../../auth/AuthContext'
import { supabase } from '../../lib/supabase'
import type { Campaign, CodexCategory, CodexVisibility, World } from '../codex/types'
import { codexStats, entriesForCampaign, type CodexStats, type DashboardRole } from './campaignView'

export type DashboardCampaign = Campaign & { worldName: string; role: DashboardRole }

export type RecentEntry = {
  id: string
  world_id: string
  campaign_id: string | null
  category: CodexCategory
  name: string
  summary: string | null
  visibility: CodexVisibility
  created_at: string
  updated_at: string
}

export type PartyMember = { id: string; name: string; role: 'dm' | 'player' }

export type CampaignDetails = { stats: CodexStats; recent: RecentEntry[]; party: PartyMember[] }

const ENTRY_COLUMNS = 'id, world_id, campaign_id, category, name, summary, visibility, created_at, updated_at'
const storageKey = (userId: string) => `dashboard-campaign:${userId}`

// The campaign last chosen on this device (a convenience only).
function rememberedCampaign(userId: string) {
  try {
    return localStorage.getItem(storageKey(userId))
  } catch {
    return null
  }
}

// Everything the dashboard shows. Every request goes through the database's
// access rules, so only records the user may see ever reach the browser.
export function useDashboard() {
  const { session } = useAuth()
  const userId = session?.user.id
  const [base, setBase] = useState<{ name: string | null; campaigns: DashboardCampaign[] } | null>(null)
  const [chosenId, setChosenId] = useState<string | null>(() => (userId ? rememberedCampaign(userId) : null))
  const [details, setDetails] = useState<{ campaignId: string; data: CampaignDetails } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [version, setVersion] = useState(0)
  const retry = useCallback(() => {
    setError(null)
    setBase(null)
    setDetails(null)
    setVersion((v) => v + 1)
  }, [])

  // The user's name and the campaigns they can open.
  useEffect(() => {
    if (!userId) return
    let cancelled = false
    Promise.all([
      supabase.from('profiles').select('display_name').eq('id', userId).maybeSingle(),
      supabase.from('worlds').select('id, name, owner_id'),
      supabase.from('campaigns').select('id, name, world_id'),
      supabase.from('campaign_members').select('campaign_id, role').eq('user_id', userId),
    ]).then(([profileRes, worldsRes, campaignsRes, membershipsRes]) => {
      if (cancelled) return
      if ([profileRes, worldsRes, campaignsRes, membershipsRes].some((res) => res.error)) {
        setError("The dashboard couldn't be loaded. Check your connection and try again.")
        return
      }
      const worlds = new Map((worldsRes.data as World[]).map((w) => [w.id, w]))
      const roles = new Map(membershipsRes.data!.map((m) => [m.campaign_id, m.role as 'dm' | 'player']))
      const campaigns: DashboardCampaign[] = []
      for (const campaign of campaignsRes.data as Campaign[]) {
        const world = worlds.get(campaign.world_id)
        const role: DashboardRole | undefined = world?.owner_id === userId ? 'owner' : roles.get(campaign.id)
        if (world && role) campaigns.push({ ...campaign, worldName: world.name, role })
      }
      campaigns.sort((a, b) => a.worldName.localeCompare(b.worldName) || a.name.localeCompare(b.name))
      setBase({ name: profileRes.data?.display_name ?? null, campaigns })
    })
    return () => {
      cancelled = true
    }
  }, [userId, version])

  const campaign = useMemo(() => base?.campaigns.find((c) => c.id === chosenId) ?? base?.campaigns[0] ?? null, [base, chosenId])

  // The chosen campaign's articles and party. Queries are limited to this
  // campaign and its world, and players never request drafts.
  useEffect(() => {
    if (!campaign) return
    let cancelled = false
    const isPlayer = campaign.role === 'player'
    let entriesQuery = supabase
      .from('codex_entries')
      .select(ENTRY_COLUMNS)
      .eq('world_id', campaign.world_id)
      .or(`campaign_id.is.null,campaign_id.eq.${campaign.id}`)
      .order('updated_at', { ascending: false })
    if (isPlayer) entriesQuery = entriesQuery.in('visibility', ['players', 'dm'])
    Promise.all([
      entriesQuery,
      supabase.from('codex_reveals').select('entry_id').eq('campaign_id', campaign.id),
      supabase.from('campaign_members').select('user_id, role').eq('campaign_id', campaign.id),
    ])
      .then(async ([entriesRes, revealsRes, membersRes]) => {
        if ([entriesRes, revealsRes, membersRes].some((res) => res.error)) throw new Error('load failed')
        const members = membersRes.data as { user_id: string; role: 'dm' | 'player' }[]
        const profilesRes = members.length
          ? await supabase.from('profiles').select('id, display_name, username').in('id', members.map((m) => m.user_id))
          : { data: [], error: null }
        if (profilesRes.error) throw new Error('load failed')
        const names = new Map((profilesRes.data ?? []).map((p) => [p.id, p.display_name || p.username]))
        const revealed = new Set(revealsRes.data!.map((r) => r.entry_id))
        const entries = entriesForCampaign(entriesRes.data as RecentEntry[], campaign, campaign.role, revealed)
        const party = members
          .map((m) => ({ id: m.user_id, name: names.get(m.user_id) ?? 'Adventurer', role: m.role }))
          .sort((a, b) => (a.role === b.role ? a.name.localeCompare(b.name) : a.role === 'dm' ? -1 : 1))
        if (!cancelled) setDetails({ campaignId: campaign.id, data: { stats: codexStats(entries), recent: entries.slice(0, 6), party } })
      })
      .catch(() => {
        if (!cancelled) setError("This campaign's details couldn't be loaded. Check your connection and try again.")
      })
    return () => {
      cancelled = true
    }
  }, [campaign, version])

  const chooseCampaign = useCallback(
    (id: string) => {
      setChosenId(id)
      try {
        if (userId) localStorage.setItem(storageKey(userId), id)
      } catch {
        // Not remembered on this device; that's fine.
      }
    },
    [userId],
  )

  return {
    loading: !base && !error,
    name: base?.name ?? null,
    campaigns: base?.campaigns ?? [],
    campaign,
    // Only details for the campaign on screen, never a previous one's.
    details: details && details.campaignId === campaign?.id ? details.data : null,
    error,
    retry,
    chooseCampaign,
  }
}
