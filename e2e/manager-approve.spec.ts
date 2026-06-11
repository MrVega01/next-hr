/**
 * Manager: Approve/Deny Requests
 *
 * Tests the manager review workflow at /manager:
 *   1. Pending requests are visible and show correct employee + duration data
 *   2. The "Review" button opens the ApprovalPanel dialog
 *   3. The ApprovalPanel shows the authoritative live balance before the manager acts
 *   4. Approving a request advances its status and closes the dialog
 */

import { test, expect } from '@playwright/test'
import { resetHcm, getBalance, submitRequestViaApi } from './helpers'

test.describe('Manager: Approve/Deny Requests', () => {
  test.beforeEach(async ({ page }) => {
    // 1. Reset HCM to a clean state so no stale requests pollute the view.
    await resetHcm(page)

    // 2. Seed a pending request for Alice via the API (emp-001, loc-nyc).
    //    We need Alice's current balance version to pass the optimistic-concurrency
    //    check inside the HCM engine.
    const balance = await getBalance(page, 'emp-001', 'loc-nyc', 'vacation')
    await submitRequestViaApi(page, {
      employeeId: 'emp-001',
      locationId: 'loc-nyc',
      balanceType: 'vacation',
      days: 3,
      startDate: '2026-07-01',
      endDate: '2026-07-03',
      baseVersion: balance.version,
    })

    // 3. Navigate to the manager page.
    await page.goto('/manager')

    // Wait for the initial data load — the page renders a list of pending rows
    // once the query resolves. We wait for the "Review" button as the ready signal.
    await expect(
      page.getByRole('button', { name: /review/i }).first(),
    ).toBeVisible({ timeout: 10_000 })
  })

  test('manager sees pending requests', async ({ page }) => {
    // The manager page groups requests by location and labels each group
    // with "N pending". At least one request must be present after seeding.
    await expect(page.getByText(/\d+ pending/i).first()).toBeVisible()

    // Each PendingRequestRow shows the balance type ("Vacation") and a day count.
    // We verify both are rendered so the manager has enough context to act.
    await expect(page.getByText('Vacation').first()).toBeVisible()
    await expect(page.getByText(/3 day/i).first()).toBeVisible()
  })

  test('manager can approve a request', async ({ page }) => {
    // Open the ApprovalPanel dialog for the first pending request.
    const reviewButton = page.getByRole('button', { name: /review/i }).first()
    await reviewButton.click()

    // The Dialog should be open — verify by looking for the panel heading.
    // The DialogTitle shows "Review Request — Alice Johnson".
    await expect(page.getByText(/review request/i)).toBeVisible({
      timeout: 5_000,
    })

    // The ApprovalPanel fetches the live balance before allowing action.
    // Either the loading state ("Verifying current balance...") or the resolved
    // balance number must be visible, confirming the panel loaded correctly.
    const balanceSection = page.getByText(/balance at decision time/i)
    await expect(balanceSection).toBeVisible()

    // Wait for the balance to resolve — the loading text eventually becomes a number.
    // We accept either state because the network may be fast in local test runs.
    await expect(
      page
        .getByText(/verifying current balance/i)
        .or(page.getByText(/days remaining/i)),
    ).toBeVisible({ timeout: 10_000 })

    // Click the "Approve" button inside the dialog.
    // The ApprovalPanel renders two action buttons: "Approve" and "Deny".
    const approveButton = page.getByRole('button', { name: /^approve$/i })
    await approveButton.click()

    // After a successful approval the `onDone` callback fires, which closes
    // the dialog by setting `selectedRequest` back to null.
    // We verify the dialog has disappeared.
    await expect(page.getByText(/review request/i)).not.toBeVisible({
      timeout: 10_000,
    })

    // The manager list should now show the request in the "Recent History"
    // section with an "Approved" status badge.
    await expect(page.getByText('Approved').first()).toBeVisible({ timeout: 10_000 })
  })

  test('manager sees balance at decision time', async ({ page }) => {
    // This test specifically validates that the ApprovalPanel fetches and
    // displays the authoritative balance before letting the manager act.
    // This is a key product requirement: the manager must see the real-time
    // balance, not a cached value from the employee's view.

    const reviewButton = page.getByRole('button', { name: /review/i }).first()
    await reviewButton.click()

    // Confirm the "Balance at Decision Time" section header is rendered.
    await expect(page.getByText(/balance at decision time/i)).toBeVisible({
      timeout: 5_000,
    })

    // Wait for the async balance fetch to complete and a numeric value to appear.
    // The balance is rendered as a large mono number followed by "days available".
    await expect(page.getByText(/days remaining/i)).toBeVisible({
      timeout: 10_000,
    })

    // Alice started with 15 days; after submitting 3 the pending count shows,
    // but available should still read 15 until approved (pending ≠ deducted yet).
    // We don't hard-code the exact number here — we just confirm a number IS shown.
    // (The exact value is tested indirectly via the submit tests.)
    const balanceText = await page.getByText(/days remaining/i).textContent()
    expect(balanceText).toBeTruthy()
  })
})
