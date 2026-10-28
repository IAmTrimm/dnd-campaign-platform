import type { LucideIcon } from 'lucide-react'
import { Eye, EyeOff, Gem, MapPin, PencilLine, ScrollText, Shield, UserRound } from 'lucide-react'

// Mirrors the codex_entries table (B011 migration).
export type CodexCategory = 'npc' | 'location' | 'faction' | 'item' | 'lore'
export type CodexVisibility = 'draft' | 'dm' | 'players'

export type CodexListItem = {
  id: string
  world_id: string
  campaign_id: string | null
  category: CodexCategory
  name: string
  summary: string | null
  tags: string[]
  visibility: CodexVisibility
  updated_at: string
}

export type CodexEntry = CodexListItem & {
  description: string | null
  image_path: string | null // file in the private codex-images bucket
  image_alt: string | null
  created_at: string
}

export type World = { id: string; name: string; owner_id: string }
export type Campaign = { id: string; name: string; world_id: string }

// Where an article lives: a whole world (shared lore) or one campaign.
export type CodexScope = { worldId: string; campaignId: string | null }

export const LIST_COLUMNS = 'id, world_id, campaign_id, category, name, summary, tags, visibility, updated_at'

export const CATEGORIES: { id: CodexCategory; label: string; plural: string; icon: LucideIcon }[] = [
  { id: 'npc', label: 'NPC', plural: 'NPCs', icon: UserRound },
  { id: 'location', label: 'Location', plural: 'Locations', icon: MapPin },
  { id: 'faction', label: 'Faction', plural: 'Factions', icon: Shield },
  { id: 'item', label: 'Item', plural: 'Items', icon: Gem },
  { id: 'lore', label: 'Lore', plural: 'Lore', icon: ScrollText },
]

export function categoryOf(id: CodexCategory) {
  return CATEGORIES.find((category) => category.id === id) ?? CATEGORIES[4]
}

export const STATUSES: Record<CodexVisibility, { label: string; icon: LucideIcon; className: string }> = {
  draft: { label: 'Draft', icon: PencilLine, className: 'border-line bg-white/[0.04] text-ash' },
  dm: { label: 'DM only', icon: EyeOff, className: 'border-burgundy-light/40 bg-burgundy/15 text-[#d46b79]' },
  players: { label: 'Published', icon: Eye, className: 'border-gold/30 bg-gold/10 text-gold' },
}

// Tags are stored lowercase, trimmed and without duplicates.
export function normaliseTags(tags: string[]): string[] {
  const cleaned = tags.map((tag) => tag.trim().toLowerCase().replace(/\s+/g, ' ').slice(0, 30)).filter(Boolean)
  return [...new Set(cleaned)].slice(0, 20)
}
