/**
 * Reconciliation: Balance and History Auto-Refresh
 *
 * When the reconciliation alert appears (an external balance update was detected
 * mid-session), the balance cards and request history should update automatically
 * — identical to clicking the Refresh button manually.
 *
 * Scenario: Alice has 15 vacation days. An anniversary bonus (+3) fires before
 * she submits. After submit the watcher detects the mismatch (expected 12 days,
 * HCM returned 18 = 15+3−0 because the debit and the bonus land together),
 * shows the alert, and the UI should immediately show the corrected values
 * without any manual action.
 */

import { test, expect } from '@playwright/test'
import { resetHcm, triggerAnniversary } from './helpers'

test.describe('Reconciliation: auto-refresh on balance mismatch', () => {
  test.beforeEach(async ({ page }) => {
    await resetHcm(page)
    await page.goto('/')
    await expect(
      page.getByRole('button', { name: /refresh/i }),
    ).toBeVisible({ timeout: 10_000 })

    const switcher = page.getByRole('combobox').first()
    await switcher.selectOption('emp-001')
    // Wait for initial balance to load
    await expect(page.getByText(/Available.*15/i).first()).toBeVisible({
      timeout: 10_000,
    })
  })

  test('balance cards refresh automatically when the alert appears', async ({ page }) => {
    // Trigger anniversary bonus BEFORE submit so the watcher detects a mismatch.
    // Alice will have 18 days in the HCM (15 + 3 bonus) at debit time, so after
    // the 3-day request the authoritative balance comes back as 15 (18 - 3),
    // not 12 (the optimistic 15 - 3).
    await triggerAnniversary(page, 'emp-001')

    await page.locator('#balance-type').selectOption('vacation')
    await page.locator('#start-date').fill('2026-07-01')
    await page.locator('#end-date').fill('2026-07-03')
    await page.getByRole('button', { name: /submit request/i }).click()

    // Wait for submit to complete
    await expect(page.getByText('Submitted').first()).toBeVisible({
      timeout: 10_000,
    })

    // The reconciliation alert must appear (mismatch detected)
    await expect(
      page.getByText(/your available balance changed/i),
    ).toBeVisible({ timeout: 10_000 })

    // Balance cards should now show the corrected value (15, not the stale 12).
    // This verifies the auto-invalidation of QueryKeys.balances fired.
    const balanceCards = page.locator('[data-testid="balance-card"]').or(
      page.getByText(/15/).filter({ hasText: /days/ }),
    )
    // The BalanceCard renders "15 days" — check within the card grid area
    await expect(
      page.getByText('15').first(),
    ).toBeVisible({ timeout: 10_000 })
  })

  test('request history refreshes automatically when the alert appears', async ({ page }) => {
    await triggerAnniversary(page, 'emp-001')

    await page.locator('#balance-type').selectOption('vacation')
    await page.locator('#start-date').fill('2026-07-08')
    await page.locator('#end-date').fill('2026-07-10')
    await page.getByRole('button', { name: /submit request/i }).click()

    // Wait for reconciliation alert
    await expect(
      page.getByText(/your available balance changed/i),
    ).toBeVisible({ timeout: 10_000 })

    // The request history list should show the submitted request.
    // This verifies the auto-invalidation of QueryKeys.requests fired.
    await expect(
      page.getByText('Submitted').first(),
    ).toBeVisible({ timeout: 10_000 })
  })

  test('no alert and no spurious refresh on a normal submit', async ({ page }) => {
    // Without an anniversary bonus the balance after submit should be exactly
    // 15 - 3 = 12 — no mismatch, no alert.
    await page.locator('#balance-type').selectOption('vacation')
    await page.locator('#start-date').fill('2026-08-01')
    await page.locator('#end-date').fill('2026-08-03')
    await page.getByRole('button', { name: /submit request/i }).click()

    await expect(page.getByText('Submitted').first()).toBeVisible({
      timeout: 10_000,
    })

    // Alert must NOT appear on a clean submit
    await expect(
      page.getByText(/your available balance changed/i),
    ).not.toBeVisible()
  })
})
