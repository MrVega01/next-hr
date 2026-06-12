import { Loader2 } from 'lucide-react'

interface StaleIndicatorProps {
  asOf: string
  isFetching: boolean
}

function getMinutesAgo(isoTimestamp: string): number {
  const diff = Date.now() - new Date(isoTimestamp).getTime()
  return Math.floor(diff / 60_000)
}

export function StaleIndicator({ asOf, isFetching }: StaleIndicatorProps) {
  const minutesAgo = getMinutesAgo(asOf)
  const isStale = minutesAgo >= 5

  return (
    <div className="flex items-center gap-1.5">
      {isFetching && (
        <Loader2 className="size-3 animate-spin text-slate-400" />
      )}
      <span
        className={`text-xs ${
          isStale ? 'text-amber-400' : 'text-slate-400'
        }`}
      >
        {minutesAgo === 0
          ? 'Updated just now'
          : `Last updated: ${minutesAgo} min ago`}
        {isStale && !isFetching && ' · Data may be stale'}
      </span>
    </div>
  )
}
