'use client'

import { useUiStore, useActivePersona, useSelectedEmployeeId } from '@/features/time-off/store/uiStore'
import { useReconciliation } from '@/features/time-off/hooks'
import { BalanceList } from '@/features/time-off/components/BalanceList'
import { RequestForm } from '@/features/time-off/components/RequestForm'
import { RequestList } from '@/features/time-off/components/RequestList'


interface DemoEmployee {
  id: string
  name: string
  locationId: string
}

const DEMO_EMPLOYEES: DemoEmployee[] = [
  { id: 'emp-001', name: 'Alice Johnson', locationId: 'loc-nyc' },
  { id: 'emp-002', name: 'Bob Martinez', locationId: 'loc-sf' },
  { id: 'emp-003', name: 'Carol Smith', locationId: 'loc-nyc' },
]

export function EmployeeView() {
  const selectedEmployeeId = useSelectedEmployeeId()
  const setSelectedEmployeeId = useUiStore((s) => s.setSelectedEmployeeId)

  // Default to first employee if none selected
  const activeId = selectedEmployeeId ?? DEMO_EMPLOYEES[0].id
  const activeEmployee =
    DEMO_EMPLOYEES.find((e) => e.id === activeId) ?? DEMO_EMPLOYEES[0]

  // Activate reconciliation watcher — pass activeId so it knows which queries to refresh
  useReconciliation(activeId)

  return (
    <div className="space-y-8">
      {/* Page header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-100">
            My Time Off
          </h1>
          <p className="mt-0.5 text-sm text-slate-400">
            View balances and submit leave requests
          </p>
        </div>

        {/* Employee switcher (demo) */}
        <div className="flex items-center gap-2">
          <span className="text-xs uppercase tracking-wider text-slate-500">
            Viewing as:
          </span>
          <select
            value={activeId}
            onChange={(e) => setSelectedEmployeeId(e.target.value)}
            className="rounded-lg border border-slate-600 bg-slate-800 px-3 py-1.5 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
          >
            {DEMO_EMPLOYEES.map((emp) => (
              <option key={emp.id} value={emp.id}>
                {emp.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Balances */}
      <section className="space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-500">
          Balances
        </h2>
        <BalanceList employeeId={activeId} />
      </section>

      {/* Divider */}
      <div className="border-t border-slate-700/60" />

      {/* Request form + history — two column on wide screens */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        <section className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-500">
            Request Time Off
          </h2>
          <RequestForm
            employeeId={activeId}
            locationId={activeEmployee.locationId}
          />
        </section>

        <section className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-500">
            Request History
          </h2>
          <RequestList employeeId={activeId} />
        </section>
      </div>
    </div>
  )
}
