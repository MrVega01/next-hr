import type { Meta, StoryObj } from '@storybook/nextjs'
import { within, expect, userEvent, fn } from '@storybook/test'
import { RequestTable } from './RequestTable'
import { makeRequest } from '../_stories-helpers'

const meta = {
  title: 'Time Off/RequestTable',
  component: RequestTable,
  tags: ['autodocs'],
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof RequestTable>

export default meta
type Story = StoryObj<typeof meta>

const pending = [
  makeRequest({
    id: 'req-101',
    employeeName: 'Alice Johnson',
    status: 'submitted',
    days: 3,
    notes: 'Family trip to the coast',
  }),
  makeRequest({
    id: 'req-102',
    employeeName: 'Carol Smith',
    balanceType: 'sick',
    status: 'submitted',
    days: 2,
  }),
]

const history = [
  makeRequest({ id: 'req-001', employeeName: 'Alice Johnson', status: 'approved', notes: 'Summer vacation' }),
  makeRequest({ id: 'req-002', employeeName: 'Bob Martinez', balanceType: 'sick', status: 'approved', days: 2 }),
  makeRequest({
    id: 'req-003',
    employeeName: 'Carol Smith',
    status: 'denied',
    days: 4,
    hcmRejectionReason: 'Insufficient vacation balance.',
  }),
]

/** Pending list with the Review action column wired up. */
export const PendingWithReview: Story = {
  args: {
    requests: pending,
    onReview: fn(),
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    // Column headers render.
    await expect(canvas.getByText('Employee')).toBeInTheDocument()
    await expect(canvas.getByText('Action')).toBeInTheDocument()
    // Clicking Review fires the callback.
    const reviewButtons = canvas.getAllByRole('button', { name: /review/i })
    await userEvent.click(reviewButtons[0])
    await expect(args.onReview).toHaveBeenCalledWith(pending[0])
  },
}

/** Read-only history: no Action column when onReview is omitted. */
export const HistoryReadOnly: Story = {
  args: {
    requests: history,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.queryByText('Action')).not.toBeInTheDocument()
    await expect(canvas.getByText('Insufficient vacation balance.')).toBeInTheDocument()
  },
}

/** Single row — minimal data, no notes. */
export const SingleRow: Story = {
  args: {
    requests: [makeRequest({ employeeName: 'Bob Martinez', status: 'submitted', days: 1 })],
    onReview: fn(),
  },
}
