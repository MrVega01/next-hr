import type { Meta, StoryObj } from '@storybook/nextjs'
import { RequestForm } from './RequestForm'
import { makeBalance } from './_stories-helpers'

// QueryKeys.balance('emp-001', 'loc-nyc', 'vacation') === ['balance', 'emp-001', 'loc-nyc', 'vacation']
const aliceCacheKey = JSON.stringify(['balance', 'emp-001', 'loc-nyc', 'vacation'])
// QueryKeys.balance('emp-003', 'loc-nyc', 'vacation') === ['balance', 'emp-003', 'loc-nyc', 'vacation']
const carolCacheKey = JSON.stringify(['balance', 'emp-003', 'loc-nyc', 'vacation'])

const meta = {
  title: 'Time Off/RequestForm',
  component: RequestForm,
  tags: ['autodocs'],
} satisfies Meta<typeof RequestForm>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    employeeId: 'emp-001',
    locationId: 'loc-nyc',
  },
  parameters: {
    queryData: {
      [aliceCacheKey]: makeBalance({
        employeeId: 'emp-001',
        locationId: 'loc-nyc',
        availableDays: 15,
        pendingDays: 0,
      }),
    },
  },
}

export const InsufficientBalance: Story = {
  args: {
    employeeId: 'emp-003',
    locationId: 'loc-nyc',
  },
  parameters: {
    queryData: {
      [carolCacheKey]: makeBalance({
        employeeId: 'emp-003',
        locationId: 'loc-nyc',
        availableDays: 2,
        pendingDays: 0,
      }),
    },
  },
}
