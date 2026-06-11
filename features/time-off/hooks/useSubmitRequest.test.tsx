import React from 'react'
import { renderHook, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse, delay } from 'msw'
import { server } from '@/lib/msw/server'
import { useSubmitRequest } from '@/features/time-off/hooks/useSubmitRequest'
import { useBalance } from '@/features/time-off/hooks/useBalance'
import { QueryKeys } from '@/lib/query-client'
import { useUiStore } from '@/features/time-off/store/uiStore'
import type { Balance } from '@/features/time-off/types'
import { resetState, setSilentFailRate } from '@/mocks/hcm-engine'

// Use a path the balance handler in beforeAll can serve
const ALICE_BALANCE_URL = '/api/hcm/balances/emp-001/loc-nyc'

const aliceVacationBalance: Balance = {
  employeeId: 'emp-001',
  locationId: 'loc-nyc',
  balanceType: 'vacation',
  availableDays: 15,
  pendingDays: 0,
  version: 'v-test-seed',
  asOf: new Date().toISOString(),
}

const aliceSubmitPayload = {
  employeeId: 'emp-001',
  locationId: 'loc-nyc',
  balanceType: 'vacation' as const,
  days: 3,
  startDate: '2025-09-01',
  endDate: '2025-09-03',
  baseVersion: 'v-test-seed',
}

let queryClient: QueryClient

function makeWrapper(qc: QueryClient) {
  function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  }
  return Wrapper
}

beforeAll(() => {
  server.listen()
})

beforeEach(() => {
  resetState()
  setSilentFailRate(0)

  // Fresh query client — gcTime > 0 so manual setQueryData isn't immediately evicted
  queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 60_000, // keep data long enough for assertions
        staleTime: 0,
      },
      mutations: { retry: false },
    },
  })

  // Pre-seed Alice's balance in the query cache
  queryClient.setQueryData<Balance>(
    QueryKeys.balance('emp-001', 'loc-nyc', 'vacation'),
    aliceVacationBalance,
  )

  // Reset Zustand store
  useUiStore.setState({
    activePersona: 'employee',
    selectedEmployeeId: null,
    optimisticRegistry: {},
    toasts: [],
  })
})

afterEach(() => {
  server.resetHandlers()
  queryClient.clear()
})

afterAll(() => {
  server.close()
})

describe('useSubmitRequest', () => {
  it('optimistic update — balance decremented by 3 before server responds', async () => {
    // Override POST handler to add a long delay so we can check the cache mid-flight
    server.use(
      http.post('/api/hcm/requests', async () => {
        await delay(800)
        return HttpResponse.json({
          success: true,
          requestId: 'req-101',
          updatedBalance: {
            ...aliceVacationBalance,
            availableDays: 12,
            pendingDays: 3,
            version: 'v-after-submit',
          },
        })
      }),
    )

    const wrapper = makeWrapper(queryClient)
    const { result } = renderHook(() => useSubmitRequest(), { wrapper })

    // Fire mutation without awaiting resolution
    act(() => {
      result.current.mutate(aliceSubmitPayload)
    })

    // Wait for onMutate to complete (cancelQueries + setQueryData)
    await waitFor(() => {
      const cached = queryClient.getQueryData<Balance>(
        QueryKeys.balance('emp-001', 'loc-nyc', 'vacation'),
      )
      expect(cached?.availableDays).toBe(12)
    }, { timeout: 500 })
  })

  it('rollback on error — balance restored to 15 when server returns 422', async () => {
    // Override to return 422 — hcmClient.submitTimeOffRequest catches non-ok and returns {success:false}
    // The mutation resolves via onSuccess (since submitTimeOffRequest doesn't throw on non-ok)
    // OR it throws if apiFetch throws — let's check: apiFetch throws on !res.ok
    // submitTimeOffRequest catches and returns {success: false} so onSuccess is called, not onError
    // onSuccess handles success:false by rolling back
    server.use(
      http.post('/api/hcm/requests', () => {
        return HttpResponse.json(
          { success: false, error: 'Insufficient balance', errorCode: 'INSUFFICIENT_BALANCE' },
          { status: 422 },
        )
      }),
    )

    const wrapper = makeWrapper(queryClient)
    const { result } = renderHook(() => useSubmitRequest(), { wrapper })

    await act(async () => {
      result.current.mutate(aliceSubmitPayload)
    })

    await waitFor(() => expect(result.current.isPending).toBe(false))

    // Balance should be rolled back — onSuccess with success:false restores previousBalance
    const cached = queryClient.getQueryData<Balance>(
      QueryKeys.balance('emp-001', 'loc-nyc', 'vacation'),
    )
    // onSettled also fires invalidateQueries; but with gcTime=60s and no observer, data persists
    // After rollback in onSuccess + invalidation in onSettled, data may be stale but present
    expect(cached?.availableDays).toBe(15)
  })

  it('success — onMutate applies optimistic update and mutation completes successfully', async () => {
    // The default MSW handlers use the engine with silentFailRate=0
    // submitTimeOffRequest -> apiFetch throws on non-ok, but engine returns 200 on success
    // However the default POST handler is in the global handlers list.
    // engine.submitRequest will work correctly (silentFailRate=0, Alice has 15 days)
    const wrapper = makeWrapper(queryClient)
    const { result } = renderHook(() => useSubmitRequest(), { wrapper })

    await act(async () => {
      result.current.mutate(aliceSubmitPayload)
    })

    await waitFor(() => expect(result.current.isPending).toBe(false))
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    // Mutation succeeded — the success toast should be registered
    const { toasts } = useUiStore.getState()
    const successToast = toasts.find((t) => t.type === 'success')
    expect(successToast).toBeDefined()
    expect(successToast!.message).toMatch(/submitted/i)
  })
})
