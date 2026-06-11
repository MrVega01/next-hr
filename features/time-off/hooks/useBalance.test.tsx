import React from 'react'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { server } from '@/lib/msw/server'
import { useBalance } from '@/features/time-off/hooks/useBalance'
import type { Balance } from '@/features/time-off/types'

// The fetchBalance function hits /api/hcm/balances/:employeeId/:locationId
// We set up handlers that respond to that URL pattern.
const aliceVacationBalance: Balance = {
  employeeId: 'emp-001',
  locationId: 'loc-nyc',
  balanceType: 'vacation',
  availableDays: 15,
  pendingDays: 0,
  version: 'v-test-001',
  asOf: new Date().toISOString(),
}

function makeWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
    },
  })
  function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
  return { wrapper: Wrapper, queryClient }
}

beforeAll(() => {
  server.listen()
  // Add a handler for the URL pattern used by fetchBalance
  server.use(
    http.get('/api/hcm/balances/:employeeId/:locationId', ({ params }) => {
      const { employeeId, locationId } = params as { employeeId: string; locationId: string }
      if (employeeId === 'emp-001' && locationId === 'loc-nyc') {
        return HttpResponse.json({ balance: aliceVacationBalance })
      }
      return HttpResponse.json({ error: 'Not found' }, { status: 404 })
    }),
  )
})

afterEach(() => {
  server.resetHandlers()
  // Re-add the balance handler after reset
  server.use(
    http.get('/api/hcm/balances/:employeeId/:locationId', ({ params }) => {
      const { employeeId, locationId } = params as { employeeId: string; locationId: string }
      if (employeeId === 'emp-001' && locationId === 'loc-nyc') {
        return HttpResponse.json({ balance: aliceVacationBalance })
      }
      return HttpResponse.json({ error: 'Not found' }, { status: 404 })
    }),
  )
})

afterAll(() => {
  server.close()
})

describe('useBalance', () => {
  it('loading state — isLoading is true immediately after render', () => {
    const { wrapper } = makeWrapper()
    const { result } = renderHook(
      () => useBalance('emp-001', 'loc-nyc', 'vacation'),
      { wrapper },
    )
    expect(result.current.isLoading).toBe(true)
  })

  it('successful fetch — data is populated with Alice vacation balance (availableDays: 15)', async () => {
    const { wrapper } = makeWrapper()
    const { result } = renderHook(
      () => useBalance('emp-001', 'loc-nyc', 'vacation'),
      { wrapper },
    )

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toBeDefined()
    expect(result.current.data!.availableDays).toBe(15)
    expect(result.current.data!.employeeId).toBe('emp-001')
  })

  it('disabled when null — isLoading is false and data is undefined when params are null', () => {
    const { wrapper } = makeWrapper()
    const { result } = renderHook(
      () => useBalance(null, null, null),
      { wrapper },
    )
    expect(result.current.isLoading).toBe(false)
    expect(result.current.data).toBeUndefined()
  })
})
