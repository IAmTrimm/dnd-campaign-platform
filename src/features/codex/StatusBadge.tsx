import { STATUSES, type CodexVisibility } from './types'

export function StatusBadge({ visibility, size = 'sm' }: { visibility: CodexVisibility; size?: 'sm' | 'md' }) {
  const { label, icon: Icon, className } = STATUSES[visibility]
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 rounded-full border font-medium ${className} ${
        size === 'md' ? 'px-2.5 py-1 text-xs' : 'px-2 py-0.5 text-[11px]'
      }`}
    >
      <Icon className={size === 'md' ? 'size-3.5' : 'size-3'} strokeWidth={2} />
      {label}
    </span>
  )
}
