# Technical Requirements Document: ExampleHR Time-Off Frontend

**Version:** 1.2  
**Date:** 2026-06-11  
**Audience:** Senior engineers who need to understand and challenge the design decisions

> **Changelog (1.2):** Component code reorganized (no behavior change). Components now follow a three-tier rule — `components/ui/` (shadcn primitives, flat), `components/app/` (app shell, flat), `features/time-off/components/` (domain, **folder-per-component**). Each domain component is a self-contained folder (`Component.tsx` + `.test.tsx` + `.stories.tsx` + `index.ts` barrel). `app/_components/` removed: `AppNav` → `components/app/`, `EmployeeView` → the feature. See §8 "Code organization."

> **Changelog (1.1):** Per-cell balance cache key now includes `balanceType` as a fourth segment (`['balance', employeeId, locationId, balanceType]`), isolating each leave type's cache. `useReconciliation` split into a detection effect and a React-lifecycle refresh effect. Manager approval now only clears `pendingDays` (no double-decrement); deny restores `availableDays`. Submit and approve/deny now refresh the batch-balance and request-list caches so cards and lists update without a manual refresh. Requests carry an `employeeName` enriched at read time. `ReconciliationBanner` relocated into `RequestForm`.

---

## Table of Contents

1. [Problem Statement](#1-problem-statement)
2. [Domain Model](#2-domain-model)
3. [Challenges Addressed](#3-challenges-addressed)
4. [Data Fetching Architecture](#4-data-fetching-architecture)
5. [Optimistic vs. Pessimistic — The Core Decision](#5-optimistic-vs-pessimistic--the-core-decision)
6. [Cache Invalidation Strategy](#6-cache-invalidation-strategy)
7. [Reconciling Background Refresh with In-Flight User Actions](#7-reconciling-background-refresh-with-in-flight-user-actions)
8. [Component Tree and Responsibility Mapping](#8-component-tree-and-responsibility-mapping)
9. [Testing Strategy](#9-testing-strategy)
10. [Mock HCM Design](#10-mock-hcm-design)
11. [Alternatives Considered](#11-alternatives-considered)
12. [Running the System](#12-running-the-system)

---

## 1. Problem Statement

### ExampleHR is not the source of truth

ExampleHR is a frontend orchestration layer. The authoritative source of truth for leave balances is the HCM system (Workday/SAP). This is not a detail — it is the central architectural constraint from which every other decision flows.

The HCM can mutate balances **out of band** at any time:
- Anniversary bonuses credit extra vacation days mid-session
- Year-start resets zero and re-accrue all leave types
- Corrections and HR adjustments can change any balance without any event surfacing to the frontend

This means ExampleHR can never treat its own cache as authoritative. Every balance displayed to a user is potentially stale.

### The core tension

Users need **instant feedback**. Employees expect "Submit" to feel like pressing a button, not waiting for a remote system. The HCM is not fast, may be 30–60s stale at the batch endpoint level, and can return a 200 OK without actually persisting the operation (silent failure).

At the same time, **accuracy matters**. An incorrect approval is a contractual error. A displayed balance that is wrong misleads employees into requesting days they do not have.

The tension: optimize for responsiveness where the cost of being wrong is recoverable; optimize for accuracy where the cost of being wrong is a financial or contractual error.

### Two personas, divergent requirements

| Persona | Primary need | Acceptable latency | Cost of inaccuracy |
|---|---|---|---|
| **Employee** | Fast, trustworthy feedback on submit | Sub-100ms visual response | Low — failures are visible and recoverable |
| **Manager** | Accurate balance at decision time, not minutes ago | Seconds (a re-read is acceptable) | High — an incorrect "approved" is a contractual commitment |

These divergent needs are why the system uses two different mutation strategies. The asymmetry is intentional; collapsing it to a single strategy would mean either a laggy employee submit or an insufficiently guarded manager approval.

---

## 2. Domain Model

### Balance

```typescript
interface Balance {
  employeeId: string
  locationId: string
  balanceType: BalanceType        // 'vacation' | 'sick' | 'personal'
  availableDays: number
  pendingDays: number
  version: string                 // HCM etag — used as concurrency token
  asOf: string                    // ISO timestamp of last HCM read
}
```

A balance is identified by the **tuple `(employeeId, locationId, balanceType)`**. This is the granularity at which all reads, writes, and invalidations operate, and it maps directly onto the per-cell query key `['balance', employeeId, locationId, balanceType]` (see §6). The `version` field is the HCM's etag — a monotonically-bumped opaque string (e.g. `v1748736000000`) that changes on every HCM-side write to that cell. It is the concurrency token for all version-gated operations.

`asOf` is the timestamp of the last read from HCM and is surfaced in the UI as a staleness signal.

### TimeOffRequest

```typescript
interface TimeOffRequest {
  id: string
  employeeId: string
  locationId: string
  balanceType: BalanceType
  days: number
  startDate: string               // ISO date
  endDate: string                 // ISO date
  notes?: string
  status: RequestStatus
  createdAt: string
  updatedAt: string
  baseVersion: string             // HCM balance version at time of submit
  employeeName?: string           // enriched at read time, not stored
  hcmRejectionReason?: string
  reconciledAt?: string
}
```

`baseVersion` records the HCM balance version that was current when the request was submitted. This is the concurrency anchor for version-conflict detection during manager approval.

`employeeName` is **optional and derived, not persisted**. The engine stores only `employeeId`; `getRequests` enriches each record by resolving the employee at read time (`getEmployee(r.employeeId)?.name`). This keeps the manager view free of hardcoded ID→name maps — the display name always comes from the same source of truth as the rest of the data — while avoiding a denormalized name that could drift from the employee record.

### Request lifecycle

```
draft
  └─► optimistic-pending    (onMutate: optimistic delta applied, request added to UI)
        ├─► submitted        (onSettled: HCM confirmed persistence)
        │     ├─► approved   (pendingDays cleared; availableDays already debited at submit)
        │     ├─► denied     (availableDays restored, pendingDays cleared)
        │     └─► needs-attention  (reconciliation detected contradiction)
        └─► rolled-back      (onError or success=false: cache snapshot restored)
```

**`needs-attention`** is the key state for silent HCM failures that pass initial validation but whose effect is later contradicted by an authoritative re-read. It is always recoverable and always visible — never a silent flip.

### Version string

The version string is the sole concurrency control mechanism between ExampleHR and the HCM. Rules:

- Always read the version from HCM immediately before any write that requires a version gate
- Never trust a cached version for a decision that has financial or approval weight
- A version mismatch at approval time is a hard stop, not a warning

---

## 3. Challenges Addressed

### 1. Stale balances under an open session

**Problem:** A user opens the app, leaves it idle for 2 hours. Their balance changes (anniversary bonus, year-start reset, HR correction). They return and the displayed balance is wrong.

**Solution:**
- `useBalances` refetches every 60 seconds (`refetchInterval: 60_000`)
- `refetchOnWindowFocus: true` on `useBalance` fires a re-read when the tab regains focus
- `useReconciliation` subscribes to the TanStack Query cache (filtering to genuine fetch completions) and detects when the server's returned available days differ from the expected post-delta value for any registered optimistic entry — if so, it fires a warning toast
- `ReconciliationBanner` surfaces those warnings as a dismissible amber banner — never a silent state change

### 2. Two HCM read APIs

**Problem:** HCM exposes a batch corpus endpoint and a per-cell real-time endpoint. They have different cost profiles, latencies, and staleness characteristics.

**Solution:** Each is used for what it is good at:
- Batch (`GET /api/hcm/balances?employeeId=...`) — initial hydration and periodic background reconciliation only
- Per-cell (`GET /api/hcm/balance?employeeId=...&locationId=...`) — authoritative reads at decision time (submit-settle and manager approval)

Using the per-cell endpoint for display would cause thrashing. Using the batch endpoint for approval decisions would risk stale version data.

### 3. Silent HCM success responses

**Problem:** The HCM can return `{ success: true }` without actually persisting the debit. The client has no way to distinguish this from a real success at the mutation response level.

**Solution:** The system never trusts a `success: true` response as final truth. The invariant is: **a request status never advances to "approved" without an authoritative re-read confirming the balance change was applied**. Concretely:

- `onSettled` in `useSubmitRequest` always fires `invalidateQueries` on the per-cell balance key, triggering an authoritative re-read regardless of the mutation result
- `useReconciliation` watches that re-read: if the returned available days don't match `snapshotAvailableDays + deltaApplied` (the HCM did not apply the expected debit), a contradiction is detected and surfaced as `needs-attention`

### 4. Late-arriving contradictions

**Problem:** Even after `onSettled` fires a re-read, a subsequent background corpus refresh (60s interval) could return a balance whose version contradicts a still-active optimistic entry.

**Solution:**
- `useReconciliation` subscribes to all successful fetch completions on `['balance', ...]` cache entries, not just the post-settle re-read
- Any such fetch that returns available days differing from the expected post-delta value while a matching entry exists in the `optimisticRegistry` fires a warning
- `ReconciliationBanner` renders the warning with a dismiss action — the user is always informed, never left in a silently incorrect state

### 5. Version conflicts on manager approval

**Problem:** Manager loads the approval page. The employee's balance changes before the manager clicks "Approve". The manager approves on stale data.

**Solution:** `useApproveRequest` is fully pessimistic:
1. Before calling the approve API, it fetches the authoritative current balance via `fetchBalance` (bypasses cache)
2. Passes the freshly-read `version` to `approveRequest` as `expectedVersion`
3. The HCM engine validates `balance.version === expectedVersion` before applying the write
4. A 409-equivalent `VERSION_CONFLICT` error is surfaced to the manager with a "please refresh" message — the approval does not proceed

---

## 4. Data Fetching Architecture

### Two read modes

| Mode | Endpoint | Hook | staleTime | Interval | Used for |
|---|---|---|---|---|---|
| **Batch corpus** | `GET /api/hcm/balances?employeeId=` | `useBalances` | 30s (global default) | 60s | Initial hydration, BalanceList display, background reconciliation |
| **Per-cell authoritative** | `GET /api/hcm/balance?employeeId=&locationId=&balanceType=` | `useBalance` | 10s | None (window focus only) | RequestForm preview, submit-settle re-read, manager approval gate |

The per-cell query is keyed by all three dimensions — `['balance', employeeId, locationId, balanceType]`. The `balanceType` segment was added in 1.1: without it, switching the RequestForm's leave-type selector reused the previously-fetched cell (e.g. showing vacation days under "Sick Leave"). Each leave type now has its own isolated cache entry.

### Global QueryClient defaults

```typescript
// lib/query-client.ts
new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,       // 30s — corpus batch queries inherit this
      gcTime: 5 * 60_000,      // 5min garbage collection
      retry: 2,
      refetchOnWindowFocus: true,
    },
  },
})
```

Per-cell queries override `staleTime` to 10s — tighter, because they are used for preview inputs where a 30s stale balance could mislead the user about real-time availability.

### Why two modes?

The batch endpoint is cheap per call for a full corpus fetch but expensive if called per-cell across many balance types and employees. It can be 30–60s stale at HCM's batch-generation cadence. The per-cell endpoint is cheap per individual cell, authoritative, and low-latency — but calling it for every card in a list would generate O(n) requests on every render cycle.

The split is deliberate: batch for display, per-cell for decisions. Conflating them would mean either an expensive per-card fetch on every 60s tick, or a stale version token being passed to an approval.

### Batch corpus: simulated latency

The mock HCM engine adds an 800ms simulated latency on the batch endpoint to reflect realistic HCM behavior. `isFetching` is used (not `isLoading`) to show a non-blocking refresh indicator on subsequent fetches, so the UI does not blank out during background refreshes.

---

## 5. Optimistic vs. Pessimistic — The Core Decision

This is the most consequential architectural decision in the system. The full reasoning follows.

### Employee submit: Optimistic

**What happens:**

1. **`onMutate`** fires synchronously before the network request:
   - `cancelQueries` kills any in-flight background refetches for `['balance', employeeId, locationId, balanceType]` and `['balances', employeeId]` — preventing a landing refetch from clobbering the optimistic state
   - Snapshots current cache for rollback: `previousBalance` and `previousBalances`
   - Applies the optimistic delta to the per-cell balance: `availableDays -= days`, `pendingDays += days`
   - Registers an `OptimisticEntry` in the Zustand `optimisticRegistry` with the key `${employeeId}:${locationId}:${balanceType}`, recording `deltaApplied`, `baseVersion`, and `timestamp`
   - Fires an info toast

2. **`onError`** (network failure, thrown exception):
   - Restores both cache snapshots
   - Unregisters from `optimisticRegistry`
   - Shows a code-specific error toast

3. **`onSuccess`** with `result.success === false` (HCM-level rejection: `INSUFFICIENT_BALANCE`, `VERSION_CONFLICT`, etc.):
   - Same rollback logic as `onError` — HCM-level failures are treated identically to transport failures for cache purposes
   - Shows a code-specific error toast

4. **`onSettled`** (always fires, regardless of outcome):
   - Fires `invalidateQueries` on `QueryKeys.balance(employeeId, locationId, balanceType)` — triggers the authoritative per-cell re-read
   - Does **not** unregister from `optimisticRegistry` here; the reconciliation watcher owns that cleanup once the re-read lands (see §7)
   - On success, also invalidates `QueryKeys.balances(employeeId)` (the batch corpus) so the `BalanceList` cards reflect the new available/pending counts immediately rather than waiting for the next 60s tick, and — after a 500ms delay — `QueryKeys.requests(employeeId)`. The delay gives HCM time to propagate the new request before the list query fires

**Why optimistic is justified here:**

- The happy path exceeds 95% of submissions (valid balance, correct dimension, no concurrent conflict)
- "Submit" is the most frequent user action in the system — latency here has disproportionate UX cost
- The optimistic delta is bounded: `availableDays -= days`. It cannot overcount (only the user-provided `days` value is applied) and it cannot go negative without the HCM having already caught it pre-mutation
- **Failures are recoverable and visible.** Rollback is explicit: the cache snapshot is restored, the toast is specific, and the request is never shown as "approved" without authoritative confirmation
- The invariant is maintained: a request status advances to `submitted` only after `onSettled` fires the authoritative re-read, and to `approved` only after the manager's pessimistic gate passes

### Manager approval: Pessimistic

**What happens:**

1. **`mutationFn`** executes before any cache update:
   - `fetchBalance(employeeId, locationId, balanceType)` — a direct per-cell HCM read, bypassing cache entirely (`useQueryClient` is not involved here)
   - Extracts `currentVersion` from the response
   - Calls `approveRequest(requestId, employeeId, locationId, currentVersion)` with the freshly-read version

2. **`onSuccess`** with `result.success === false`:
   - Maps `errorCode` to user-facing message (`VERSION_CONFLICT` → "Balance changed since you loaded this page. Please refresh.", `INSUFFICIENT_BALANCE` → "Insufficient balance — the employee no longer has enough days.")

3. **`onSuccess`** with `result.success === true`:
   - Invalidates `QueryKeys.balance(employeeId, locationId, balanceType)`, `QueryKeys.requests(employeeId)`, **and `QueryKeys.allRequests()`** — the last refreshes the manager's cross-employee pending list and history so the actioned request leaves the pending group immediately. Deny (`useDenyRequest` in `ApprovalPanel`) invalidates the same three keys
   - Shows success toast

Note: `mutationFn` is `async` — the re-read and the write are sequential within the mutation function itself, not split across `onMutate`/`onSuccess`. This means the version token never sits in cache between reads; it is always read immediately before use.

**Engine-side accounting (corrected in 1.1):** `availableDays` is debited **once**, at submit time, with the debited amount held in `pendingDays`. Approval therefore only clears the `pendingDays` reservation — it must not debit `availableDays` again. Its sufficiency check is `pendingDays >= request.days` (the reserved slot), not `availableDays >= request.days`; the latter caused false `INSUFFICIENT_BALANCE` rejections when multiple requests were pending simultaneously. Deny reverses the submit: it restores `availableDays` and clears `pendingDays`. The manager's `ApprovalPanel` displays a single merged figure — `availableDays + pendingDays` labelled "days remaining" — with a sub-line breaking out how many days are held for pending requests, so the manager sees the employee's true remaining balance rather than two numbers that look contradictory.

**Why pessimistic is justified here:**

- "Approved" is a contractual commitment. If a balance changed between the manager's page load and their click, the approval would be based on stale data
- The re-read cost is a single per-cell GET — negligible in absolute terms, and negligible relative to the cost of an incorrect approval
- The manager is not interacting at the same frequency as an employee submit; the latency of one extra network round-trip is not a UX problem
- The HCM engine enforces `balance.version === expectedVersion` server-side — but the client re-read ensures that even if the HCM's check were not implemented, the client would pass the correct version

**Why not always pessimistic?**

Employee submit would require waiting for a round-trip GET before even showing "Submitting..." — the user's form would freeze for 200–800ms on every submit. For a high-frequency action where the failure modes are fully recoverable and visibly surfaced, this latency cost is not justified by the marginal safety gain.

### Summary table

| | Employee Submit | Manager Approval |
|---|---|---|
| **Strategy** | Optimistic | Pessimistic |
| **Cache update timing** | Immediate (onMutate) | After confirmed success |
| **Rollback** | Cache snapshot restore | N/A (no pre-write cache change) |
| **Version token source** | Cached at submit time (`baseVersion`) | Freshly read in mutationFn |
| **"Approved" gating** | Never set without authoritative re-read | Never set without version match |
| **Failure surfacing** | Toast + needs-attention status | Toast with specific error code |

---

## 6. Cache Invalidation Strategy

### Targeted invalidation after mutation

Every submit — success or failure — invalidates `QueryKeys.balance(employeeId, locationId, balanceType)`, the per-cell key. This is the authoritative re-read that the reconciliation watcher checks against (§7), and the per-cell endpoint is fast, so it runs unconditionally.

The batch corpus (`QueryKeys.balances(employeeId)`, which drives the `BalanceList` cards) is invalidated **only on success**. This is a deliberate cost/benefit split:

- **On failure**, the optimistic delta has already been rolled back from the cache, so the cards are correct without a refetch — paying the 800ms batch latency would be wasted work.
- **On success**, the cards must reflect the new available/pending counts right away. Before 1.1 they only updated on the next 60s tick or a manual Refresh, which read as "the balance didn't change." Invalidating the corpus on success closes that gap; the 800ms cost is acceptable because it happens once, on the confirmed happy path, in the background (`isFetching` keeps the old values visible until it lands).

The request list (`QueryKeys.requests(employeeId)`) is invalidated on success after a 500ms delay (HCM propagation). Manager approve/deny additionally invalidate `QueryKeys.allRequests()` so the cross-employee manager view refreshes.

### Background corpus refresh (60s)

`useBalances` runs `refetchInterval: 60_000`. This is the catch-all for all out-of-band HCM mutations: anniversary bonuses, year-start resets, HR corrections, and any other change that the frontend has no notification channel for. It fires unconditionally, not as a response to user action.

The 60s interval is a deliberate tradeoff: short enough to catch balance changes within a reasonable session window; long enough not to hammer the HCM batch endpoint.

### `refetchOnWindowFocus: true`

Set globally via `QueryClient` defaults and reinforced on `useBalance`. When a user returns to the tab after a period away, queries that are past their `staleTime` refetch immediately. This catches the anniversary-bonus-during-idle scenario without waiting for the next 60s tick.

### `cancelQueries` in `onMutate`

When an employee submits a request, `cancelQueries` fires for both the per-cell and batch keys before the optimistic update is applied. This prevents a refetch that was already in flight from landing after the optimistic delta and overwriting it with the pre-mutation balance.

The cancelled query is rescheduled from zero after `onSettled` fires. The refetch interval is not permanently disrupted — it just restarts cleanly after the mutation is fully settled.

### Optimistic registry in Zustand

The `optimisticRegistry` in `uiStore` serves a specific purpose: it is the bridge between the mutation lifecycle (TanStack Query) and the reconciliation loop (query cache subscriber). Without it, the reconciliation hook would have no way to know that an incoming balance update from a background refetch is contradicting an in-flight write.

```typescript
// Key structure: `${employeeId}:${locationId}:${balanceType}`
interface OptimisticEntry {
  requestId: string
  employeeId: string
  locationId: string
  balanceType: string
  deltaApplied: number            // negative: -days submitted
  baseVersion: string             // version locked at submit time
  snapshotAvailableDays: number   // availableDays from cache at onMutate time; -1 if cache was cold
  timestamp: number
}
```

The registry entry is registered in `onMutate`. It is unregistered by the reconciliation watcher once the `onSettled` authoritative re-read lands (both on mismatch and on clean match). For early exits — `onError` and `onSuccess` with `result.success === false` — it is unregistered immediately in those handlers since no authoritative re-read will be checked against it.

---

## 7. Reconciling Background Refresh with In-Flight User Actions

### The failure scenario

1. User submits a request → `onMutate` fires, optimistic delta applied
2. A background 60s refetch was already mid-flight (started 0.5s before the submit)
3. `cancelQueries` in `onMutate` attempts to cancel it, but the request may have already resolved at the network level
4. The refetch lands with the pre-mutation balance — HCM hasn't processed the submit yet
5. The optimistic delta is overwritten

**Prevention (primary):** `cancelQueries` in `onMutate` aborts the TanStack Query-level observation of any in-flight queries for the affected keys. Even if the network response arrives, TanStack Query will not apply it to the cache if the query was cancelled before the response landed.

### The residual risk: silent HCM failure

**Scenario:** HCM returns `{ success: true, requestId: "req-101" }` but does not decrement the balance. The `onSettled` authoritative re-read fires and returns the original balance (no version change, no debit). The optimistic decrement was incorrect.

**Detection (effect 1):** `useReconciliation` subscribes to TanStack Query cache updates via `queryCache.subscribe`. It filters to genuine fetch completions (`event.action.type === 'success'`) to avoid reacting to `setQueryData` calls (optimistic writes) or `invalidate` actions, which also fire `updated` events but carry no server-authoritative data. On every such event for a `['balance', employeeId, locationId, balanceType]` key:

```typescript
// useReconciliation, effect 1 — detection only
queryCache.subscribe((event: QueryCacheNotifyEvent) => {
  if (event.type !== 'updated') return
  if (event.action.type !== 'success') return  // only genuine fetch completions
  // Only react to per-cell balance keys (now 4 segments: + balanceType)
  if (queryKey[0] !== 'balance' || queryKey.length !== 4) return

  const qEmployeeId = queryKey[1], locationId = queryKey[2], balanceType = queryKey[3]

  // Check registry for matching in-flight optimistic entries
  for (const [key, entry] of Object.entries(registry)) {
    if (entry.employeeId !== qEmployeeId ||
        entry.locationId !== locationId ||
        entry.balanceType !== balanceType) continue
    // Mismatch: server's available days differ from what we expected after our delta.
    // snapshotAvailableDays=-1 means cache was cold at submit time; skip in that case.
    const expectedAvailable = entry.snapshotAvailableDays + entry.deltaApplied
    const balanceMismatch = entry.snapshotAvailableDays >= 0 &&
      freshBalance.availableDays !== expectedAvailable
    if (balanceMismatch) {
      addToast({ type: 'warning', requestId: entry.requestId, message: '...' })
    }
    // Always unregister — the authoritative re-read has landed.
    unregisterOptimistic(key)
  }
})
```

Note the `entry.balanceType !== balanceType` filter: now that the key is per-type, a vacation re-read must not reconcile against a pending sick-leave entry.

**Why `balanceMismatch` instead of `versionChanged`:** A normal successful submit also bumps the HCM version (the engine writes a new `v${Date.now()}` on every debit). Checking only `versionChanged` would fire a false-positive warning on every successful submit. Checking the actual available-day count — `freshBalance.availableDays !== snapshotAvailableDays + deltaApplied` — fires only when the server returned a balance that does not reflect the expected deduction, which is exactly the silent-failure and anniversary-bonus scenarios.

**Refresh (effect 2):** Detection alone updates the per-cell cache, but the `BalanceList` cards (batch corpus) and the request history would still show stale numbers until the next 60s tick. The instinct is to call `invalidateQueries` from inside the `queryCache.subscribe` callback — but that callback runs **inside TanStack Query's own notification cycle**, where `invalidateQueries` is unreliable (it was observed to no-op, and wrapping it in `setTimeout(0)` did not fix it). The robust fix is a **second `useEffect` that watches Zustand's reactive toast state** rather than the query cache:

```typescript
// useReconciliation, effect 2 — refresh from React's normal lifecycle
useEffect(() => {
  const count = toasts.filter((t) => t.type === 'warning' && t.requestId).length
  if (count > prevReconciliationCountRef.current) {
    void queryClient.invalidateQueries({ queryKey: QueryKeys.balances(employeeId) })
    void queryClient.invalidateQueries({ queryKey: QueryKeys.requests(employeeId) })
  }
  prevReconciliationCountRef.current = count
}, [toasts, employeeId, queryClient])
```

Effect 1 emits a warning toast into Zustand; that state change re-renders the hook; effect 2 sees the reconciliation-toast count rise and fires the invalidations from React's ordinary render lifecycle — outside the query notification cycle — where they reliably take effect. The split is the key insight: **detection happens inside the cache subscriber, but the cache mutation it triggers must happen outside it.**

**Surfacing:** `ReconciliationBanner` renders any `warning` toast with a `requestId` as an amber dismissible banner. In 1.1 it lives **inside `RequestForm`**, directly above the submit button (rather than at the top of the page), with plain-language copy — the warning appears at the exact point where the user is about to act on the number that changed. It is the only way reconciliation warnings are surfaced — they are never silent, and they never flip request status without user acknowledgment.

The request transitions to `needs-attention` — it is recoverable (the user can re-submit) and visible. It is never silently left as `submitted` when the HCM did not apply the debit.

### Why the query cache subscriber approach?

The alternative is to check for reconciliation inside `onSettled`. The problem: `onSettled` fires once, immediately after the mutation. The reconciliation concern is ongoing — a background refresh arriving 55 seconds later could also contradict a previously-settled request. The cache subscriber approach watches for contradictions across the entire session lifetime, not just at the point of the mutation.

---

## 8. Component Tree and Responsibility Mapping

```
app/layout.tsx (server)
  └── Providers (client) — QueryClientProvider, Toaster, MSW init
      ├── AppNav (client) — route links, persona switcher
      └── [page content]

Employee View (/)
  └── EmployeeView (client)
      ├── useReconciliation(activeId)  — subscribes to cache; fires warning toasts on
      │                                  contradictions, then refreshes corpus + history
      ├── BalanceList               — uses useBalances (corpus, 60s interval)
      │   │                           Refresh button invalidates balances + balancePrefix
      │   │                           + requests; "Last synced at" shown in amber
      │   └── BalanceCard[]         — per-balance display; amber ring while isFetching
      ├── RequestForm               — uses useBalance (per-cell, staleTime:10s, keyed by
      │   │                           balanceType) for preview; available days update when
      │   │                           the leave-type selector changes
      │   │                           uses useSubmitRequest for submission
      │   └── ReconciliationBanner  — renders warning toasts with requestId; dismissible;
      │                               sits directly above the submit button
      └── RequestList               — uses useRequests; shows all statuses including needs-attention

Manager View (/manager)
  └── (client page)
      ├── useAllRequests            — all pending requests across all employees
      ├── Refresh button            — invalidates allRequests (pending + history)
      ├── RequestTable (pending)    — semantic <table>, grouped by location; shows
      │   │                           request.employeeName (resolved by the engine);
      │   │                           a Review action column opens the dialog
      │   └── ApprovalPanel (Dialog)— title + body show employeeName, not employeeId
      │       └── useApproveRequest — pessimistic: re-reads balance, version-gates write
      └── RequestTable (history)    — same component without the Action column (onReview omitted)
```

### Why this structure?

**Server components handle routing only.** `app/layout.tsx` is a server component — it has no client state, no query hooks, and no interactivity. All interactive boundaries start at the `Providers` wrapper or below.

**`Providers` is the sole global infrastructure initializer.** `QueryClientProvider`, the toast renderer, and MSW worker initialization all live here. This is intentional: no feature component should ever be responsible for global infrastructure setup, and the MSW worker must be initialized client-side before any route-level data fetching begins.

**Feature components are self-contained with their own hooks.** `BalanceList` knows how to fetch its own data; `RequestForm` knows how to submit; `ApprovalPanel` knows how to approve. There is no prop-drilling of query results. This makes each component independently testable and replaceable.

**`useReconciliation` is mounted at the `EmployeeView` level**, not inside `RequestForm` or `BalanceCard`. This is because reconciliation events can arrive from any background refresh, regardless of which sub-component is currently rendered. Mounting it at the feature root ensures it is active for the entire session on the employee view. The hook is invoked with `activeId` (the currently-selected employee), so it must be called after that id is resolved. Note the separation of concerns: the *detection hook* lives at the feature root for full-session coverage, but the *banner it feeds* lives inside `RequestForm` — warnings are emitted globally yet surfaced at the point of action.

### Code organization (file layout)

The logical tree above maps onto a physical layout governed by **one rule: primitives and app-shell are flat; domain components get a folder.** Three tiers:

| Tier | Location | What lives here | Layout |
|---|---|---|---|
| **Primitives** | `components/ui/` | shadcn/ui primitives (Button, Dialog…) — no domain knowledge, reusable anywhere | flat (shadcn install target — `components.json` pins `ui → @/components/ui`) |
| **App shell** | `components/app/` | layout chrome not tied to a feature (`AppNav`) | flat |
| **Domain** | `features/time-off/components/` | components that know the feature's data — the ones that carry tests + stories | **folder-per-component** |

**Folder-per-component.** Each domain component is a self-contained directory holding its trio plus a barrel:

```
features/time-off/components/BalanceCard/
  BalanceCard.tsx
  BalanceCard.test.tsx        # where a test exists
  BalanceCard.stories.tsx
  index.ts                    # export { BalanceCard } from './BalanceCard'
```

The one-line `index.ts` barrel is deliberate: external imports stay `@/features/time-off/components/BalanceCard` (unchanged — they resolve to the folder's `index.ts`), while the real component file keeps a meaningful name in editor tabs, fuzzy-find, and stack traces (versus a sea of identical `index.tsx`). It is a single leaf-level re-export, so it carries none of the circular-import or tree-shaking hazards of deep barrel trees. Cross-component sibling imports inside the feature use `../Sibling` (resolving via that sibling's barrel); shared story fixtures live at the components-dir root (`_stories-helpers.ts`).

**Why feature-first, not type-first.** Everything the time-off domain needs — `components/`, `hooks/`, `store/`, `api/`, `types/` — is colocated under `features/time-off/`. A type-first layout (global `/components`, `/hooks`, `/store` grouped by kind) scatters one feature across the tree and does not scale past a couple of features. `EmployeeView` lives in the feature (not `app/`) precisely because it composes feature components and `useReconciliation` — it is a domain view, not app shell. `app/` is therefore routing-only.

---

## 9. Testing Strategy

| Layer | Tool | What it guards |
|---|---|---|
| Unit | Vitest | HCM engine state transitions, Zustand store actions, `QueryKeys` shape correctness |
| Hook | Vitest + RTL + MSW | Optimistic mutation + rollback contract, authoritative re-read on settle, pessimistic approval version gate |
| Component | Vitest + RTL | Render correctness for all UI states: loading, empty, stale, needs-attention, rolled-back |
| Storybook interaction | Storybook `play()` | Visual state matrix; proves every meaningful status is reachable and correctly rendered |
| E2E | Playwright | Full lifecycle correctness against the running app |

### Defense rationale by layer

**Unit tests** guard logic regressions. The HCM engine's `submitRequest` has branching behavior (silent fail, insufficient balance, version conflict) that must be verified in isolation without network or render overhead. The Zustand store's `registerOptimistic`/`unregisterOptimistic` must be verified as idempotent.

**Hook tests** guard the optimistic/pessimistic contracts. The critical invariants to test:
- `onMutate` actually cancels in-flight queries before applying the delta
- `onError` restores the exact pre-mutation cache snapshot (not a re-fetch — a snapshot restore)
- `onSettled` fires `invalidateQueries` regardless of success or failure
- `useApproveRequest` calls `fetchBalance` before `approveRequest` and passes the fresh version

**Component tests** guard render regressions. The status-badge color system is critical UX signal — a `needs-attention` badge rendered as `approved` green is a serious regression that unit tests would not catch.

**Storybook interaction tests** are the proof-of-reachability. States like `optimistic-pending`, `rolled-back`, and `needs-attention` can exist for milliseconds in real usage and are hard to exercise manually. The `play()` API drives the component through the exact sequence of actions that produces each state and asserts the rendered output.

**E2E tests** guard integration failures:
- The Next.js route handler correctly proxies to the HCM engine
- The MSW worker intercepts correctly in the browser environment (not just Vitest's Node environment)
- The full employee submit → manager approval lifecycle, including the version-gate rejection scenario
- **Leave-type cache isolation** (`leave-type-switch.spec.ts`): switching the selector updates the displayed available days and the insufficient-balance guard per type — the regression that motivated the 4-segment per-cell key
- **Post-mutation auto-refresh** (`reconciliation-refresh.spec.ts`): the balance cards and request history update when a reconciliation warning appears, and a normal submit raises no spurious warning — guarding the two-effect `useReconciliation` design (§7)

### What is deliberately not tested

- **Visual pixel-level regressions:** Handled by Chromatic visual diffing, not unit assertions
- **Network error retry timing:** TanStack Query's retry behavior (`retry: 2`) is already tested in TanStack Query's own test suite; we do not duplicate that
- **Exact 60s refetch interval timing:** Too flaky for unit tests. The anniversary bonus E2E test validates this behavior functionally by triggering a balance change and asserting the banner appears within the next refetch cycle

---

## 10. Mock HCM Design

The mock is the single source of truth for all three test layers. There is one implementation (`mocks/hcm-engine.ts`), no separate "test-only" mock that could drift from the running app.

### State model

The engine maintains three in-memory maps:

```typescript
let balances: Map<BalanceKey, Balance>       // key: `${employeeId}:${locationId}:${balanceType}`
let employees: Map<string, Employee>
let requests: Map<string, InternalRequest>   // uses InternalStatus including 'silent-failure'
```

`silent-failure` is an internal status. `getRequests` and `getRequest` strip it, returning `submitted` to the outside world — this accurately models real HCM behavior where a silent failure is indistinguishable from a successful submit at the API surface.

### Seed data

Three employees covering the interesting test scenarios:

| Employee | Location | Vacation | Notable |
|---|---|---|---|
| Alice (emp-001) | loc-nyc | 15 days | Happy path baseline; anniversary bonus target |
| Bob (emp-002) | loc-sf | 12 days | Version conflict scenario target |
| Carol (emp-003) | loc-nyc | 5 days | Low balance; insufficient balance scenario |

### Chaos configuration

```typescript
let silentFailRate = 0.1           // 10% ambient silent failure rate
let forceNextSilentFail = false    // deterministic for tests
let forceNextConflict = false      // deterministic for tests
```

The ambient 10% silent fail rate is intentional — it exercises the reconciliation path in manual testing without any explicit configuration. For automated tests, `setForceNextSilentFail(true)` and `setForceNextConflict(true)` provide deterministic control.

`resetState()` restores all maps and chaos flags to seed values — every test that needs isolation calls this in `beforeEach`.

### Interesting behaviors implemented

| Behavior | Trigger | Effect |
|---|---|---|
| Submit debit | `submitRequest(...)` | `availableDays -= days`, `pendingDays += days`, bumps version — the single point where `availableDays` is reduced |
| Silent failure | `shouldSilentFail()` | Returns `success: true` + `requestId` but does NOT decrement balance; request stored as `silent-failure` internally |
| Version conflict | `shouldConflict() \|\| balance.version !== expectedVersion` | Returns `VERSION_CONFLICT` error — evaluated in both `submitRequest` and `approveRequest` |
| Insufficient (submit) | `balance.availableDays < req.days` | Returns `INSUFFICIENT_BALANCE` — hard rejection, no request stored |
| Insufficient (approve) | `balance.pendingDays < request.days` | Returns `INSUFFICIENT_BALANCE` — the reserved slot, not `availableDays` (which was already debited at submit) |
| Approve | `approveRequest(...)` | Clears the reservation: `pendingDays -= days`; does **not** touch `availableDays` again; bumps version |
| Deny + restore | `denyRequest(requestId)` | For `submitted` requests, restores `availableDays += days` and clears `pendingDays -= days`; bumps version |
| Anniversary bonus | `triggerAnniversaryBonus(employeeId)` | Adds 3 days to vacation balance, bumps version — detectable by `useReconciliation` |
| Name enrichment | `getRequests(...)` | Each returned request is enriched with `employeeName` via `getEmployee(employeeId)?.name` — derived at read time, never stored |
| Batch latency | (in MSW handler) | 800ms simulated delay on `GET /api/hcm/balances` |

### Test scenario catalog

```typescript
// mocks/scenarios.ts
Scenarios.HAPPY_PATH           // Alice, 15 days, submits 3
Scenarios.INSUFFICIENT_BALANCE // Carol, 5 days, requests 8 — hard rejection
Scenarios.SILENT_FAILURE       // Alice, forceNextSilentFail — tests reconciliation path
Scenarios.VERSION_CONFLICT     // Bob, forceNextConflict — tests manager approval gate
Scenarios.ANNIVERSARY_BONUS    // Alice — tests mid-session out-of-band balance change
Scenarios.LOW_BALANCE          // Carol — tests near-zero balance display
Scenarios.MANAGER_VIEW         // Alice as manager reviewing team requests
```

---

## 11. Alternatives Considered

### SWR instead of TanStack Query

SWR is lighter and simpler. The specific reasons it was not chosen:

- SWR's `mutate` function for optimistic updates does not provide an equivalent to TanStack Query's `cancelQueries` in `onMutate`. Preventing in-flight background refetches from landing after optimistic state would require hand-rolling the cancellation logic.
- SWR has no equivalent to TanStack Query's `optimisticRegistry`-friendly mutation lifecycle (`onMutate` → `onError` → `onSettled` with context passing). The context-passing pattern is what allows `onError` to restore the exact pre-mutation snapshot rather than re-fetching.
- The `QueryKeys` factory pattern is idiomatic TanStack Query and enables precise cache targeting that would be more verbose in SWR.

### Zustand for all server state (no TanStack Query)

This would give maximum control. The specific reasons it was not chosen:

- Cache deduplication, staleTime management, background refetch scheduling, and retry logic would all need to be implemented from scratch. These are solved problems in TanStack Query.
- The ergonomics of `useQuery` + `useMutation` + `invalidateQueries` are well-understood by the engineering team. Custom state management for server data adds cognitive overhead without adding capability.

### Pessimistic employee submit

The safest option from a data-correctness standpoint. Not chosen because:

- Employee submit is the highest-frequency action in the system. Adding one full round-trip (GET balance → submit) to every submit would make the most common action feel slow.
- The failure modes of optimistic submit are fully recoverable: rollback is explicit, visible, and specific. The cost of a wrong optimistic state is a visible "your request was rolled back" message — not a silent incorrect balance.
- The asymmetry (optimistic submit, pessimistic approval) is justified by the asymmetric cost of failure in each case.

### Jest instead of Vitest

Jest is more mature for React testing and has more community-documented MSW patterns. Not chosen because:

- The project uses Next.js 16 with React 19 and full ESM modules throughout. Jest's ESM support requires significant `transformIgnorePatterns` and `moduleNameMapper` configuration that is fragile under Next.js version updates.
- Vitest is ESM-native and its configuration for this stack is substantially simpler and more stable.
- The MSW Node integration works identically in both; the complexity gap is in the module bundling, not in the test runner features.

### Skip Chromatic

Local Storybook is sufficient to run interaction tests. Chromatic is an additional cost. Not skipped because:

- The status-badge color system is critical UX signal (`needs-attention` amber, `approved` green, `rolled-back` red). A CSS regression that changes `amber-500` to `yellow-500` would not be caught by any assertion-based test but would be caught by a visual diff.
- Chromatic runs against the Storybook build, which covers all the states that are hard to produce in E2E tests.

---

## 12. Running the System

```bash
pnpm dev              # Start Next.js dev server (MSW active in browser)
pnpm test             # Vitest unit + component tests
pnpm test:coverage    # With coverage report
pnpm test:e2e         # Playwright e2e (starts dev server automatically)
pnpm storybook        # Run Storybook locally (port 6006)
pnpm build-storybook  # Build static Storybook
pnpm chromatic        # Deploy to Chromatic
```

### Environment requirements

- Node.js 20+
- pnpm 9+
- For E2E: Playwright browsers installed (`pnpm exec playwright install`)
- For Chromatic: `CHROMATIC_PROJECT_TOKEN` environment variable set

### MSW setup notes

MSW runs as a Service Worker in the browser (`public/mockServiceWorker.js`) and as a Node.js server in Vitest (`vitest.setup.ts`). The same handler definitions in `mocks/` are shared between both environments. Do not bypass MSW in tests to call real endpoints — the engine state would not be isolated between test runs.

### Seed state

The HCM engine seeds on first import. Call `resetState()` in test `beforeEach` to restore to seed values. The seed includes three historical requests (`req-seed-001/002/003`), all in terminal `approved` status so the seeded balances are internally consistent: under the corrected approval accounting (§5), a `submitted` seed request implies a matching `pendingDays` reservation on the balance, and a seed that violated that invariant produced a false `INSUFFICIENT_BALANCE` on approval. The manager-approval E2E therefore seeds its own `submitted` request via the API (reading the live balance version first) rather than relying on a pre-positioned seed — keeping the seed self-consistent and the test self-contained.
