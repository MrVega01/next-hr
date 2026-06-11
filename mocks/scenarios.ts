import type { BalanceType } from '@/features/time-off/types'

export interface ScenarioConfig {
  employeeId: string
  locationId: string
  balanceType?: BalanceType
  chaosConfig?: {
    silentFailRate?: number
    forceNextSilentFail?: boolean
    forceNextConflict?: boolean
  }
  description: string
}

export const Scenarios = {
  HAPPY_PATH: {
    employeeId: 'emp-001',
    locationId: 'loc-nyc',
    balanceType: 'vacation',
    description: 'Alice has 15 vacation days, submits 3 days',
  },
  INSUFFICIENT_BALANCE: {
    employeeId: 'emp-003',
    locationId: 'loc-nyc',
    balanceType: 'vacation',
    description: 'Carol has only 5 vacation days, requests 8',
  },
  SILENT_FAILURE: {
    employeeId: 'emp-001',
    locationId: 'loc-nyc',
    balanceType: 'vacation',
    chaosConfig: { forceNextSilentFail: true },
    description:
      'HCM returns 200 but does not persist — optimistic shows then reconciliation catches it',
  },
  VERSION_CONFLICT: {
    employeeId: 'emp-002',
    locationId: 'loc-sf',
    balanceType: 'vacation',
    chaosConfig: { forceNextConflict: true },
    description: 'Manager approves a request whose version has changed',
  },
  ANNIVERSARY_BONUS: {
    employeeId: 'emp-001',
    locationId: 'loc-nyc',
    description: 'Work anniversary triggers +3 vacation days mid-session',
  },
  LOW_BALANCE: {
    employeeId: 'emp-003',
    locationId: 'loc-nyc',
    balanceType: 'vacation',
    description: 'Carol nearly out of vacation days',
  },
  MANAGER_VIEW: {
    employeeId: 'emp-001',
    locationId: 'loc-nyc',
    description: 'Manager (Alice) reviewing team requests',
  },
} satisfies Record<string, ScenarioConfig>
