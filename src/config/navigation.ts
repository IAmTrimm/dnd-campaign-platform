import type { LucideIcon } from 'lucide-react'
import { BookOpen, LayoutDashboard, Map as MapIcon, ScrollText, Users, WandSparkles } from 'lucide-react'

// The main sections of the site. Add a new entry here to add it to the navigation.
export type NavItem = {
  path: string
  label: string
  description: string
  icon: LucideIcon
  group: 'campaign' | 'dm'
}

export const navGroups = [
  { id: 'campaign', label: 'Campaign' },
  { id: 'dm', label: 'Dungeon Master' },
] as const

export const navItems: NavItem[] = [
  {
    path: 'dashboard',
    label: 'Dashboard',
    description: 'An overview of the campaign at a glance.',
    icon: LayoutDashboard,
    group: 'campaign',
  },
  {
    path: 'codex',
    label: 'Codex',
    description: 'Lore, locations, factions and the history of the realm.',
    icon: BookOpen,
    group: 'campaign',
  },
  {
    path: 'quests',
    label: 'Quests',
    description: 'Active, completed and rumoured quests.',
    icon: MapIcon,
    group: 'campaign',
  },
  {
    path: 'sessions',
    label: 'Sessions',
    description: 'Recaps and notes from each game session.',
    icon: ScrollText,
    group: 'campaign',
  },
  {
    path: 'characters',
    label: 'Characters',
    description: 'The heroes of the party and the folk they meet.',
    icon: Users,
    group: 'campaign',
  },
  {
    path: 'dm-workshop',
    label: 'DM Workshop',
    description: "The Dungeon Master's private tools and planning.",
    icon: WandSparkles,
    group: 'dm',
  },
]
