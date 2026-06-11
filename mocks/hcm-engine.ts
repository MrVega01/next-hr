import type { Balance, BalanceType, Employee, HcmSubmitResult, TimeOffRequest } from '@/features/time-off/types'

// ─── Internal types ────────────────────────────────────────────────────────────

type InternalStatus = TimeOffRequest['status'] | 'silent-failure'

interface InternalRequest extends Omit<TimeOffRequest, 'status'> {
  status: InternalStatus
}

// ─── State ─────────────────────────────────────────────────────────────────────

type BalanceKey = `${string}:${string}:${BalanceType}`

function balanceKey(employeeId: string, locationId: string, balanceType: BalanceType): BalanceKey {
  return `${employeeId}:${locationId}:${balanceType}`
}

function nowVersion(): string {
  return `v${Date.now()}`
}

function nowIso(): string {
  return new Date().toISOString()
}

// ─── Seed data ─────────────────────────────────────────────────────────────────

function buildSeedBalances(): Map<BalanceKey, Balance> {
  const m = new Map<BalanceKey, Balance>()
  const ts = nowIso()
  const v = nowVersion()

  const entries: Array<[string, string, BalanceType, number, number]> = [
    // Alice NYC
    ['emp-001', 'loc-nyc', 'vacation', 15, 0],
    ['emp-001', 'loc-nyc', 'sick', 10, 0],
    ['emp-001', 'loc-nyc', 'personal', 3, 0],
    // Bob SF
    ['emp-002', 'loc-sf', 'vacation', 12, 0],
    ['emp-002', 'loc-sf', 'sick', 8, 0],
    ['emp-002', 'loc-sf', 'personal', 3, 0],
    // Carol NYC — low vacation balance for testing
    ['emp-003', 'loc-nyc', 'vacation', 5, 0],
    ['emp-003', 'loc-nyc', 'sick', 10, 0],
    ['emp-003', 'loc-nyc', 'personal', 2, 0],
  ]

  for (const [employeeId, locationId, balanceType, availableDays, pendingDays] of entries) {
    m.set(balanceKey(employeeId, locationId, balanceType), {
      employeeId,
      locationId,
      balanceType,
      availableDays,
      pendingDays,
      version: v,
      asOf: ts,
    })
  }

  return m
}

function buildSeedEmployees(): Map<string, Employee> {
  const m = new Map<string, Employee>()

  const employees: Employee[] = [
    {
      id: 'emp-001',
      name: 'Alice Johnson',
      email: 'alice@example.com',
      locationId: 'loc-nyc',
      hireDate: '2019-06-10',
    },
    {
      id: 'emp-002',
      name: 'Bob Martinez',
      email: 'bob@example.com',
      locationId: 'loc-sf',
      hireDate: '2020-03-15',
    },
    {
      id: 'emp-003',
      name: 'Carol Smith',
      email: 'carol@example.com',
      managerId: 'emp-001',
      locationId: 'loc-nyc',
      hireDate: '2022-01-20',
    },
  ]

  for (const emp of employees) {
    m.set(emp.id, emp)
  }

  return m
}

function buildSeedRequests(): Map<string, InternalRequest> {
  const m = new Map<string, InternalRequest>()

  const requests: InternalRequest[] = [
    {
      id: 'req-seed-001',
      employeeId: 'emp-001',
      locationId: 'loc-nyc',
      balanceType: 'vacation',
      days: 5,
      startDate: '2025-07-04',
      endDate: '2025-07-10',
      notes: 'Summer vacation',
      status: 'approved',
      createdAt: '2025-06-01T10:00:00.000Z',
      updatedAt: '2025-06-02T09:00:00.000Z',
      baseVersion: 'v1748736000000',
    },
    {
      id: 'req-seed-002',
      employeeId: 'emp-002',
      locationId: 'loc-sf',
      balanceType: 'sick',
      days: 2,
      startDate: '2025-05-20',
      endDate: '2025-05-21',
      status: 'approved',
      createdAt: '2025-05-19T08:00:00.000Z',
      updatedAt: '2025-05-19T12:00:00.000Z',
      baseVersion: 'v1747612800000',
    },
    {
      id: 'req-seed-003',
      employeeId: 'emp-003',
      locationId: 'loc-nyc',
      balanceType: 'vacation',
      days: 3,
      startDate: '2025-08-11',
      endDate: '2025-08-13',
      status: 'approved',
      createdAt: '2025-07-15T14:00:00.000Z',
      updatedAt: '2025-07-16T09:00:00.000Z',
      baseVersion: 'v1752537600000',
    },
  ]

  for (const req of requests) {
    m.set(req.id, req)
  }

  return m
}

// ─── Live state ────────────────────────────────────────────────────────────────

let balances: Map<BalanceKey, Balance> = buildSeedBalances()
let employees: Map<string, Employee> = buildSeedEmployees()
let requests: Map<string, InternalRequest> = buildSeedRequests()
let requestCounter = 100

// ─── Chaos configuration ───────────────────────────────────────────────────────

let silentFailRate = 0.1
let forceNextSilentFail = false
let forceNextConflict = false

function shouldSilentFail(): boolean {
  if (forceNextSilentFail) {
    forceNextSilentFail = false
    return true
  }
  return Math.random() < silentFailRate
}

function shouldConflict(): boolean {
  if (forceNextConflict) {
    forceNextConflict = false
    return true
  }
  return false
}

// ─── Exported functions ────────────────────────────────────────────────────────

export function getBalance(
  employeeId: string,
  locationId: string,
  balanceType: BalanceType,
): Balance | null {
  return balances.get(balanceKey(employeeId, locationId, balanceType)) ?? null
}

export function getBatchBalances(employeeId: string): Balance[] {
  const result: Balance[] = []
  for (const balance of balances.values()) {
    if (balance.employeeId === employeeId) {
      result.push(balance)
    }
  }
  return result
}

export function getEmployees(): Employee[] {
  return Array.from(employees.values())
}

export function getEmployee(id: string): Employee | null {
  return employees.get(id) ?? null
}

export function getRequests(employeeId?: string): TimeOffRequest[] {
  const all = Array.from(requests.values())
  const filtered = employeeId ? all.filter((r) => r.employeeId === employeeId) : all
  // Strip internal silent-failure status — expose as 'submitted' to the outside
  return filtered.map((r) => ({
    ...r,
    employeeName: getEmployee(r.employeeId)?.name ?? r.employeeId,
    status: r.status === 'silent-failure' ? 'submitted' : r.status,
  })) as TimeOffRequest[]
}

export function getRequest(id: string): TimeOffRequest | null {
  const r = requests.get(id)
  if (!r) return null
  return {
    ...r,
    status: r.status === 'silent-failure' ? 'submitted' : r.status,
  } as TimeOffRequest
}

export function submitRequest(
  req: Omit<TimeOffRequest, 'id' | 'status' | 'createdAt' | 'updatedAt'>,
): HcmSubmitResult {
  const employee = getEmployee(req.employeeId)
  if (!employee) {
    return { success: false, error: 'Employee not found', errorCode: 'INVALID_DIMENSION' }
  }
  if (employee.locationId !== req.locationId) {
    return {
      success: false,
      error: `Employee ${req.employeeId} does not belong to location ${req.locationId}`,
      errorCode: 'INVALID_DIMENSION',
    }
  }

  const balance = getBalance(req.employeeId, req.locationId, req.balanceType)
  if (!balance) {
    return { success: false, error: 'Balance not found', errorCode: 'INVALID_DIMENSION' }
  }
  if (balance.availableDays < req.days) {
    return {
      success: false,
      error: `Insufficient balance: requested ${req.days} days but only ${balance.availableDays} available`,
      errorCode: 'INSUFFICIENT_BALANCE',
    }
  }

  const requestId = `req-${++requestCounter}`
  const now = nowIso()

  const silentFail = shouldSilentFail()

  const newRequest: InternalRequest = {
    id: requestId,
    ...req,
    status: silentFail ? 'silent-failure' : 'submitted',
    createdAt: now,
    updatedAt: now,
  }

  requests.set(requestId, newRequest)

  if (!silentFail) {
    // Decrement balance
    const key = balanceKey(req.employeeId, req.locationId, req.balanceType)
    const current = balances.get(key)!
    const updated: Balance = {
      ...current,
      availableDays: current.availableDays - req.days,
      pendingDays: current.pendingDays + req.days,
      version: nowVersion(),
      asOf: now,
    }
    balances.set(key, updated)
    return { success: true, requestId, updatedBalance: updated }
  }

  // Silent failure: report success but do NOT decrement balance
  return { success: true, requestId }
}

export function approveRequest(requestId: string, expectedVersion: string): HcmSubmitResult {
  const request = requests.get(requestId)
  if (!request) {
    return { success: false, error: 'Request not found', errorCode: 'INVALID_DIMENSION' }
  }

  const balance = getBalance(request.employeeId, request.locationId, request.balanceType)
  if (!balance) {
    return { success: false, error: 'Balance not found', errorCode: 'INVALID_DIMENSION' }
  }

  if (shouldConflict() || balance.version !== expectedVersion) {
    return {
      success: false,
      error: `Version conflict: expected ${expectedVersion} but current is ${balance.version}`,
      errorCode: 'VERSION_CONFLICT',
    }
  }

  // availableDays was already decremented on submit; the "slot" for this request
  // is held in pendingDays. Check there instead to avoid false rejections when
  // multiple requests are pending simultaneously.
  if (balance.pendingDays < request.days) {
    return {
      success: false,
      error: `Insufficient balance: requested ${request.days} days but only ${balance.pendingDays} reserved`,
      errorCode: 'INSUFFICIENT_BALANCE',
    }
  }

  const now = nowIso()
  requests.set(requestId, { ...request, status: 'approved', updatedAt: now })

  const key = balanceKey(request.employeeId, request.locationId, request.balanceType)
  const updated: Balance = {
    ...balance,
    // availableDays was already reduced on submit — do not decrement again.
    // Only clear the pending reservation for this request.
    pendingDays: Math.max(0, balance.pendingDays - request.days),
    version: nowVersion(),
    asOf: now,
  }
  balances.set(key, updated)

  return { success: true, requestId, updatedBalance: updated }
}

export function denyRequest(requestId: string): HcmSubmitResult {
  const request = requests.get(requestId)
  if (!request) {
    return { success: false, error: 'Request not found', errorCode: 'INVALID_DIMENSION' }
  }

  const now = nowIso()
  requests.set(requestId, { ...request, status: 'denied', updatedAt: now })

  // If request was submitted (not silent-failure), restore pending balance
  if (request.status === 'submitted') {
    const key = balanceKey(request.employeeId, request.locationId, request.balanceType)
    const balance = balances.get(key)
    if (balance) {
      const updated: Balance = {
        ...balance,
        // Restore the days that were reserved when the request was submitted.
        availableDays: balance.availableDays + request.days,
        pendingDays: Math.max(0, balance.pendingDays - request.days),
        version: nowVersion(),
        asOf: now,
      }
      balances.set(key, updated)
      return { success: true, requestId, updatedBalance: updated }
    }
  }

  return { success: true, requestId }
}

export function triggerAnniversaryBonus(
  employeeId: string,
): { success: boolean; updatedBalance?: Balance } {
  const employee = getEmployee(employeeId)
  if (!employee) {
    return { success: false }
  }

  const key = balanceKey(employeeId, employee.locationId, 'vacation')
  const balance = balances.get(key)
  if (!balance) {
    return { success: false }
  }

  const now = nowIso()
  const updated: Balance = {
    ...balance,
    availableDays: balance.availableDays + 3,
    version: nowVersion(),
    asOf: now,
  }
  balances.set(key, updated)

  return { success: true, updatedBalance: updated }
}

export function resetState(): void {
  balances = buildSeedBalances()
  employees = buildSeedEmployees()
  requests = buildSeedRequests()
  requestCounter = 100
  silentFailRate = 0.1
  forceNextSilentFail = false
  forceNextConflict = false
}

export function setSilentFailRate(rate: number): void {
  silentFailRate = Math.max(0, Math.min(1, rate))
}

export function setForceNextSilentFail(val: boolean): void {
  forceNextSilentFail = val
}

export function setForceNextConflict(val: boolean): void {
  forceNextConflict = val
}
