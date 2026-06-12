'use client'

import { ClipboardCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '../StatusBadge'
import type { TimeOffRequest } from '@/features/time-off/types'

interface RequestTableProps {
  requests: TimeOffRequest[]
  /** When provided, renders a Review action column wired to this callback. */
  onReview?: (request: TimeOffRequest) => void
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

function initials(name: string): string {
  return name
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

export function RequestTable({ requests, onReview }: RequestTableProps) {
  const showActions = Boolean(onReview)

  // Shared cell padding + a right border to make each field separator obvious.
  const cell = 'px-4 py-3 border-r border-slate-700/40 last:border-r-0'
  const headCell =
    'px-4 py-2.5 text-left text-[0.7rem] font-semibold uppercase tracking-widest text-slate-500 border-r border-slate-700/40 last:border-r-0'

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-700/70 bg-slate-800/30 shadow-sm">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-slate-700/70 bg-slate-800/60">
            <th className={headCell}>Employee</th>
            <th className={headCell}>Type</th>
            <th className={headCell}>Dates</th>
            <th className={`${headCell} text-right`}>Days</th>
            <th className={headCell}>Notes</th>
            <th className={headCell}>Status</th>
            {showActions && (
              <th className={`${headCell} text-right`}>Action</th>
            )}
          </tr>
        </thead>
        <tbody>
          {requests.map((req) => {
            const typeLabel =
              BALANCE_TYPE_LABELS[req.balanceType] ?? req.balanceType
            const name = req.employeeName ?? req.employeeId
            return (
              <tr
                key={req.id}
                className="border-b border-slate-700/40 last:border-b-0 transition-colors hover:bg-slate-800/60"
              >
                {/* Employee */}
                <td className={cell}>
                  <div className="flex items-center gap-2.5">
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-slate-700/70 font-mono text-[0.65rem] font-semibold text-slate-300">
                      {initials(name)}
                    </span>
                    <span className="font-medium text-slate-100 whitespace-nowrap">
                      {name}
                    </span>
                  </div>
                </td>

                {/* Type */}
                <td className={cell}>
                  <span className="text-slate-300 whitespace-nowrap">
                    {typeLabel}
                  </span>
                </td>

                {/* Dates */}
                <td className={cell}>
                  <span className="font-mono text-xs text-slate-300 whitespace-nowrap">
                    {formatDate(req.startDate)}
                    <span className="mx-1 text-slate-600">→</span>
                    {formatDate(req.endDate)}
                  </span>
                </td>

                {/* Days */}
                <td className={`${cell} text-right`}>
                  <span className="font-mono font-semibold text-slate-100">
                    {req.days}
                  </span>
                  <span className="ml-1 text-xs text-slate-500">
                    day{req.days !== 1 ? 's' : ''}
                  </span>
                </td>

                {/* Notes */}
                <td className={cell}>
                  {req.notes ? (
                    <span
                      className="block max-w-[14rem] truncate italic text-slate-400"
                      title={req.notes}
                    >
                      {req.notes}
                    </span>
                  ) : (
                    <span className="text-slate-600">—</span>
                  )}
                </td>

                {/* Status */}
                <td className={cell}>
                  <div className="flex flex-col items-start gap-1">
                    <StatusBadge status={req.status} />
                    {(req.status === 'denied' ||
                      req.status === 'rolled-back') &&
                      req.hcmRejectionReason && (
                        <span className="text-[0.7rem] text-red-400/80">
                          {req.hcmRejectionReason}
                        </span>
                      )}
                  </div>
                </td>

                {/* Action */}
                {showActions && (
                  <td className={`${cell} text-right`}>
                    <Button
                      size="sm"
                      onClick={() => onReview?.(req)}
                      className="bg-amber-500 font-semibold text-slate-900 shadow-sm hover:bg-amber-400"
                    >
                      <ClipboardCheck className="size-3.5" />
                      Review
                    </Button>
                  </td>
                )}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
