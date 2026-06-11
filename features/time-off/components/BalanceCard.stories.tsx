import type { Meta, StoryObj } from '@storybook/nextjs'
import { BalanceCard } from './BalanceCard'
import { makeBalance } from './_stories-helpers'

const meta = {
  title: 'Time Off/BalanceCard',
  component: BalanceCard,
  tags: ['autodocs'],
} satisfies Meta<typeof BalanceCard>

export default meta
type Story = StoryObj<typeof meta>

const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()

export const Default: Story = {
  args: {
    balance: makeBalance({ employeeId: 'emp-001', availableDays: 15 }),
    isStale: false,
    isFetching: false,
  },
}

export const WithPendingDays: Story = {
  args: {
    balance: makeBalance({ availableDays: 15, pendingDays: 3 }),
    isStale: false,
    isFetching: false,
  },
}

export const LowBalance: Story = {
  args: {
    balance: makeBalance({ employeeId: 'emp-003', availableDays: 2, pendingDays: 0 }),
    isStale: false,
    isFetching: false,
  },
}

export const Fetching: Story = {
  args: {
    balance: makeBalance(),
    isStale: false,
    isFetching: true,
  },
}

export const Stale: Story = {
  args: {
    balance: makeBalance({ asOf: oneHourAgo }),
    isStale: true,
    isFetching: false,
  },
}
