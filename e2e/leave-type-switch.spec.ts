/**
 * Leave Type Selector — Balance Updates on Switch
 *
 * Verifies that switching the leave type in the request form immediately
 * fetches and displays the correct available balance for the newly selected
 * type, preventing stale data from a prior selection.
 *
 * Fixture balances for Alice (emp-001 / loc-nyc):
 *   vacation  → 15 days
 *   sick      → 10 days
 *   personal  →  3 days
 */

import { test, expect } from '@playwright/test'
import { resetHcm } from './helpers'

test.describe('Leave Type Selector: balance updates on switch', () => {
  test.beforeEach(async ({ page }) => {
    await resetHcm(page)
    await page.goto('/')
    await expect(
      page.getByRole('button', { name: /refresh/i }),
    ).toBeVisible({ timeout: 10_000 })

    // Ensure Alice is selected
    const switcher = page.getByRole('combobox').first()
    await switcher.selectOption('emp-001')
  })

  test('shows vacation balance by default', async ({ page }) => {
    // Default leave type is Vacation — Alice has 15 days
    await expect(page.getByText(/Available.*15/i).first()).toBeVisible({
      timeout: 10_000,
    })
  })

  test('updates available days when switching to sick leave', async ({ page }) => {
    // Start on Vacation (15 days)
    await expect(page.getByText(/Available.*15/i).first()).toBeVisible({
      timeout: 10_000,
    })

    // Switch to Sick Leave
    const leaveTypeSelect = page.locator('#balance-type')
    await leaveTypeSelect.selectOption('sick')

    // Balance preview must update to Alice's sick balance (10 days),
    // not remain at 15 (vacation). This confirms the query key now
    // includes balanceType so TanStack Query fetches a fresh entry.
    await expect(page.getByText(/Available.*10/i).first()).toBeVisible({
      timeout: 5_000,
    })
  })

  test('updates available days when switching to personal leave', async ({ page }) => {
    const leaveTypeSelect = page.locator('#balance-type')

    // Switch straight to Personal — Alice has 3 days
    await leaveTypeSelect.selectOption('personal')

    await expect(page.getByText(/Available.*3/i).first()).toBeVisible({
      timeout: 5_000,
    })
  })

  test('restores vacation balance when switching back', async ({ page }) => {
    const leaveTypeSelect = page.locator('#balance-type')

    // Vacation (15) → Sick (10) → Vacation (15) — each switch re-reads
    // from the correct per-type cache entry.
    await expect(page.getByText(/Available.*15/i).first()).toBeVisible({
      timeout: 10_000,
    })

    await leaveTypeSelect.selectOption('sick')
    await expect(page.getByText(/Available.*10/i).first()).toBeVisible({
      timeout: 5_000,
    })

    await leaveTypeSelect.selectOption('vacation')
    await expect(page.getByText(/Available.*15/i).first()).toBeVisible({
      timeout: 5_000,
    })
  })

  test('insufficient balance check updates immediately on type switch', async ({ page }) => {
    // Alice has 3 personal days. Request 5 days — should show "insufficient".
    // Switch back to sick (10 days) with same 5-day range — warning should clear.
    const leaveTypeSelect = page.locator('#balance-type')

    // Pick a 5-day date range
    await page.locator('#start-date').fill('2026-09-01')
    await page.locator('#end-date').fill('2026-09-05')
    await expect(page.getByText(/5 business day/i)).toBeVisible()

    // Personal: 3 available < 5 requested → insufficient
    await leaveTypeSelect.selectOption('personal')
    await expect(page.getByText(/insufficient balance/i)).toBeVisible({
      timeout: 5_000,
    })
    await expect(
      page.getByRole('button', { name: /submit request/i }),
    ).toBeDisabled()

    // Sick: 10 available ≥ 5 requested → no warning, button enabled
    await leaveTypeSelect.selectOption('sick')
    await expect(page.getByText(/insufficient balance/i)).not.toBeVisible({
      timeout: 5_000,
    })
    await expect(
      page.getByRole('button', { name: /submit request/i }),
    ).not.toBeDisabled()
  })
})
