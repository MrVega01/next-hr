'use client'

import { RefreshCw } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { useBalances } from '@/features/time-off/hooks'
import { QueryKeys } from '@/lib/query-client'
import { Button } from '@/components/ui/button'
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert'
import { BalanceCard } from './BalanceCard'
import { LoadingSkeleton } from './LoadingSkeleton'
import { EmptyState } from './EmptyState'

interface BalanceListProps {
  employeeId: string
}

export function BalanceList({ employeeId }: BalanceListProps) {
  const { data, isLoading, isError, isFetching, dataUpdatedAt } =
    useBalances(employeeId)
  const queryClient = useQueryClient()

  function handleRefresh() {
    void queryClient.invalidateQueries({
      queryKey: QueryKeys.balances(employeeId),
    })
  }

  if (isLoading) {
    return <LoadingSkeleton />
  }

  if (isError) {
    return (
      <Alert
        variant="destructive"
        className="border-red-500/30 bg-red-500/10 text-red-400"
      >
        <AlertTitle>Failed to load balances</AlertTitle>
        <AlertDescription className="mt-1">
          Unable to fetch balance data. Please try again.
        </AlertDescription>
        <div className="mt-3">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            className="border-red-500/40 text-red-400 hover:bg-red-500/10"
          >
            <RefreshCw className="size-3.5" />
            Retry
          </Button>
        </div>
      </Alert>
    )
  }

  const balances = data?.balances ?? []

  if (balances.length === 0) {
    return <EmptyState message="No balance data found for this employee." />
  }

  const lastSynced = dataUpdatedAt
    ? new Date(dataUpdatedAt).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      })
    : null

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        {lastSynced && (
          <p className="text-xs text-slate-500">
            Last synced at {lastSynced}
          </p>
        )}
        <Button
          variant="ghost"
          size="sm"
          onClick={handleRefresh}
          disabled={isFetching}
          className="ml-auto text-slate-400 hover:text-slate-200"
        >
          <RefreshCw
            className={`size-3.5 ${isFetching ? 'animate-spin' : ''}`}
          />
          {isFetching ? 'Refreshing...' : 'Refresh'}
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {balances.map((balance) => (
          <BalanceCard
            key={`${balance.locationId}-${balance.balanceType}`}
            balance={balance}
            isFetching={isFetching}
          />
        ))}
      </div>
    </div>
  )
}
