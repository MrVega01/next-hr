'use client'

export function LoadingSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <div
          key={i}
          className="animate-pulse rounded-xl border border-slate-700 bg-slate-800/60 p-5"
        >
          {/* Top row: location badge + type label skeleton */}
          <div className="mb-4 flex items-start justify-between">
            <div className="h-4 w-20 rounded-md bg-slate-700" />
            <div className="h-5 w-14 rounded-full bg-slate-700" />
          </div>

          {/* Large balance number */}
          <div className="mb-2 h-12 w-24 rounded-lg bg-slate-700" />

          {/* "X days pending" line */}
          <div className="mb-4 h-4 w-28 rounded-md bg-slate-700" />

          {/* Stale indicator line */}
          <div className="h-3 w-36 rounded-md bg-slate-700/60" />
        </div>
      ))}
    </div>
  )
}
