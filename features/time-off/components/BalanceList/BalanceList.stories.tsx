import type { Meta, StoryObj } from '@storybook/nextjs'
import { within, expect } from '@storybook/test'
import { BalanceList } from './BalanceList'
import { makeBalance } from '../_stories-helpers'
import type { HcmBatchBalancesResponse } from '@/features/time-off/types'

// QueryKeys.balances('emp-001') === ['balances', 'emp-001']
const CACHE_KEY = JSON.stringify(['balances', 'emp-001'])

const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()

const mockBalances = [
  makeBalance({ balanceType: 'vacation', availableDays: 15 }),
  makeBalance({ balanceType: 'sick', availableDays: 10 }),
  makeBalance({ balanceType: 'personal', availableDays: 5 }),
]

const staleBalances = [
  makeBalance({ balanceType: 'vacation', availableDays: 15, asOf: oneHourAgo }),
  makeBalance({ balanceType: 'sick', availableDays: 10, asOf: oneHourAgo }),
]

const meta = {
  title: 'Time Off/BalanceList',
  component: BalanceList,
  args: {
    employeeId: 'emp-001',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof BalanceList>

export default meta
type Story = StoryObj<typeof meta>

export const Loading: Story = {
  // No cache entry — hook stays in loading state (no network request fires
  // because there is no MSW; the query remains suspended in loading).
  parameters: {
    queryData: {},
  },
}

export const WithBalances: Story = {
  parameters: {
    queryData: {
      [CACHE_KEY]: {
        balances: mockBalances,
        fetchedAt: new Date().toISOString(),
      } satisfies HcmBatchBalancesResponse,
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    // The vacation balance card should show "15"
    await expect(canvas.getByText('15')).toBeInTheDocument()
  },
}

export const Empty: Story = {
  parameters: {
    queryData: {
      [CACHE_KEY]: {
        balances: [],
        fetchedAt: new Date().toISOString(),
      } satisfies HcmBatchBalancesResponse,
    },
  },
}

export const Stale: Story = {
  parameters: {
    queryData: {
      [CACHE_KEY]: {
        balances: staleBalances,
        fetchedAt: oneHourAgo,
      } satisfies HcmBatchBalancesResponse,
    },
  },
}
