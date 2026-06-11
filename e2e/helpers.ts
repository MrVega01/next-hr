import { Page } from '@playwright/test'

/**
 * Resets all HCM state to initial fixtures.
 * Call in beforeEach to ensure test isolation.
 */
export async function resetHcm(page: Page) {
  await page.request.post('/api/hcm/test/reset')
}

/**
 * Configures the HCM chaos/fault-injection engine.
 * - silentFailRate: 0–1 probability of a silent failure on any submit
 * - forceNextSilentFail: guarantee the next submit silently fails
 * - forceNextConflict: guarantee the next approval hits a VERSION_CONFLICT
 */
export async function configureHcm(
  page: Page,
  config: {
    silentFailRate?: number
    forceNextSilentFail?: boolean
    forceNextConflict?: boolean
  },
) {
  await page.request.post('/api/hcm/test/configure', { data: config })
}

/**
 * Triggers a work-anniversary bonus for the given employee.
 * Adds +3 vacation days to their balance in the HCM engine.
 */
export async function triggerAnniversary(page: Page, employeeId: string) {
  await page.request.post('/api/hcm/test/trigger-anniversary', {
    data: { employeeId },
  })
}

/**
 * Submits a time-off request directly via the HCM API, bypassing the UI.
 * Useful for seeding state in manager-view tests.
 */
export async function submitRequestViaApi(
  page: Page,
  data: {
    employeeId: string
    locationId: string
    balanceType: string
    days: number
    startDate: string
    endDate: string
    baseVersion: string
    notes?: string
  },
) {
  return page.request.post('/api/hcm/requests', { data })
}

/**
 * Fetches the current balance for an employee/location/type directly from
 * the HCM API. Returns the parsed balance object so tests can read the
 * current `version` field needed to seed API requests.
 */
export async function getBalance(
  page: Page,
  employeeId: string,
  locationId: string,
  balanceType: string,
) {
  const resp = await page.request.get(
    `/api/hcm/balance?employeeId=${employeeId}&locationId=${locationId}&balanceType=${balanceType}`,
  )
  const json = await resp.json() as { balance: { version: string; availableDays: number } }
  return json.balance
}
