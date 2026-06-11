import React from 'react'
import { render, screen } from '@testing-library/react'
import { BalanceCard } from '@/features/time-off/components/BalanceCard'
import type { Balance } from '@/features/time-off/types'

function makeBalance(overrides: Partial<Balance> = {}): Balance {
  return {
    employeeId: 'emp-001',
    locationId: 'loc-nyc',
    balanceType: 'vacation',
    availableDays: 15,
    pendingDays: 0,
    version: 'v-test-001',
    asOf: new Date().toISOString(),
    ...overrides,
  }
}

describe('BalanceCard', () => {
  it('renders the balance number', () => {
    render(<BalanceCard balance={makeBalance({ availableDays: 15 })} />)
    expect(screen.getByText('15')).toBeInTheDocument()
  })

  it('shows pending days when pendingDays > 0', () => {
    render(<BalanceCard balance={makeBalance({ pendingDays: 3 })} />)
    expect(screen.getByText(/3 days? pending/i)).toBeInTheDocument()
  })

  it('shows fetching indicator (animate-spin) when isFetching is true', () => {
    const { container } = render(
      <BalanceCard balance={makeBalance()} isFetching={true} />,
    )
    // The StaleIndicator renders a Loader2 with animate-spin when isFetching=true
    const spinner = container.querySelector('.animate-spin')
    expect(spinner).toBeInTheDocument()
  })

  it('hides pending days text when pendingDays is 0', () => {
    render(<BalanceCard balance={makeBalance({ pendingDays: 0 })} />)
    expect(screen.queryByText(/days? pending/i)).not.toBeInTheDocument()
  })
})
