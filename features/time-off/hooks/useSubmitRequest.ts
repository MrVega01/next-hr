'use client'

import { useEffect } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { QueryCacheNotifyEvent } from '@tanstack/react-query'
import { submitTimeOffRequest } from '@/features/time-off/api/hcmClient'
import { QueryKeys } from '@/lib/query-client'
import { useUiStore } from '@/features/time-off/store/uiStore'
import type {
  Balance,
  HcmBatchBalancesResponse,
  HcmSubmitResult,
  TimeOffRequest,
} from '@/features/time-off/types'

type SubmitVariables = Omit<TimeOffRequest, 'id' | 'status' | 'createdAt' | 'updatedAt'>

interface RollbackContext {
  previousBalance: Balance | undefined
  previousBalances: HcmBatchBalancesResponse | undefined
  optimisticKey: string
  tempId: string
}

export function useSubmitRequest() {
  const queryClient = useQueryClient()
  const { registerOptimistic, unregisterOptimistic, addToast } = useUiStore.getState()

  return useMutation<HcmSubmitResult, Error, SubmitVariables, RollbackContext>({
    mutationFn: (req) => submitTimeOffRequest(req),

    onMutate: async (variables) => {
      const { employeeId, locationId, balanceType, days, baseVersion } = variables

      // 1 & 2. Cancel in-flight background refetches that could clobber optimistic state
      await queryClient.cancelQueries({
        queryKey: QueryKeys.balance(employeeId, locationId),
      })
      await queryClient.cancelQueries({
        queryKey: QueryKeys.balances(employeeId),
      })

      // 3. Snapshot current cache for rollback
      const previousBalance = queryClient.getQueryData<Balance>(
        QueryKeys.balance(employeeId, locationId),
      )
      const previousBalances = queryClient.getQueryData<HcmBatchBalancesResponse>(
        QueryKeys.balances(employeeId),
      )

      // 4 & 5. Compute and apply optimistic balance update
      if (previousBalance) {
        const optimisticBalance: Balance = {
          ...previousBalance,
          availableDays: previousBalance.availableDays - days,
          pendingDays: previousBalance.pendingDays + days,
          asOf: new Date().toISOString(),
        }
        queryClient.setQueryData<Balance>(
          QueryKeys.balance(employeeId, locationId),
          optimisticBalance,
        )
      }

      // 6. Register in Zustand optimistic registry
      const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2)}`
      const optimisticKey = `${employeeId}:${locationId}:${balanceType}`
      registerOptimistic(optimisticKey, {
        requestId: tempId,
        employeeId,
        locationId,
        balanceType,
        deltaApplied: -days,
        baseVersion,
        snapshotAvailableDays: previousBalance?.availableDays ?? -1,
        timestamp: Date.now(),
      })

      // 7. Info toast
      addToast({
        id: `toast-${tempId}`,
        type: 'info',
        message: 'Submitting your time-off request...',
        requestId: tempId,
      })

      // 8. Return rollback context
      return { previousBalance, previousBalances, optimisticKey, tempId }
    },

    onError: (error, variables, context) => {
      if (!context) return

      const { employeeId, locationId } = variables
      const { previousBalance, previousBalances, optimisticKey } = context

      // 1. Restore cache snapshots
      if (previousBalance !== undefined) {
        queryClient.setQueryData<Balance>(
          QueryKeys.balance(employeeId, locationId),
          previousBalance,
        )
      }
      if (previousBalances !== undefined) {
        queryClient.setQueryData<HcmBatchBalancesResponse>(
          QueryKeys.balances(employeeId),
          previousBalances,
        )
      }

      // 2. Unregister optimistic entry
      unregisterOptimistic(optimisticKey)

      // 3. Error toast with code-specific message
      const message = resolveErrorMessage(error.message)
      addToast({
        id: `toast-err-${Date.now()}`,
        type: 'error',
        message,
      })
    },

    onSuccess: (result, variables, context) => {
      if (!context) return

      const { employeeId, locationId } = variables
      const { previousBalance, previousBalances, optimisticKey } = context

      if (!result.success) {
        // Treat like onError: rollback
        if (previousBalance !== undefined) {
          queryClient.setQueryData<Balance>(
            QueryKeys.balance(employeeId, locationId),
            previousBalance,
          )
        }
        if (previousBalances !== undefined) {
          queryClient.setQueryData<HcmBatchBalancesResponse>(
            QueryKeys.balances(employeeId),
            previousBalances,
          )
        }
        unregisterOptimistic(optimisticKey)

        const message = resolveErrorMessage(result.error ?? '', result.errorCode)
        addToast({
          id: `toast-err-${Date.now()}`,
          type: 'error',
          message,
          requestId: result.requestId,
        })
      } else {
        addToast({
          id: `toast-ok-${Date.now()}`,
          type: 'success',
          message: 'Time-off request submitted successfully.',
          requestId: result.requestId,
        })
      }
    },

    onSettled: (result, _error, variables, context) => {
      if (!context) return

      const { employeeId, locationId } = variables
      const { optimisticKey } = context

      // 1. Always invalidate the specific balance cell for authoritative re-read.
      // The reconciliation watcher (useReconciliation) will unregister the optimistic
      // registry entry once the re-read lands — do NOT unregister here, otherwise
      // the watcher fires after an empty registry and the mismatch check is skipped.
      void queryClient.invalidateQueries({
        queryKey: QueryKeys.balance(employeeId, locationId),
      })

      // 2. If success, delay-invalidate requests list
      if (result?.success) {
        setTimeout(() => {
          void queryClient.invalidateQueries({
            queryKey: QueryKeys.requests(employeeId),
          })
        }, 500)
      }
    },
  })
}

function resolveErrorMessage(
  errorMsg: string,
  errorCode?: HcmSubmitResult['errorCode'],
): string {
  const code = errorCode ?? detectCodeFromMessage(errorMsg)
  switch (code) {
    case 'INSUFFICIENT_BALANCE':
      return 'Not enough days available.'
    case 'VERSION_CONFLICT':
      return 'Balance changed — please refresh.'
    case 'INVALID_DIMENSION':
      return 'Invalid request parameters. Please check your input.'
    case 'SILENT_FAILURE':
      return 'The request could not be processed. Please try again.'
    default:
      return errorMsg || 'An unexpected error occurred. Please try again.'
  }
}

function detectCodeFromMessage(msg: string): HcmSubmitResult['errorCode'] | undefined {
  if (msg.includes('INSUFFICIENT_BALANCE')) return 'INSUFFICIENT_BALANCE'
  if (msg.includes('VERSION_CONFLICT')) return 'VERSION_CONFLICT'
  if (msg.includes('INVALID_DIMENSION')) return 'INVALID_DIMENSION'
  if (msg.includes('SILENT_FAILURE')) return 'SILENT_FAILURE'
  return undefined
}

// ---------------------------------------------------------------------------
// useReconciliation — watches the query cache for balance updates that
// contradict pending optimistic writes registered in Zustand.
// ---------------------------------------------------------------------------
export function useReconciliation() {
  const queryClient = useQueryClient()

  useEffect(() => {
    const queryCache = queryClient.getQueryCache()

    const unsubscribe = queryCache.subscribe((event: QueryCacheNotifyEvent) => {
      if (event.type !== 'updated') return
      // Only react to genuine fetch completions, not setQueryData (optimistic writes)
      // or invalidate/cancel actions which also fire 'updated' events.
      if (event.action.type !== 'success') return

      const query = event.query
      const queryKey = query.queryKey as readonly unknown[]

      // Only react to single-balance queries: ['balance', employeeId, locationId]
      if (queryKey[0] !== 'balance' || queryKey.length !== 3) return

      const employeeId = queryKey[1] as string
      const locationId = queryKey[2] as string

      const freshBalance = queryClient.getQueryData<Balance>(queryKey as Parameters<typeof queryClient.getQueryData>[0])
      if (!freshBalance) return

      const registry = useUiStore.getState().optimisticRegistry

      // Check every registered optimistic entry that matches this (employeeId, locationId)
      for (const [key, entry] of Object.entries(registry)) {
        if (entry.employeeId !== employeeId || entry.locationId !== locationId) continue

        // Detect external mutation: if the server's available days don't match what
        // we expected after our delta, something changed the balance independently
        // (anniversary bonus, admin adjustment, etc.).
        // snapshotAvailableDays=-1 means we had no cached balance at mutation time;
        // skip reconciliation in that case.
        const expectedAvailable = entry.snapshotAvailableDays + entry.deltaApplied
        const balanceMismatch =
          entry.snapshotAvailableDays >= 0 &&
          freshBalance.availableDays !== expectedAvailable

        if (balanceMismatch) {
          useUiStore.getState().addToast({
            id: `toast-reconcile-${key}-${Date.now()}`,
            type: 'warning',
            message:
              'Your balance was updated by the system. Your request may need review.',
            requestId: entry.requestId,
          })
        }

        // Always clean up — the authoritative re-read has landed.
        useUiStore.getState().unregisterOptimistic(key)
      }
    })

    return () => {
      unsubscribe()
    }
  }, [queryClient])
}
