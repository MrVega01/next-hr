import type { Meta, StoryObj } from '@storybook/nextjs'
import { within, expect } from '@storybook/test'
import React from 'react'
import { StatusBadge } from './StatusBadge'
import type { RequestStatus } from '@/features/time-off/types'

const meta = {
  title: 'Time Off/StatusBadge',
  component: StatusBadge,
  tags: ['autodocs'],
} satisfies Meta<typeof StatusBadge>

export default meta
type Story = StoryObj<typeof meta>

const ALL_STATUSES: RequestStatus[] = [
  'optimistic-pending',
  'submitted',
  'approved',
  'denied',
  'rolled-back',
  'needs-attention',
  'draft',
]

export const AllStatuses: Story = {
  // args.status is required by the component type; render overrides the whole story
  args: { status: 'submitted' },
  render: () => (
    <div className="flex flex-wrap gap-3">
      {ALL_STATUSES.map((status) => (
        <StatusBadge key={status} status={status} />
      ))}
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('Approved')).toBeInTheDocument()
    await expect(canvas.getByText('Denied')).toBeInTheDocument()
  },
}
