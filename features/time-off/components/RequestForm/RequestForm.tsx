'use client'

import { useState, useMemo } from 'react'
import { useBalance, useSubmitRequest } from '@/features/time-off/hooks'
import { ReconciliationBanner } from '../ReconciliationBanner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { BalanceType } from '@/features/time-off/types'

interface RequestFormProps {
  employeeId: string
  locationId: string
  onSuccess?: () => void
}

const BALANCE_TYPES: Array<{ value: BalanceType; label: string }> = [
  { value: 'vacation', label: 'Vacation' },
  { value: 'sick', label: 'Sick Leave' },
  { value: 'personal', label: 'Personal' },
]

function computeDays(start: string, end: string): number {
  if (!start || !end) return 0
  const s = new Date(start)
  const e = new Date(end)
  if (e < s) return 0
  const diffMs = e.getTime() - s.getTime()
  return Math.floor(diffMs / (1000 * 60 * 60 * 24)) + 1
}

export function RequestForm({
  employeeId,
  locationId,
  onSuccess,
}: RequestFormProps) {
  const [balanceType, setBalanceType] = useState<BalanceType>('vacation')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [notes, setNotes] = useState('')

  const days = useMemo(
    () => computeDays(startDate, endDate),
    [startDate, endDate],
  )

  const balanceQuery = useBalance(employeeId, locationId, balanceType)
  const currentBalance = balanceQuery.data

  const submitMutation = useSubmitRequest()

  const hasInsufficientBalance =
    currentBalance != null && days > 0 && days > currentBalance.availableDays

  const isFormInvalid =
    !startDate || !endDate || days <= 0 || endDate < startDate

  const isDisabled =
    submitMutation.isPending || hasInsufficientBalance || isFormInvalid

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (isDisabled || !currentBalance) return

    await submitMutation.mutateAsync(
      {
        employeeId,
        locationId,
        balanceType,
        days,
        startDate,
        endDate,
        notes: notes.trim() || undefined,
        baseVersion: currentBalance.version,
      },
      {
        onSuccess: (result) => {
          if (result.success) {
            setStartDate('')
            setEndDate('')
            setNotes('')
            onSuccess?.()
          }
        },
      },
    )
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-5 rounded-xl border border-slate-700 bg-slate-800/60 p-5"
    >
      {/* Balance type */}
      <div className="space-y-1.5">
        <Label
          htmlFor="balance-type"
          className="text-xs uppercase tracking-wider text-slate-400"
        >
          Leave Type
        </Label>
        <select
          id="balance-type"
          value={balanceType}
          onChange={(e) => setBalanceType(e.target.value as BalanceType)}
          className="h-8 w-full rounded-lg border border-slate-600 bg-slate-900 px-2.5 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500/50"
        >
          {BALANCE_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>

        {/* Balance preview */}
        {currentBalance && (
          <p className="text-xs text-slate-400">
            Available:{' '}
            <span className="font-mono text-slate-200">
              {currentBalance.availableDays} days
            </span>
            {currentBalance.pendingDays > 0 && (
              <span className="ml-2 text-amber-400">
                ({currentBalance.pendingDays} pending)
              </span>
            )}
          </p>
        )}
        {balanceQuery.isLoading && (
          <p className="text-xs text-slate-500">Loading balance...</p>
        )}
      </div>

      {/* Date range */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label
            htmlFor="start-date"
            className="text-xs uppercase tracking-wider text-slate-400"
          >
            Start Date
          </Label>
          <Input
            id="start-date"
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="border-slate-600 bg-slate-900 text-slate-100 focus-visible:ring-amber-500/50"
          />
        </div>
        <div className="space-y-1.5">
          <Label
            htmlFor="end-date"
            className="text-xs uppercase tracking-wider text-slate-400"
          >
            End Date
          </Label>
          <Input
            id="end-date"
            type="date"
            value={endDate}
            min={startDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="border-slate-600 bg-slate-900 text-slate-100 focus-visible:ring-amber-500/50"
          />
        </div>
      </div>

      {/* Day count preview */}
      {days > 0 && (
        <p className="text-sm font-mono text-slate-300">
          {days} business day{days !== 1 ? 's' : ''}
          {hasInsufficientBalance && (
            <span className="ml-2 text-red-400">— insufficient balance</span>
          )}
        </p>
      )}

      {/* Notes */}
      <div className="space-y-1.5">
        <Label
          htmlFor="notes"
          className="text-xs uppercase tracking-wider text-slate-400"
        >
          Notes{' '}
          <span className="normal-case text-slate-500">(optional)</span>
        </Label>
        <textarea
          id="notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          placeholder="Reason for leave..."
          className="w-full rounded-lg border border-slate-600 bg-slate-900 px-2.5 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500/50 resize-none"
        />
      </div>

      {/* Balance-changed warning — shown when an external update (anniversary bonus,
          admin adjustment) landed while the form was open */}
      <ReconciliationBanner />

      {/* Submit */}
      <Button
        type="submit"
        disabled={isDisabled}
        className="w-full bg-amber-500 text-slate-900 hover:bg-amber-400 font-semibold disabled:opacity-50"
      >
        {submitMutation.isPending ? 'Submitting...' : 'Submit Request'}
      </Button>
    </form>
  )
}
