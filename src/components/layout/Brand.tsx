import { Swords } from 'lucide-react'

type BrandProps = {
  onNavigate?: () => void
}

export function Brand({ onNavigate }: BrandProps) {
  return (
    <a href="#/" onClick={onNavigate} className="flex items-center gap-3">
      <span className="grid size-9 place-items-center rounded-lg border border-burgundy-light/30 bg-linear-to-br from-burgundy to-burgundy-dark shadow-lg shadow-burgundy/20">
        <Swords className="size-[18px] text-gold" strokeWidth={1.75} />
      </span>
      <span className="leading-tight">
        <span className="block font-display text-lg font-semibold text-bone">Campaign Platform</span>
        <span className="block text-[11px] tracking-wide text-faint">Dungeons &amp; Dragons</span>
      </span>
    </a>
  )
}
