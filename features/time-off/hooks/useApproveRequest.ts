'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  fetchBalance,
  approveRequest,
} from '@/features/time-off/api/hcmClient'
import { QueryKeys } from '@/lib/query-client'
import { useUiStore } from '@/features/time-off/store/uiStore'
import type { HcmSubmitResult } from '@/features/time-off/types'

interface ApproveVariables {
  requestId: string
  employeeId: string
  locationId: string
  balanceType: string
}

export function useApproveRequest() {
  const queryClient = useQueryClient()
  const { addToast } = useUiStore.getState()

  return useMutation<HcmSubmitResult, Error, ApproveVariables>({
    mutationFn: async ({ requestId, employeeId, locationId, balanceType }) => {
      // 1. Re-fetch the authoritative balance (bypass cache) to get current version
      const currentBalance = await fetchBalance(employeeId, locationId, balanceType)
      const currentVersion = currentBalance.version

      // 2. Call approve with the fresh version
      return approveRequest(requestId, employeeId, locationId, currentVersion)
    },

    onError: (_error, _variables) => {
      addToast({
        id: `toast-approve-err-${Date.now()}`,
        type: 'error',
        message: 'Failed to approve the request. Please try again.',
      })
    },

    onSuccess: (result, { employeeId, locationId, balanceType }) => {
      if (!result.success) {
        const message = resolveApproveErrorMessage(result.errorCode)
        addToast({
          id: `toast-approve-err-${Date.now()}`,
          type: 'error',
          message,
        })
        return
      }

      void queryClient.invalidateQueries({
        queryKey: QueryKeys.balance(employeeId, locationId, balanceType),
      })
      void queryClient.invalidateQueries({
        queryKey: QueryKeys.requests(employeeId),
      })
      void queryClient.invalidateQueries({
        queryKey: QueryKeys.allRequests(),
      })

      addToast({
        id: `toast-approve-ok-${Date.now()}`,
        type: 'success',
        message: 'Request approved successfully.',
        requestId: result.requestId,
      })
    },
  })
}

function resolveApproveErrorMessage(
  errorCode: HcmSubmitResult['errorCode'],
): string {
  switch (errorCode) {
    case 'VERSION_CONFLICT':
      return 'Balance changed since you loaded this page. Please refresh.'
    case 'INSUFFICIENT_BALANCE':
      return 'Insufficient balance — the employee no longer has enough days.'
    case 'INVALID_DIMENSION':
      return 'Invalid request parameters.'
    case 'SILENT_FAILURE':
      return 'The approval could not be processed. Please try again.'
    default:
      return 'An unexpected error occurred while approving the request.'
  }
}
