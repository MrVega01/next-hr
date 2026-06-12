# ExampleHR — Time-Off Frontend

A frontend application for managing employee time-off requests against an external HCM system (Workday/SAP). Built with Next.js 16, React 19, TanStack Query, Zustand, shadcn/ui, and a full test suite covering unit, component, and e2e layers.

See [`docs/TRD.md`](./docs/TRD.md) for the full Technical Requirements Document — including the optimistic vs. pessimistic data strategy, cache invalidation design, and test philosophy.

---

## Prerequisites

- **Node.js** 20+
- **pnpm** 10+ (`npm install -g pnpm`)

---

## Setup

```bash
# 1. Install dependencies
pnpm install

# 2. Copy environment (optional — no secrets required, defaults work locally)
cp .env.example .env.local   # skip if file doesn't exist; app works without it
```

That's it. No database, no external services — all HCM calls are intercepted by a mock service worker in development.

---

## Running the App

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

| Route | Description |
|---|---|
| `/` | Employee view — see balances per location, submit time-off requests |
| `/manager` | Manager view — review and approve/deny pending requests |

The app runs entirely against the **mock HCM engine** in development. MSW intercepts all `/api/hcm/*` requests in the browser — no real HCM needed.

### Mock HCM seed data

| Employee | ID | Location | Vacation | Sick | Personal |
|---|---|---|---|---|---|
| Alice | `emp-001` | NYC | 15 days | 10 days | 3 days |
| Bob | `emp-002` | SF | 12 days | 8 days | 3 days |
| Carol | `emp-003` | NYC | 5 days | 10 days | 2 days |

Carol is intentionally low on vacation to test the insufficient-balance path.

### Test endpoints (development only)

These `_test` endpoints are available in development to drive edge-case scenarios:

| Endpoint | Method | Body | Effect |
|---|---|---|---|
| `/api/hcm/test/reset` | POST | — | Resets all HCM state to seed data |
| `/api/hcm/test/trigger-anniversary` | POST | `{ "employeeId": "emp-001" }` | Adds +3 vacation days (simulates work anniversary) |
| `/api/hcm/test/configure` | POST | `{ "forceNextSilentFail": true }` | Forces the next HCM write to silently fail (returns 200 but doesn't persist) |
| `/api/hcm/test/configure` | POST | `{ "forceNextConflict": true }` | Forces the next approval to return a 409 version conflict |

---

## Running Tests

### Unit + Component tests (Vitest)

```bash
pnpm test                # Run all tests once
pnpm test:watch          # Watch mode
pnpm test:coverage       # With coverage report (written to coverage/)
```

**44 tests** across 8 files:

| File | Layer | What it covers |
|---|---|---|
| `mocks/hcm-engine.test.ts` | Unit | HCM state transitions, silent failure, version conflicts, anniversary bonus |
| `features/time-off/store/uiStore.test.ts` | Unit | Zustand store actions, optimistic registry |
| `lib/query-client.test.ts` | Unit | QueryKey factory shapes |
| `features/time-off/hooks/useBalance.test.tsx` | Hook | Fetch lifecycle, disabled state |
| `features/time-off/hooks/useSubmitRequest.test.tsx` | Hook | Optimistic update, rollback, authoritative re-read |
| `features/time-off/components/BalanceCard/BalanceCard.test.tsx` | Component | Balance rendering, pending days, fetching indicator |
| `features/time-off/components/StatusBadge/StatusBadge.test.tsx` | Component | All status strings |
| `features/time-off/components/ReconciliationBanner/ReconciliationBanner.test.tsx` | Component | Show/hide/dismiss via Zustand |

### End-to-end tests (Playwright)

The dev server starts automatically when running e2e tests.

```bash
pnpm test:e2e            # Headless Chromium
pnpm test:e2e:ui         # Interactive Playwright UI
```

**17 tests** across 5 spec files:

| File | What it covers |
|---|---|
| `e2e/employee-submit.spec.ts` | Balance display, optimistic pending badge, insufficient balance guard |
| `e2e/manager-approve.spec.ts` | Pending request visibility, approve flow, balance at decision time |
| `e2e/anniversary-bonus.spec.ts` | Mid-session balance refresh, ReconciliationBanner appearance and dismiss |
| `e2e/leave-type-switch.spec.ts` | Per-type cache isolation — switching the leave-type selector updates available days and the insufficient-balance guard |
| `e2e/reconciliation-refresh.spec.ts` | Balance cards + history auto-refresh when a reconciliation warning appears; no spurious warning on a normal submit |

---

## Storybook

Storybook covers every meaningful UI state — including states that are hard to reproduce manually (optimistic-rolled-back, HCM-silently-wrong, balance-refreshed-mid-session).

```bash
pnpm storybook           # Start locally at http://localhost:6006
pnpm build-storybook     # Build static output to storybook-static/
```

**12 story files**, each backed by a `mocks/scenarios` preset:

| Component | States covered |
|---|---|
| `BalanceCard` | Default, with pending days, low balance, fetching, stale |
| `BalanceList` | Loading, with balances, empty, stale |
| `StatusBadge` | All 7 statuses (grid) |
| `LoadingSkeleton` | Default |
| `EmptyState` | Default, custom message |
| `StaleIndicator` | Fresh, stale (>5 min), fetching |
| `ReconciliationBanner` | Hidden, visible (with dismiss interaction test) |
| `PendingRequestRow` | All 6 request statuses |
| `RequestForm` | Normal balance, insufficient balance |
| `ApprovalPanel` | Pending approval, version conflict |
| `RequestList` | Mixed statuses, empty |
| `RequestTable` | Pending (with Review action), read-only history, single row |

### Deploy to Chromatic

```bash
CHROMATIC_PROJECT_TOKEN=<your-token> pnpm chromatic
```

---

## Project Structure

```
example-hr/
├── app/                        # Next.js App Router (routing only)
│   ├── (employee)/             # Route group → /
│   ├── manager/                # → /manager
│   ├── api/hcm/                # Next.js route handlers (proxy to mock engine)
│   ├── layout.tsx              # Root layout + Providers
│   └── providers.tsx           # QueryClientProvider + MSW init
│
├── features/time-off/          # All domain logic
│   ├── types/                  # Balance, TimeOffRequest, etc.
│   ├── api/                    # hcmClient.ts — typed fetch wrappers
│   ├── hooks/                  # useBalances, useBalance, useSubmitRequest, useApproveRequest, useReconciliation
│   ├── store/                  # uiStore.ts (Zustand)
│   └── components/             # Domain components — folder-per-component (see below)
│       ├── BalanceCard/        #   BalanceCard.tsx + .test.tsx + .stories.tsx + index.ts
│       ├── RequestForm/        #   …same trio + barrel for each component
│       ├── EmployeeView/       #   Employee page composition (moved from app/_components)
│       ├── RequestTable/       #   Manager review table (pending + history)
│       ├── …                   #   (13 components total)
│       └── _stories-helpers.ts # Shared story fixtures (makeBalance, makeRequest)
│
├── mocks/                      # Mock HCM
│   ├── hcm-engine.ts           # Stateful in-memory HCM simulation
│   ├── handlers.ts             # MSW handlers (shared by app, Storybook, tests)
│   └── scenarios.ts            # Deterministic scenario presets
│
├── lib/
│   ├── query-client.ts         # TanStack QueryClient + QueryKeys
│   └── msw/                    # browser.ts / server.ts setup
│
├── components/                 # Cross-feature components
│   ├── ui/                     #   shadcn/ui primitives (flat — shadcn install target)
│   └── app/                    #   App shell (AppNav) — not tied to a feature
├── e2e/                        # Playwright specs
├── docs/
│   └── TRD.md                  # Technical Requirements Document
└── .claude/agents/             # Custom Claude Code subagents
    ├── architecture.md         # Data layer agent (opus)
    ├── visualist.md            # UI agent (sonnet) — uses frontend-design skill
    └── guardian.md             # Security review agent (opus)
```

### Component organization — three tiers

Every component lives in one of three places, by a single rule: **primitives and app-shell are flat; domain components get a folder.**

| Tier | Location | What lives here | Layout |
|---|---|---|---|
| **Primitives** | `components/ui/` | shadcn/ui primitives (Button, Dialog…) — reusable anywhere, no domain knowledge | flat (shadcn install target) |
| **App shell** | `components/app/` | layout chrome not tied to a feature (AppNav) | flat |
| **Domain** | `features/time-off/components/` | components that know the feature's data — they carry tests + stories | **folder-per-component** |

Each domain component is a self-contained folder — `BalanceCard/` holds `BalanceCard.tsx`, `BalanceCard.test.tsx`, `BalanceCard.stories.tsx`, and a one-line `index.ts` barrel (`export { BalanceCard } from './BalanceCard'`). The barrel keeps imports clean and unchanged (`@/features/time-off/components/BalanceCard`) while real filenames stay visible in editor tabs, fuzzy-find, and stack traces.

---

## Architecture Highlights

**Data layer split:**
- **TanStack Query** owns all server state (balances, requests) — caching, background refetch, optimistic mutations with rollback.
- **Zustand** owns client/UI state — selected persona, in-flight optimistic registry (for reconciliation), toasts.

**Optimistic vs. pessimistic:**
- **Employee submit = optimistic.** Instant feedback is critical; failures surface cleanly via rollback + toast + `rolled-back` status.
- **Manager approval = pessimistic.** Always re-reads the authoritative per-cell balance before writing, version-gated. A manager never approves on stale data.

**HCM silent-failure recovery:**
The mock HCM can return `200 OK` without persisting the write. The app handles this by:
1. Registering every in-flight write in the Zustand `optimisticRegistry`.
2. After `onSettled`, invalidating the balance and doing an authoritative re-read.
3. If the re-read version contradicts the pending write, the `useReconciliation` hook fires a warning toast and marks the request `needs-attention`.
4. The `ReconciliationBanner` surfaces this with a recoverable action — never a silent flip.

Full reasoning in [`docs/TRD.md`](./docs/TRD.md).

---

## Tech Stack

| Concern | Choice |
|---|---|
| Framework | Next.js 16.2.9 (App Router) |
| UI | React 19 + shadcn/ui + Tailwind v4 |
| Server state | TanStack Query 5 |
| Client state | Zustand 5 |
| Mocking | MSW 2 |
| Unit + component tests | Vitest 4 + React Testing Library |
| E2E tests | Playwright |
| Component explorer | Storybook 10 + Chromatic |
| Language | TypeScript (strict) |
| Package manager | pnpm |
