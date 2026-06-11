'use client'

import { useQuery } from '@tanstack/react-query'
import { fetchRequests } from '@/features/time-off/api/hcmClient'
import { QueryKeys } from '@/lib/query-client'
import type { TimeOffRequest } from '@/features/time-off/types'

export function useRequests(employeeId: string | null) {
  return useQuery<{ requests: TimeOffRequest[] }>({
    queryKey: QueryKeys.requests(employeeId ?? ''),
    queryFn: () => fetchRequests(employeeId!),
    enabled: !!employeeId,
  })
}

export function useAllRequests() {
  return useQuery<{ requests: TimeOffRequest[] }>({
    queryKey: QueryKeys.allRequests(),
    queryFn: () => fetchRequests(),
  })
}
