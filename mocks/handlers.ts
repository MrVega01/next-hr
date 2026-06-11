import { delay, http, HttpResponse } from 'msw'
import {
  approveRequest,
  denyRequest,
  getBatchBalances,
  getBalance,
  getEmployees,
  getRequest,
  getRequests,
  resetState,
  setForceNextConflict,
  setForceNextSilentFail,
  setSilentFailRate,
  submitRequest,
  triggerAnniversaryBonus,
} from '@/mocks/hcm-engine'
import type { BalanceType, TimeOffRequest } from '@/features/time-off/types'

export const handlers = [
  // GET /api/hcm/balance?employeeId=&locationId=&balanceType=
  http.get('/api/hcm/balance', async ({ request }) => {
    await delay(200)
    const url = new URL(request.url)
    const employeeId = url.searchParams.get('employeeId')
    const locationId = url.searchParams.get('locationId')
    const balanceType = url.searchParams.get('balanceType') as BalanceType | null

    if (!employeeId || !locationId || !balanceType) {
      return HttpResponse.json(
        { error: 'employeeId, locationId, and balanceType are required' },
        { status: 400 },
      )
    }

    const balance = getBalance(employeeId, locationId, balanceType)
    if (!balance) {
      return HttpResponse.json({ error: 'Balance not found' }, { status: 404 })
    }

    return HttpResponse.json({ balance })
  }),

  // GET /api/hcm/balances?employeeId=
  http.get('/api/hcm/balances', async ({ request }) => {
    await delay(800)
    const url = new URL(request.url)
    const employeeId = url.searchParams.get('employeeId')

    if (!employeeId) {
      return HttpResponse.json({ error: 'employeeId is required' }, { status: 400 })
    }

    const balances = getBatchBalances(employeeId)
    return HttpResponse.json({ balances, fetchedAt: new Date().toISOString() })
  }),

  // GET /api/hcm/employees
  http.get('/api/hcm/employees', async () => {
    await delay(50)
    const employees = getEmployees()
    return HttpResponse.json({ employees })
  }),

  // POST /api/hcm/requests
  http.post('/api/hcm/requests', async ({ request }) => {
    await delay(200)
    const body = (await request.json()) as Omit<
      TimeOffRequest,
      'id' | 'status' | 'createdAt' | 'updatedAt'
    >
    const result = submitRequest(body)
    const status = result.success ? 200 : result.errorCode === 'INSUFFICIENT_BALANCE' ? 422 : 400
    return HttpResponse.json(result, { status })
  }),

  // GET /api/hcm/requests?employeeId=
  http.get('/api/hcm/requests', async ({ request }) => {
    const url = new URL(request.url)
    const employeeId = url.searchParams.get('employeeId') ?? undefined
    const requests = getRequests(employeeId)
    return HttpResponse.json({ requests })
  }),

  // PUT /api/hcm/requests/:requestId/approve
  http.put('/api/hcm/requests/:requestId/approve', async ({ request, params }) => {
    const requestId = params['requestId'] as string
    const body = (await request.json()) as { expectedVersion: string }
    const result = approveRequest(requestId, body.expectedVersion)
    const status = result.success
      ? 200
      : result.errorCode === 'VERSION_CONFLICT'
        ? 409
        : result.errorCode === 'INSUFFICIENT_BALANCE'
          ? 422
          : 400
    return HttpResponse.json(result, { status })
  }),

  // PUT /api/hcm/requests/:requestId/deny
  http.put('/api/hcm/requests/:requestId/deny', async ({ params }) => {
    const requestId = params['requestId'] as string
    const result = denyRequest(requestId)
    const status = result.success ? 200 : 400
    return HttpResponse.json(result, { status })
  }),

  // POST /api/hcm/test/trigger-anniversary
  http.post('/api/hcm/test/trigger-anniversary', async ({ request }) => {
    const body = (await request.json()) as { employeeId: string }
    const result = triggerAnniversaryBonus(body.employeeId)
    return HttpResponse.json(result, { status: result.success ? 200 : 400 })
  }),

  // POST /api/hcm/test/reset
  http.post('/api/hcm/test/reset', async () => {
    resetState()
    return HttpResponse.json({ ok: true })
  }),

  // POST /api/hcm/test/configure
  http.post('/api/hcm/test/configure', async ({ request }) => {
    const body = (await request.json()) as {
      silentFailRate?: number
      forceNextSilentFail?: boolean
      forceNextConflict?: boolean
    }
    if (body.silentFailRate !== undefined) setSilentFailRate(body.silentFailRate)
    if (body.forceNextSilentFail !== undefined) setForceNextSilentFail(body.forceNextSilentFail)
    if (body.forceNextConflict !== undefined) setForceNextConflict(body.forceNextConflict)
    return HttpResponse.json({ ok: true })
  }),
]

// Re-export individual request for direct use in tests
export { getRequest }
