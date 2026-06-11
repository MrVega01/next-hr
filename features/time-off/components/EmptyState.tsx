import type { ReactNode } from 'react'
import { CalendarDays } from 'lucide-react'

interface EmptyStateProps {
  message?: string
  icon?: ReactNode
}

export function EmptyState({
  message = 'No data to display.',
  icon,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-slate-700 bg-slate-800/40 px-6 py-16 text-center">
      <span className="text-slate-500">
        {icon ?? <CalendarDays className="size-10" strokeWidth={1.5} />}
      </span>
      <p className="text-sm text-slate-400">{message}</p>
    </div>
  )
}
