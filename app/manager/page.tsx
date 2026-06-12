'use client'

import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useAllRequests } from '@/features/time-off/hooks'
import { QueryKeys } from '@/lib/query-client'
import { RefreshCw } from 'lucide-react'
import { ApprovalPanel } from '@/features/time-off/components/ApprovalPanel'
import { RequestTable } from '@/features/time-off/components/RequestTable'
import { LoadingSkeleton } from '@/features/time-off/components/LoadingSkeleton'
import { EmptyState } from '@/features/time-off/components/EmptyState'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import type { TimeOffRequest } from '@/features/time-off/types'

const ACTIONABLE_STATUSES = new Set<TimeOffRequest['status']>([
  'submitted',
  'optimistic-pending',
  'needs-attention',
])

const LOCATION_LABELS: Record<string, string> = {
  'loc-nyc': 'New York City',
  'loc-sf': 'San Francisco',
}


export default function ManagerPage() {
  const { data, isLoading, isError, isFetching } = useAllRequests()
  const queryClient = useQueryClient()
  const [selectedRequest, setSelectedRequest] =
    useState<TimeOffRequest | null>(null)

  function handleRefresh() {
    void queryClient.invalidateQueries({ queryKey: QueryKeys.allRequests() })
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold tracking-tight text-slate-100">
          Team Time-Off Requests
        </h1>
        <LoadingSkeleton />
      </div>
    )
  }

  if (isError) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold tracking-tight text-slate-100">
          Team Time-Off Requests
        </h1>
        <Alert
          variant="destructive"
          className="border-red-500/30 bg-red-500/10 text-red-400"
        >
          <AlertTitle>Failed to load requests</AlertTitle>
          <AlertDescription>
            Unable to fetch pending requests. Please try again.
          </AlertDescription>
          <div className="mt-3">
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              className="border-red-500/40 text-red-400 hover:bg-red-500/10"
            >
              Retry
            </Button>
          </div>
        </Alert>
      </div>
    )
  }

  const requests = data?.requests ?? []
  const pending = requests.filter((r) => ACTIONABLE_STATUSES.has(r.status))
  const allHistory = requests.filter((r) => !ACTIONABLE_STATUSES.has(r.status))

  // Group pending by location
  const byLocation = pending.reduce<Record<string, TimeOffRequest[]>>(
    (acc, req) => {
      const key = req.locationId
      if (!acc[key]) acc[key] = []
      acc[key].push(req)
      return acc
    },
    {},
  )

  const locationKeys = Object.keys(byLocation).sort()

  return (
    <>
      <div className="space-y-8">
        {/* Page header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-100">
              Team Time-Off Requests
            </h1>
            <p className="mt-0.5 text-sm text-slate-400">
              Review and action pending requests from your team
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRefresh}
            disabled={isFetching}
            className="shrink-0 text-slate-400 hover:bg-slate-700/60 hover:text-slate-100"
          >
            <RefreshCw className={`size-3.5 ${isFetching ? 'animate-spin' : ''}`} />
            {isFetching ? 'Refreshing...' : 'Refresh'}
          </Button>
        </div>

        {/* Pending requests grouped by location */}
        {pending.length === 0 ? (
          <EmptyState message="No pending requests to review. All caught up!" />
        ) : (
          <div className="space-y-8">
            {locationKeys.map((locationId) => (
              <section key={locationId} className="space-y-3">
                <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-500">
                  {LOCATION_LABELS[locationId] ?? locationId}
                  <span className="ml-2 font-mono text-amber-400">
                    {byLocation[locationId].length} pending
                  </span>
                </h2>
                <RequestTable
                  requests={byLocation[locationId]}
                  onReview={setSelectedRequest}
                />
              </section>
            ))}
          </div>
        )}

        {/* History */}
        {allHistory.length > 0 && (
          <>
            <div className="border-t border-slate-700/60" />
            <section className="space-y-3">
              <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-500">
                Recent History
              </h2>
              <RequestTable requests={allHistory.slice(0, 20)} />
            </section>
          </>
        )}
      </div>

      {/* Approval Dialog */}
      <Dialog
        open={selectedRequest !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedRequest(null)
        }}
      >
        <DialogContent className="border-slate-700 bg-slate-900 text-slate-100 sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-slate-100">
              Review Request —{' '}
              {selectedRequest?.employeeName ?? ''}
            </DialogTitle>
          </DialogHeader>
          {selectedRequest && (
            <ApprovalPanel
              request={selectedRequest}
              onDone={() => setSelectedRequest(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
