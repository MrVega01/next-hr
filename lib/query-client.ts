import { QueryClient } from '@tanstack/react-query'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      retry: 2,
      refetchOnWindowFocus: true,
    },
  },
})

export const QueryKeys = {
  balance: (employeeId: string, locationId: string, balanceType: string) =>
    ['balance', employeeId, locationId, balanceType] as const,
  balances: (employeeId: string) =>
    ['balances', employeeId] as const,
  requests: (employeeId: string) =>
    ['requests', employeeId] as const,
  allRequests: () =>
    ['requests'] as const,
}
