'use client'

import { useRequests } from '@/features/time-off/hooks'
import { LoadingSkeleton } from '../LoadingSkeleton'
import { EmptyState } from '../EmptyState'
import { PendingRequestRow } from '../PendingRequestRow'
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert'
import type { TimeOffRequest } from '@/features/time-off/types'

interface RequestListProps {
  employeeId: string
}

const PENDING_STATUSES = new Set<TimeOffRequest['status']>([
  'optimistic-pending',
  'submitted',
  'needs-attention',
])

export function RequestList({ employeeId }: RequestListProps) {
  const { data, isLoading, isError } = useRequests(employeeId)

  if (isLoading) {
    return <LoadingSkeleton />
  }

  if (isError) {
    return (
      <Alert
        variant="destructive"
        className="border-red-500/30 bg-red-500/10 text-red-400"
      >
        <AlertTitle>Failed to load requests</AlertTitle>
        <AlertDescription>
          Unable to fetch request history. Please refresh the page.
        </AlertDescription>
      </Alert>
    )
  }

  const requests = data?.requests ?? []

  if (requests.length === 0) {
    return (
      <EmptyState message="No time-off requests found. Submit your first request above." />
    )
  }

  const pending = requests.filter((r) => PENDING_STATUSES.has(r.status))
  const history = requests.filter((r) => !PENDING_STATUSES.has(r.status))

  return (
    <div className="space-y-6">
      {pending.length > 0 && (
        <section className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-500">
            Pending
          </h3>
          <div className="space-y-2">
            {pending.map((req) => (
              <PendingRequestRow key={req.id} request={req} />
            ))}
          </div>
        </section>
      )}

      {history.length > 0 && (
        <section className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-500">
            History
          </h3>
          <div className="space-y-2">
            {history.map((req) => (
              <PendingRequestRow key={req.id} request={req} />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
