import type { Meta, StoryObj } from '@storybook/nextjs'
import { within, expect } from 'storybook/test'
import { PendingRequestRow } from './PendingRequestRow'
import { makeRequest } from '../_stories-helpers'

const meta = {
  title: 'Time Off/PendingRequestRow',
  component: PendingRequestRow,
  tags: ['autodocs'],
} satisfies Meta<typeof PendingRequestRow>

export default meta
type Story = StoryObj<typeof meta>

export const OptimisticPending: Story = {
  args: {
    request: makeRequest({ status: 'optimistic-pending' }),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('Pending...')).toBeInTheDocument()
  },
}

export const Submitted: Story = {
  args: {
    request: makeRequest({ status: 'submitted' }),
  },
}

export const Approved: Story = {
  args: {
    request: makeRequest({ id: 'req-002', status: 'approved' }),
  },
}

export const Denied: Story = {
  args: {
    request: makeRequest({
      id: 'req-003',
      status: 'denied',
      hcmRejectionReason: 'Insufficient vacation balance.',
    }),
  },
}

export const RolledBack: Story = {
  args: {
    request: makeRequest({
      id: 'req-004',
      status: 'rolled-back',
      hcmRejectionReason: 'HCM silent failure detected during reconciliation.',
    }),
  },
}

export const NeedsAttention: Story = {
  args: {
    request: makeRequest({ id: 'req-005', status: 'needs-attention' }),
  },
}
