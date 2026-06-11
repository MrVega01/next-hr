import React from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ReconciliationBanner } from '@/features/time-off/components/ReconciliationBanner'
import { useUiStore } from '@/features/time-off/store/uiStore'

beforeEach(() => {
  useUiStore.setState({
    activePersona: 'employee',
    selectedEmployeeId: null,
    optimisticRegistry: {},
    toasts: [],
  })
})

describe('ReconciliationBanner', () => {
  it('is not rendered when there are no warning toasts', () => {
    render(<ReconciliationBanner />)
    expect(screen.queryByText('Your available balance changed')).not.toBeInTheDocument()
  })

  it('is visible when a warning toast with a requestId exists', () => {
    useUiStore.getState().addToast({
      id: 'toast-warn-001',
      type: 'warning',
      message: 'Your balance was updated while this form was open. Check the available days above before submitting.',
      requestId: 'req-temp-001',
    })

    render(<ReconciliationBanner />)
    expect(screen.getByText('Your available balance changed')).toBeInTheDocument()
    expect(
      screen.getByText(/balance was updated while this form was open/i),
    ).toBeInTheDocument()
  })

  it('does NOT show when warning toast has no requestId', () => {
    useUiStore.getState().addToast({
      id: 'toast-warn-002',
      type: 'warning',
      message: 'Some generic warning without a requestId',
      // no requestId
    })

    render(<ReconciliationBanner />)
    expect(screen.queryByText('Your available balance changed')).not.toBeInTheDocument()
  })

  it('dismiss button removes the banner', async () => {
    const user = userEvent.setup()

    useUiStore.getState().addToast({
      id: 'toast-warn-003',
      type: 'warning',
      message: 'Your balance was updated while this form was open. Check the available days above before submitting.',
      requestId: 'req-temp-003',
    })

    render(<ReconciliationBanner />)
    expect(screen.getByText('Your available balance changed')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /dismiss/i }))

    expect(screen.queryByText('Your available balance changed')).not.toBeInTheDocument()
  })
})
