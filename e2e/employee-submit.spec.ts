/**
 * Employee: Time-Off Request Submission
 *
 * Covers the full lifecycle a regular employee experiences:
 *   1. Viewing their current leave balance
 *   2. Submitting a request and seeing the optimistic balance decrement immediately
 *   3. Confirmation that the server round-trip completes (status → Submitted)
 *   4. Validation that the form prevents submissions when the balance is too low
 */

import { test, expect } from '@playwright/test'
import { resetHcm } from './helpers'

test.describe('Employee: Time-Off Request Submission', () => {
  test.beforeEach(async ({ page }) => {
    // Always start from a clean HCM state so tests are independent and
    // deterministic regardless of run order.
    await resetHcm(page)
    await page.goto('/')

    // Wait for the page to finish its initial data load before each test.
    // The BalanceList renders a "Refresh" button once data is present.
    await expect(
      page.getByRole('button', { name: /refresh/i }),
    ).toBeVisible({ timeout: 10_000 })
  })

  test('shows balance for Alice', async ({ page }) => {
    // Alice (emp-001) is the default employee shown on page load.
    // Her initial vacation balance in the fixture data is 15 days.

    // The employee switcher is a <select> — confirm Alice is selected.
    const switcher = page.getByRole('combobox').first()
    await expect(switcher).toHaveValue('emp-001')

    // The RequestForm shows "Available: N days" below the leave type selector.
    // This is the most reliable indicator of the loaded balance.
    await expect(page.getByText(/Available.*15/i).first()).toBeVisible({ timeout: 10_000 })
  })

  test('submits request with optimistic update', async ({ page }) => {
    // --- Arrange: make sure Alice is selected ---
    const switcher = page.getByRole('combobox').first()
    await switcher.selectOption('emp-001')

    // Wait for Alice's vacation balance to appear in the form preview.
    await expect(page.getByText(/Available.*15/i).first()).toBeVisible({ timeout: 10_000 })

    // --- Act: fill in the RequestForm ---

    // The Leave Type <select> has id="balance-type"
    const leaveTypeSelect = page.locator('#balance-type')
    await leaveTypeSelect.selectOption('vacation')

    // Set the date range: 2026-07-01 → 2026-07-03 = 3 days
    await page.locator('#start-date').fill('2026-07-01')
    await page.locator('#end-date').fill('2026-07-03')

    // The form shows a day-count preview once both dates are set.
    await expect(page.getByText(/3 business day/i)).toBeVisible()

    // --- Act: submit ---
    const submitButton = page.getByRole('button', { name: /submit request/i })
    await submitButton.click()

    // --- Assert: optimistic balance decrement is immediate ---
    // onMutate sets the cached balance to 12 (15 - 3) before the server responds.
    // The RequestForm reads from the same cache, so "Available: 12" appears instantly.
    await expect(page.getByText(/Available.*12/i).first()).toBeVisible({ timeout: 3_000 })

    // --- Assert: server round-trip completes and status advances to Submitted ---
    // TanStack Query invalidates and refetches once the mutation succeeds.
    await expect(page.getByText('Submitted').first()).toBeVisible({ timeout: 10_000 })

    // --- Assert: balance in the card also reflects the change ---
    // After the authoritative re-read in onSettled, the balance card should show 12.
    await expect(page.getByText(/Available.*12/i).first()).toBeVisible({ timeout: 10_000 })
  })

  test('shows insufficient balance feedback for Carol', async ({ page }) => {
    // Carol (emp-003) has only 5 vacation days.
    // Requesting 8 days should disable the submit button and show a warning.

    const switcher = page.getByRole('combobox').first()
    await switcher.selectOption('emp-003')

    // Wait for Carol's vacation balance to load in the form preview.
    await expect(page.getByText(/Available.*5/i).first()).toBeVisible({ timeout: 10_000 })

    const leaveTypeSelect = page.locator('#balance-type')
    await leaveTypeSelect.selectOption('vacation')

    // 2026-08-01 → 2026-08-08 = 8 days, which exceeds Carol's 5-day balance.
    await page.locator('#start-date').fill('2026-08-01')
    await page.locator('#end-date').fill('2026-08-08')

    // The form shows an inline "insufficient balance" label next to the day count.
    await expect(page.getByText(/insufficient balance/i)).toBeVisible({
      timeout: 5_000,
    })

    // The submit button must be disabled — it would cause a guaranteed 422 from
    // the HCM engine, and the UI should prevent that entirely.
    const submitButton = page.getByRole('button', { name: /submit request/i })
    await expect(submitButton).toBeDisabled()
  })
})
