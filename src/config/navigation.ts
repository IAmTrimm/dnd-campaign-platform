// The main sections of the site. Add a new entry here to add it to the navigation.
export type NavItem = {
  path: string
  label: string
  description: string
  icon: string
}

export const navItems: NavItem[] = [
  {
    path: 'dashboard',
    label: 'Dashboard',
    description: 'An overview of the campaign at a glance.',
    icon: '🏰',
  },
  {
    path: 'codex',
    label: 'Codex',
    description: 'Lore, locations, factions and the history of the realm.',
    icon: '📜',
  },
  {
    path: 'quests',
    label: 'Quests',
    description: 'Active, completed and rumoured quests.',
    icon: '🗺️',
  },
  {
    path: 'sessions',
    label: 'Sessions',
    description: 'Recaps and notes from each game session.',
    icon: '🕯️',
  },
  {
    path: 'characters',
    label: 'Characters',
    description: 'The heroes of the party and the folk they meet.',
    icon: '⚔️',
  },
  {
    path: 'dm-workshop',
    label: 'DM Workshop',
    description: "The Dungeon Master's private tools and planning.",
    icon: '🔮',
  },
]
