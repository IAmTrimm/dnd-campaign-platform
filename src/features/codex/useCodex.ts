import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '../../auth/AuthContext'
import { supabase } from '../../lib/supabase'
import { LIST_COLUMNS, type Campaign, type CodexListItem, type CodexScope, type World } from './types'

export type EditableScope = CodexScope & { label: string; worldName: string }

// Loads everything the Codex screens need. The database's access rules decide
// what comes back; the permission helpers below only decide which buttons to
// show, mirroring those rules.
export function useCodex() {
  const { session } = useAuth()
  const userId = session?.user.id
  const [entries, setEntries] = useState<CodexListItem[] | null>(null)
  const [worlds, setWorlds] = useState<World[]>([])
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [dmCampaignIds, setDmCampaignIds] = useState<Set<string>>(new Set())
  const [error, setError] = useState<string | null>(null)
  const [version, setVersion] = useState(0)
  // Fetch everything again (e.g. after saving an article).
  const reload = useCallback(() => setVersion((v) => v + 1), [])

  useEffect(() => {
    if (!userId) return
    let cancelled = false
    Promise.all([
      supabase.from('codex_entries').select(LIST_COLUMNS),
      supabase.from('worlds').select('id, name, owner_id'),
      supabase.from('campaigns').select('id, name, world_id'),
      supabase.from('campaign_members').select('campaign_id, role').eq('user_id', userId),
    ]).then(([entriesRes, worldsRes, campaignsRes, membershipsRes]) => {
      if (cancelled) return
      if ([entriesRes, worldsRes, campaignsRes, membershipsRes].some((res) => res.error)) {
        setError('The Codex could not be loaded. Please try again.')
        return
      }
      const byName = <T extends { name: string }>(a: T, b: T) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
      setError(null)
      setEntries((entriesRes.data as CodexListItem[]).sort(byName))
      setWorlds((worldsRes.data as World[]).sort(byName))
      setCampaigns((campaignsRes.data as Campaign[]).sort(byName))
      setDmCampaignIds(new Set(membershipsRes.data!.filter((m) => m.role === 'dm').map((m) => m.campaign_id)))
    })
    return () => {
      cancelled = true
    }
  }, [userId, version])

  const permissions = useMemo(() => {
    const ownedWorlds = new Set(worlds.filter((w) => w.owner_id === userId).map((w) => w.id))
    const campaignWorld = new Map(campaigns.map((c) => [c.id, c.world_id]))

    // Same rule as private.can_edit_codex in the database.
    const canEdit = ({ worldId, campaignId }: CodexScope) =>
      campaignId ? dmCampaignIds.has(campaignId) || ownedWorlds.has(campaignWorld.get(campaignId) ?? '') : ownedWorlds.has(worldId)

    // The world name is only needed in labels when there's more than one world.
    const prefix = (world: World) => (worlds.length > 1 ? `${world.name}: ` : '')
    const editableScopes: EditableScope[] = []
    for (const world of worlds) {
      if (ownedWorlds.has(world.id)) {
        editableScopes.push({ worldId: world.id, campaignId: null, worldName: world.name, label: `${prefix(world)}World lore (all campaigns)` })
      }
      for (const campaign of campaigns.filter((c) => c.world_id === world.id && canEdit({ worldId: world.id, campaignId: c.id }))) {
        editableScopes.push({ worldId: world.id, campaignId: campaign.id, worldName: world.name, label: `${prefix(world)}${campaign.name} only` })
      }
    }
    return { canEdit, editableScopes, isEditor: editableScopes.length > 0 }
  }, [worlds, campaigns, dmCampaignIds, userId])

  const scopeLabel = useCallback(
    (entry: { world_id: string; campaign_id: string | null }) => {
      if (entry.campaign_id) return campaigns.find((c) => c.id === entry.campaign_id)?.name ?? 'Campaign'
      return worlds.length > 1 ? `${worlds.find((w) => w.id === entry.world_id)?.name ?? 'World'} lore` : 'World lore'
    },
    [campaigns, worlds],
  )

  return { entries, worlds, campaigns, error, reload, scopeLabel, ...permissions }
}

export type CodexData = ReturnType<typeof useCodex>
