'use client'

import { Badge } from '@/components/ui/badge'
import type { RequestStatus } from '@/features/time-off/types'

interface StatusBadgeProps {
  status: RequestStatus
}

const STATUS_CONFIG: Record<
  RequestStatus,
  { label: string; className: string }
> = {
  'optimistic-pending': {
    label: 'Pending...',
    className: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  },
  submitted: {
    label: 'Submitted',
    className: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  },
  approved: {
    label: 'Approved',
    className: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  },
  denied: {
    label: 'Denied',
    className: 'bg-red-500/20 text-red-400 border-red-500/30',
  },
  'rolled-back': {
    label: 'Rolled Back',
    className:
      'bg-transparent text-red-400 border-red-500/50',
  },
  'needs-attention': {
    label: 'Needs Attention ⚠',
    className: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  },
  draft: {
    label: 'Draft',
    className: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
  },
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG['draft']
  return (
    <Badge
      variant="outline"
      className={`font-mono text-xs tracking-wide ${config.className}`}
    >
      {config.label}
    </Badge>
  )
}
