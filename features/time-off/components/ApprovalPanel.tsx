'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useBalance, useApproveRequest } from '@/features/time-off/hooks'
import { denyRequest } from '@/features/time-off/api/hcmClient'
import { useUiStore } from '@/features/time-off/store/uiStore'
import { QueryKeys } from '@/lib/query-client'
import { Button } from '@/components/ui/button'
import { StaleIndicator } from './StaleIndicator'
import { StatusBadge } from './StatusBadge'
import type { HcmSubmitResult, TimeOffRequest } from '@/features/time-off/types'

interface ApprovalPanelProps {
  request: TimeOffRequest
  onDone?: () => void
}

const BALANCE_TYPE_LABELS: Record<string, string> = {
  vacation: 'Vacation',
  sick: 'Sick Leave',
  personal: 'Personal',
}

function formatDate(isoDate: string): string {
  return new Date(isoDate + 'T00:00:00').toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

// Inline deny mutation hook
function useDenyRequest() {
  const queryClient = useQueryClient()
  const { addToast } = useUiStore.getState()

  return useMutation<
    HcmSubmitResult,
    Error,
    { requestId: string; employeeId: string; locationId: string; balanceType: string }
  >({
    mutationFn: ({ requestId }) => denyRequest(requestId),

    onError: () => {
      addToast({
        id: `toast-deny-err-${Date.now()}`,
        type: 'error',
        message: 'Failed to deny the request. Please try again.',
      })
    },

    onSuccess: (result, { employeeId, locationId, balanceType }) => {
      if (!result.success) {
        addToast({
          id: `toast-deny-err-${Date.now()}`,
          type: 'error',
          message: result.error ?? 'Denial could not be processed.',
        })
        return
      }

      void queryClient.invalidateQueries({
        queryKey: QueryKeys.balance(employeeId, locationId, balanceType),
      })
      void queryClient.invalidateQueries({
        queryKey: QueryKeys.requests(employeeId),
      })
      void queryClient.invalidateQueries({
        queryKey: QueryKeys.allRequests(),
      })

      addToast({
        id: `toast-deny-ok-${Date.now()}`,
        type: 'info',
        message: 'Request denied.',
        requestId: result.requestId,
      })
    },
  })
}

export function ApprovalPanel({ request, onDone }: ApprovalPanelProps) {
  const balanceQuery = useBalance(
    request.employeeId,
    request.locationId,
    request.balanceType,
  )
  const approveMutation = useApproveRequest()
  const denyMutation = useDenyRequest()

  const isPending =
    approveMutation.isPending || denyMutation.isPending

  const typeLabel =
    BALANCE_TYPE_LABELS[request.balanceType] ?? request.balanceType

  async function handleApprove() {
    await approveMutation.mutateAsync(
      {
        requestId: request.id,
        employeeId: request.employeeId,
        locationId: request.locationId,
        balanceType: request.balanceType,
      },
      { onSuccess: (r) => { if (r.success) onDone?.() } },
    )
  }

  async function handleDeny() {
    await denyMutation.mutateAsync(
      {
        requestId: request.id,
        employeeId: request.employeeId,
        locationId: request.locationId,
        balanceType: request.balanceType,
      },
      { onSuccess: (r) => { if (r.success) onDone?.() } },
    )
  }

  return (
    <div className="space-y-5 rounded-xl border border-slate-700 bg-slate-800/60 p-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-widest text-slate-500">
            Request
          </p>
          <p className="mt-1 font-mono text-xs text-slate-400">{request.id}</p>
        </div>
        <StatusBadge status={request.status} />
      </div>

      {/* Employee + request details */}
      <div className="grid grid-cols-2 gap-4 rounded-lg border border-slate-700/50 bg-slate-900/50 p-4 text-sm">
        <div>
          <p className="text-xs text-slate-500">Employee</p>
          <p className="mt-0.5 font-medium text-slate-200">
            {request.employeeName ?? request.employeeId}
          </p>
        </div>
        <div>
          <p className="text-xs text-slate-500">Type</p>
          <p className="mt-0.5 font-medium text-slate-200">{typeLabel}</p>
        </div>
        <div>
          <p className="text-xs text-slate-500">Dates</p>
          <p className="mt-0.5 font-mono text-slate-200">
            {formatDate(request.startDate)}
          </p>
          <p className="font-mono text-slate-400 text-xs">
            → {formatDate(request.endDate)}
          </p>
        </div>
        <div>
          <p className="text-xs text-slate-500">Duration</p>
          <p className="mt-0.5 font-mono text-2xl font-bold text-slate-100">
            {request.days}
            <span className="ml-1 text-sm font-normal text-slate-400">
              day{request.days !== 1 ? 's' : ''}
            </span>
          </p>
        </div>
        {request.notes && (
          <div className="col-span-2">
            <p className="text-xs text-slate-500">Notes</p>
            <p className="mt-0.5 italic text-slate-300">{request.notes}</p>
          </div>
        )}
      </div>

      {/* Balance at decision time */}
      <div className="rounded-lg border border-slate-700/50 bg-slate-900/50 p-4">
        <p className="mb-2 text-xs uppercase tracking-widest text-slate-500">
          Balance at Decision Time
        </p>
        {balanceQuery.isLoading || approveMutation.isPending ? (
          <p className="text-sm text-amber-400">
            Verifying current balance...
          </p>
        ) : balanceQuery.data ? (
          <div className="space-y-2">
            {/* Total = availableDays + pendingDays (pending was already
                deducted from available on submit, so adding back gives the
                true remaining balance before any pending requests clear) */}
            <p className="font-mono text-3xl font-bold text-slate-100">
              {balanceQuery.data.availableDays + balanceQuery.data.pendingDays}
              <span className="ml-1 text-sm font-normal text-slate-400">
                days remaining
              </span>
            </p>
            {balanceQuery.data.pendingDays > 0 ? (
              <p className="text-xs text-slate-400">
                <span className="font-mono text-amber-400">
                  {balanceQuery.data.pendingDays}
                </span>
                {' '}held for pending requests —{' '}
                <span className="font-mono text-slate-200">
                  {balanceQuery.data.availableDays}
                </span>
                {' '}free
              </p>
            ) : (
              <p className="text-xs text-slate-500">No other pending requests</p>
            )}
            <StaleIndicator
              asOf={balanceQuery.data.asOf}
              isFetching={balanceQuery.isFetching}
            />
          </div>
        ) : (
          <p className="text-sm text-slate-500">Balance unavailable</p>
        )}
      </div>

      {/* Action buttons */}
      <div className="flex gap-3">
        <Button
          onClick={handleApprove}
          disabled={isPending}
          className="flex-1 bg-emerald-600 text-white hover:bg-emerald-500 disabled:opacity-50"
        >
          {approveMutation.isPending ? 'Approving...' : 'Approve'}
        </Button>
        <Button
          variant="destructive"
          onClick={handleDeny}
          disabled={isPending}
          className="flex-1"
        >
          {denyMutation.isPending ? 'Denying...' : 'Deny'}
        </Button>
      </div>
    </div>
  )
}
