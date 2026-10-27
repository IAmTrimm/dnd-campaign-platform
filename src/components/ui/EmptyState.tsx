import type { LucideIcon } from 'lucide-react'

type EmptyStateProps = {
  icon: LucideIcon
  title: string
  text: string
}

export function EmptyState({ icon: Icon, title, text }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center px-6 py-12 text-center">
      <span className="grid size-12 place-items-center rounded-full border border-line bg-charcoal/60 text-faint">
        <Icon className="size-5" strokeWidth={1.75} />
      </span>
      <p className="mt-4 font-medium text-bone">{title}</p>
      <p className="mt-1 max-w-sm text-sm leading-relaxed text-ash">{text}</p>
    </div>
  )
}
