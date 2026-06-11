/**
 * Work Anniversary: Balance Refresh Mid-Session
 *
 * Tests the scenario where the HCM system grants additional leave days during
 * an active user session (e.g., a work-anniversary bonus). The UI must pick up
 * these external changes either via a manual Refresh or via the reconciliation
 * watcher.
 *
 * Also tests the ReconciliationBanner — the UI component that surfaces version
 * mismatches detected during a background balance refetch while an optimistic
 * write is still registered in the Zustand store.
 */

import { test, expect } from '@playwright/test'
import { resetHcm, configureHcm, triggerAnniversary, getBalance, submitRequestViaApi } from './helpers'

test.describe('Work Anniversary: Balance Refresh Mid-Session', () => {
  test('balance updates when anniversary bonus is triggered', async ({
    page,
  }) => {
    // --- Arrange ---
    await resetHcm(page)
    await page.goto('/')

    // Confirm Alice (emp-001) is the active employee (default on page load).
    const switcher = page.getByRole('combobox').first()
    await expect(switcher).toHaveValue('emp-001')

    // Wait for the initial balance to render. Alice starts with 15 vacation days
    // according to the fixture in mocks/hcm-engine.ts.
    await expect(page.getByText('15').first()).toBeVisible({ timeout: 10_000 })

    // --- Act: trigger anniversary bonus server-side ---
    // We call the _test endpoint directly to simulate the HCM system
    // asynchronously granting +3 days during Alice's session.
    // The UI is NOT yet aware of this change — it still shows 15.
    await triggerAnniversary(page, 'emp-001')

    // --- Act: user manually refreshes the balance list ---
    // The automatic refetch interval (configured via staleTime/refetchInterval)
    // would eventually pick this up, but tests can't wait that long.
    // Clicking "Refresh" triggers queryClient.invalidateQueries immediately,
    // which is exactly what a real user would do.
    const refreshButton = page.getByRole('button', { name: /refresh/i })
    await refreshButton.click()

    // --- Assert: balance now shows 18 (15 original + 3 anniversary bonus) ---
    // The click triggers an async invalidate → refetch → re-render cycle.
    await expect(page.getByText('18').first()).toBeVisible({ timeout: 10_000 })
  })

  test('reconciliation banner appears after balance version conflict mid-session', async ({
    page,
  }) => {
    // The ReconciliationBanner surfaces when the useReconciliation watcher
    // detects that a background balance refetch returned a `version` different
    // from the `baseVersion` stored in an active optimistic registry entry.
    //
    // This scenario recreates that race condition in a controlled way:
    //   1. Pre-seed a pending request via API so the manager view has data
    //   2. Navigate to the employee page; Alice's balance starts with a known version
    //   3. Trigger an anniversary bonus (externally bumps the HCM balance version)
    //   4. Submit a new request — onMutate registers the current version as baseVersion
    //   5. While the mutation is in-flight (or just after settle), the Refresh button
    //      forces an immediate balance re-read that picks up the NEW version
    //   6. The watcher detects version !== baseVersion and emits a warning toast
    //   7. The ReconciliationBanner becomes visible

    // --- Arrange ---
    await resetHcm(page)
    await page.goto('/')

    // Ensure Alice is selected and her balance is loaded.
    const switcher = page.getByRole('combobox').first()
    await switcher.selectOption('emp-001')
    await expect(page.getByText('15').first()).toBeVisible({ timeout: 10_000 })

    // Trigger the anniversary bonus before the submit so that the HCM engine
    // holds a newer balance version than what Alice's browser currently knows.
    // After this, the server has version V2 but the client cache still has V1.
    await triggerAnniversary(page, 'emp-001')

    // --- Act: submit a 3-day vacation request ---
    // onMutate will snapshot the current cached version (V1) as `baseVersion`
    // and register it in the optimistic registry.
    await page.locator('#balance-type').selectOption('vacation')
    await page.locator('#start-date').fill('2026-07-01')
    await page.locator('#end-date').fill('2026-07-03')

    const submitButton = page.getByRole('button', { name: /submit request/i })
    await submitButton.click()

    // Wait for the submit to complete before triggering the Refresh.
    await expect(page.getByText('Submitted').first()).toBeVisible({ timeout: 10_000 })

    // --- Act: immediately click Refresh while the mutation may still be settling ---
    // This forces the balance cache to refetch from the server. The server now
    // returns version V2 (after anniversary) while the optimistic registry still
    // holds baseVersion=V1. The watcher detects the mismatch and emits a warning.
    const refreshButton = page.getByRole('button', { name: /refresh/i })
    await refreshButton.click()

    // --- Assert: ReconciliationBanner appears ---
    // The banner renders whenever useToasts() contains a toast with
    // type="warning" and a requestId — exactly what the watcher emits.
    // It renders the heading "Your available balance changed" from ReconciliationBanner.tsx.
    await expect(
      page.getByText(/your available balance changed/i),
    ).toBeVisible({ timeout: 10_000 })

    // The banner body also contains the watcher's message string.
    await expect(
      page.getByText(/balance was updated while this form was open/i),
    ).toBeVisible({ timeout: 5_000 })
  })

  test('reconciliation banner can be dismissed', async ({ page }) => {
    // Once the user has acknowledged the reconciliation warning, they can
    // dismiss it. This keeps the UI clean after the user has taken action.

    // --- Arrange: reproduce the reconciliation banner state ---
    await resetHcm(page)
    await page.goto('/')

    const switcher = page.getByRole('combobox').first()
    await switcher.selectOption('emp-001')
    await expect(page.getByText('15').first()).toBeVisible({ timeout: 10_000 })

    // Trigger an external version bump before the submit.
    await triggerAnniversary(page, 'emp-001')

    await page.locator('#balance-type').selectOption('vacation')
    await page.locator('#start-date').fill('2026-07-01')
    await page.locator('#end-date').fill('2026-07-03')
    await page.getByRole('button', { name: /submit request/i }).click()
    await expect(page.getByText('Submitted').first()).toBeVisible({ timeout: 10_000 })

    // Force a balance refetch to trigger the watcher.
    await page.getByRole('button', { name: /refresh/i }).click()
    await expect(page.getByText(/your available balance changed/i)).toBeVisible({
      timeout: 10_000,
    })

    // --- Act: dismiss the banner ---
    const dismissButton = page.getByRole('button', { name: /dismiss/i })
    await dismissButton.click()

    // --- Assert: banner is gone ---
    await expect(page.getByText(/your available balance changed/i)).not.toBeVisible()
  })
})
