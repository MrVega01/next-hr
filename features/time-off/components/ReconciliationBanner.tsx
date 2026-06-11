'use client'

import { AlertTriangle, X } from 'lucide-react'
import { useToasts } from '@/features/time-off/store/uiStore'
import { useUiStore } from '@/features/time-off/store/uiStore'
import { Button } from '@/components/ui/button'

export function ReconciliationBanner() {
  const toasts = useToasts()
  const removeToast = useUiStore((s) => s.removeToast)

  // Only show warning toasts that have a requestId — those are reconciliation warnings
  const reconciliationWarnings = toasts.filter(
    (t) => t.type === 'warning' && t.requestId,
  )

  if (reconciliationWarnings.length === 0) return null

  // Show the most recent warning, or all if you want to stack
  const latest = reconciliationWarnings[reconciliationWarnings.length - 1]

  return (
    <div className="relative flex items-start gap-3 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
      <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-400" />
      <div className="flex-1 space-y-1">
        <p className="font-semibold text-amber-300">Your available balance changed</p>
        <p className="text-amber-200/80">{latest.message}</p>
        {reconciliationWarnings.length > 1 && (
          <p className="text-xs text-amber-400/70">
            +{reconciliationWarnings.length - 1} more notice
            {reconciliationWarnings.length - 1 !== 1 ? 's' : ''}
          </p>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            // Dismiss all reconciliation toasts
            for (const w of reconciliationWarnings) {
              removeToast(w.id)
            }
          }}
          className="text-amber-400 hover:bg-amber-500/20 hover:text-amber-200"
        >
          <X className="size-3.5" />
          Dismiss
        </Button>
      </div>
    </div>
  )
}
