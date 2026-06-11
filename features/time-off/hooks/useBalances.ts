'use client'

import { useQuery } from '@tanstack/react-query'
import { fetchBalances } from '@/features/time-off/api/hcmClient'
import { QueryKeys } from '@/lib/query-client'
import type { HcmBatchBalancesResponse } from '@/features/time-off/types'

export function useBalances(employeeId: string | null) {
  const query = useQuery<HcmBatchBalancesResponse>({
    queryKey: QueryKeys.balances(employeeId ?? ''),
    queryFn: () => fetchBalances(employeeId!),
    enabled: !!employeeId,
    refetchInterval: 60_000,
  })

  return {
    data: query.data,
    isLoading: query.isLoading,
    isError: query.isError,
    isFetching: query.isFetching,
    dataUpdatedAt: query.dataUpdatedAt,
  }
}
