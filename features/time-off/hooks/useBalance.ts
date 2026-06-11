'use client'

import { useQuery } from '@tanstack/react-query'
import { fetchBalance } from '@/features/time-off/api/hcmClient'
import { QueryKeys } from '@/lib/query-client'
import type { Balance } from '@/features/time-off/types'

export function useBalance(
  employeeId: string | null,
  locationId: string | null,
  balanceType: string | null,
) {
  return useQuery<Balance>({
    queryKey: QueryKeys.balance(employeeId ?? '', locationId ?? '', balanceType ?? ''),
    queryFn: () => fetchBalance(employeeId!, locationId!, balanceType!),
    enabled: !!employeeId && !!locationId && !!balanceType,
    staleTime: 10_000,
    refetchOnWindowFocus: true,
  })
}
