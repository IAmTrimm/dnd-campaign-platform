import type { ReactNode } from 'react'

type PanelProps = {
  children: ReactNode
  className?: string
}

// The standard raised surface used for cards and content blocks.
export function Panel({ children, className = '' }: PanelProps) {
  return (
    <div
      className={`rounded-xl border border-line bg-panel/70 shadow-[inset_0_1px_0_rgba(255,255,255,0.03),0_10px_30px_-12px_rgba(0,0,0,0.6)] ${className}`}
    >
      {children}
    </div>
  )
}
