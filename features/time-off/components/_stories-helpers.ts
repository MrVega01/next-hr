import type { Balance, TimeOffRequest } from '@/features/time-off/types'

export function makeBalance(overrides?: Partial<Balance>): Balance {
  return {
    employeeId: 'emp-001',
    locationId: 'loc-nyc',
    balanceType: 'vacation',
    availableDays: 15,
    pendingDays: 0,
    version: 'v1000000',
    asOf: new Date().toISOString(),
    ...overrides,
  }
}

export function makeRequest(overrides?: Partial<TimeOffRequest>): TimeOffRequest {
  const now = new Date().toISOString()
  return {
    id: 'req-001',
    employeeId: 'emp-001',
    locationId: 'loc-nyc',
    balanceType: 'vacation',
    days: 3,
    startDate: '2026-07-01',
    endDate: '2026-07-03',
    status: 'submitted',
    createdAt: now,
    updatedAt: now,
    baseVersion: 'v1000000',
    ...overrides,
  }
}
