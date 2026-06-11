import type {
  Balance,
  Employee,
  HcmBatchBalancesResponse,
  HcmSubmitResult,
  TimeOffRequest,
} from '@/features/time-off/types'

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? ''

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  })
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText)
    throw new Error(`[hcmClient] ${res.status} ${text}`)
  }
  return res.json() as Promise<T>
}

export async function fetchBalance(
  employeeId: string,
  locationId: string,
  balanceType: string,
): Promise<Balance> {
  const params = new URLSearchParams({ employeeId, locationId, balanceType })
  const data = await apiFetch<{ balance: Balance }>(`/api/hcm/balance?${params}`)
  return data.balance
}

export async function fetchBalances(
  employeeId: string,
): Promise<HcmBatchBalancesResponse> {
  const params = new URLSearchParams({ employeeId })
  return apiFetch<HcmBatchBalancesResponse>(`/api/hcm/balances?${params}`)
}

export async function submitTimeOffRequest(
  req: Omit<TimeOffRequest, 'id' | 'status' | 'createdAt' | 'updatedAt'>,
): Promise<HcmSubmitResult> {
  try {
    return await apiFetch<HcmSubmitResult>('/api/hcm/requests', {
      method: 'POST',
      body: JSON.stringify(req),
    })
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    }
  }
}

export async function approveRequest(
  requestId: string,
  employeeId: string,
  locationId: string,
  currentVersion: string,
): Promise<HcmSubmitResult> {
  try {
    return await apiFetch<HcmSubmitResult>(
      `/api/hcm/requests/${requestId}/approve`,
      {
        method: 'PUT',
        body: JSON.stringify({ expectedVersion: currentVersion }),
      },
    )
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    }
  }
}

export async function denyRequest(requestId: string): Promise<HcmSubmitResult> {
  try {
    return await apiFetch<HcmSubmitResult>(
      `/api/hcm/requests/${requestId}/deny`,
      { method: 'PUT' },
    )
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    }
  }
}

export async function triggerAnniversaryBonus(
  employeeId: string,
): Promise<{ success: boolean }> {
  try {
    return await apiFetch<{ success: boolean }>(
      '/api/hcm/test/trigger-anniversary',
      { method: 'POST', body: JSON.stringify({ employeeId }) },
    )
  } catch (err) {
    return { success: false }
  }
}

export async function fetchRequests(
  employeeId?: string,
): Promise<{ requests: TimeOffRequest[] }> {
  const url = employeeId
    ? `/api/hcm/requests?employeeId=${encodeURIComponent(employeeId)}`
    : '/api/hcm/requests'
  return apiFetch<{ requests: TimeOffRequest[] }>(url)
}

export async function denyRequestHcm(
  requestId: string,
): Promise<HcmSubmitResult> {
  try {
    return await apiFetch<HcmSubmitResult>(
      `/api/hcm/requests/${requestId}/deny`,
      { method: 'PUT' },
    )
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    }
  }
}
