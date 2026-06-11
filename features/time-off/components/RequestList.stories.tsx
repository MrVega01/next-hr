import type { Meta, StoryObj } from '@storybook/nextjs'
import { RequestList } from './RequestList'
import { makeRequest } from './_stories-helpers'
import type { TimeOffRequest } from '@/features/time-off/types'

// QueryKeys.requests('emp-001') === ['requests', 'emp-001']
const requestsCacheKey = JSON.stringify(['requests', 'emp-001'])

const mixedRequests: TimeOffRequest[] = [
  makeRequest({ id: 'req-001', status: 'optimistic-pending' }),
  makeRequest({ id: 'req-002', status: 'submitted', startDate: '2026-06-01', endDate: '2026-06-03', days: 3 }),
  makeRequest({ id: 'req-003', status: 'needs-attention', startDate: '2026-05-01', endDate: '2026-05-02', days: 2 }),
  makeRequest({ id: 'req-004', status: 'approved', startDate: '2026-04-01', endDate: '2026-04-05', days: 5 }),
  makeRequest({ id: 'req-005', status: 'denied', startDate: '2026-03-10', endDate: '2026-03-12', days: 3, hcmRejectionReason: 'Insufficient balance.' }),
  makeRequest({ id: 'req-006', status: 'rolled-back', startDate: '2026-02-01', endDate: '2026-02-03', days: 3, hcmRejectionReason: 'Silent HCM failure.' }),
]

const meta = {
  title: 'Time Off/RequestList',
  component: RequestList,
  args: {
    employeeId: 'emp-001',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof RequestList>

export default meta
type Story = StoryObj<typeof meta>

export const WithMixedStatuses: Story = {
  parameters: {
    queryData: {
      [requestsCacheKey]: { requests: mixedRequests },
    },
  },
}

export const Empty: Story = {
  parameters: {
    queryData: {
      [requestsCacheKey]: { requests: [] },
    },
  },
}
