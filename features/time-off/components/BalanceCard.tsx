'use client'

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { StaleIndicator } from './StaleIndicator'
import type { Balance } from '@/features/time-off/types'

interface BalanceCardProps {
  balance: Balance
  isStale?: boolean
  isFetching?: boolean
}

const BALANCE_TYPE_LABELS: Record<string, string> = {
  vacation: 'Vacation',
  sick: 'Sick Leave',
  personal: 'Personal',
}

const LOCATION_LABELS: Record<string, string> = {
  'loc-nyc': 'NYC',
  'loc-sf': 'SF',
}

export function BalanceCard({
  balance,
  isStale = false,
  isFetching = false,
}: BalanceCardProps) {
  const typeLabel =
    BALANCE_TYPE_LABELS[balance.balanceType] ?? balance.balanceType
  const locationLabel =
    LOCATION_LABELS[balance.locationId] ?? balance.locationId

  return (
    <Card
      className={`border-slate-700 bg-slate-800/60 text-slate-100 transition-shadow ${
        isFetching
          ? 'shadow-[0_0_0_1px_rgba(245,158,11,0.4)] ring-amber-500/30'
          : ''
      }`}
    >
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-sm font-medium uppercase tracking-wider text-slate-400">
            {typeLabel}
          </CardTitle>
          <Badge
            variant="outline"
            className="border-slate-600 text-slate-400 font-mono text-xs"
          >
            {locationLabel}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* Primary balance number */}
        <div className="font-mono text-5xl font-bold tracking-tight text-slate-100">
          {balance.availableDays}
          <span className="ml-1.5 text-base font-normal text-slate-400">
            days
          </span>
        </div>

        {/* Pending days */}
        {balance.pendingDays > 0 && (
          <p className="text-sm font-mono text-amber-400">
            {balance.pendingDays} day{balance.pendingDays !== 1 ? 's' : ''} pending
          </p>
        )}

        {/* Stale indicator */}
        <StaleIndicator asOf={balance.asOf} isFetching={isFetching} />
      </CardContent>
    </Card>
  )
}
