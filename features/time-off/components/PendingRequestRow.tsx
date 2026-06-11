'use client'

import { StatusBadge } from './StatusBadge'
import type { TimeOffRequest } from '@/features/time-off/types'

interface PendingRequestRowProps {
  request: TimeOffRequest
  showEmployeeName?: boolean
}

const BALANCE_TYPE_LABELS: Record<string, string> = {
  vacation: 'Vacation',
  sick: 'Sick Leave',
  personal: 'Personal',
}

function formatDate(isoDate: string): string {
  return new Date(isoDate + 'T00:00:00').toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export function PendingRequestRow({
  request,
  showEmployeeName = false,
}: PendingRequestRowProps) {
  const typeLabel =
    BALANCE_TYPE_LABELS[request.balanceType] ?? request.balanceType

  return (
    <div className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 rounded-lg border border-slate-700/60 bg-slate-800/40 px-4 py-3 text-sm hover:bg-slate-800/70 transition-colors">
      <div className="space-y-1">
        {/* Top row */}
        <div className="flex flex-wrap items-center gap-2">
          {showEmployeeName && (
            <span className="font-medium text-slate-200">
              {request.employeeName ?? request.employeeId}
            </span>
          )}
          <span className="font-medium text-slate-200">{typeLabel}</span>
          <span className="text-slate-500">·</span>
          <span className="font-mono text-slate-300">
            {formatDate(request.startDate)} – {formatDate(request.endDate)}
          </span>
        </div>

        {/* Days + notes */}
        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
          <span className="font-mono">
            {request.days} day{request.days !== 1 ? 's' : ''}
          </span>
          {request.notes && (
            <>
              <span className="text-slate-600">·</span>
              <span className="italic text-slate-400 truncate max-w-xs">
                {request.notes}
              </span>
            </>
          )}
        </div>

        {/* Rejection reason */}
        {(request.status === 'denied' || request.status === 'rolled-back') &&
          request.hcmRejectionReason && (
            <p className="text-xs text-red-400/80">{request.hcmRejectionReason}</p>
          )}
      </div>

      {/* Status badge */}
      <div className="flex items-start pt-0.5">
        <StatusBadge status={request.status} />
      </div>
    </div>
  )
}
