import React from 'react'
import { render, screen } from '@testing-library/react'
import { StatusBadge } from '@/features/time-off/components/StatusBadge'
import type { RequestStatus } from '@/features/time-off/types'

describe('StatusBadge', () => {
  it.each<[RequestStatus, string]>([
    ['optimistic-pending', 'Pending...'],
    ['approved', 'Approved'],
    ['denied', 'Denied'],
    ['rolled-back', 'Rolled Back'],
    ['needs-attention', 'Needs Attention'],
  ])('renders "%s" status as "%s"', (status, expectedLabel) => {
    render(<StatusBadge status={status} />)
    expect(screen.getByText(expectedLabel, { exact: false })).toBeInTheDocument()
  })
})
