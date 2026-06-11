export type BalanceType = 'vacation' | 'sick' | 'personal'

export type RequestStatus =
  | 'draft'
  | 'optimistic-pending'
  | 'submitted'
  | 'approved'
  | 'denied'
  | 'rolled-back'
  | 'needs-attention'

export interface Balance {
  employeeId: string
  locationId: string
  balanceType: BalanceType
  availableDays: number
  pendingDays: number
  version: string  // HCM etag for optimistic concurrency
  asOf: string     // ISO timestamp of last HCM read
}

export interface TimeOffRequest {
  id: string
  employeeId: string
  employeeName?: string
  locationId: string
  balanceType: BalanceType
  days: number
  startDate: string  // ISO date
  endDate: string    // ISO date
  notes?: string
  status: RequestStatus
  createdAt: string
  updatedAt: string
  baseVersion: string  // HCM balance version at time of request
  hcmRejectionReason?: string
  reconciledAt?: string
}

export interface Employee {
  id: string
  name: string
  email: string
  managerId?: string
  locationId: string
  hireDate: string
}

export interface HcmBalanceResponse {
  balance: Balance
}

export interface HcmBatchBalancesResponse {
  balances: Balance[]
  fetchedAt: string
}

export interface HcmSubmitResult {
  success: boolean
  requestId?: string
  error?: string
  errorCode?: 'INSUFFICIENT_BALANCE' | 'INVALID_DIMENSION' | 'VERSION_CONFLICT' | 'SILENT_FAILURE'
  updatedBalance?: Balance
}
