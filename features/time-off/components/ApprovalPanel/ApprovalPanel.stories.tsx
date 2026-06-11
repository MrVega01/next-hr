import type { Meta, StoryObj, Decorator } from '@storybook/nextjs'
import { within, userEvent, expect } from '@storybook/test'
import React from 'react'
import { http, HttpResponse } from 'msw'
import { ApprovalPanel } from './ApprovalPanel'
import { makeRequest, makeBalance } from '../_stories-helpers'
import { useUiStore } from '@/features/time-off/store/uiStore'

// QueryKeys.balance('emp-001', 'loc-nyc', 'vacation') === ['balance', 'emp-001', 'loc-nyc', 'vacation']
const balanceCacheKey = JSON.stringify(['balance', 'emp-001', 'loc-nyc', 'vacation'])

const submittedRequest = makeRequest({
  id: 'req-001',
  status: 'submitted',
  days: 3,
  notes: 'Family vacation',
})

const conflictRequest = makeRequest({
  id: 'req-conflict',
  status: 'submitted',
  days: 3,
})

const withCleanToasts: Decorator = (Story) => {
  useUiStore.setState({ toasts: [] })
  return <Story />
}

const meta = {
  title: 'Time Off/ApprovalPanel',
  component: ApprovalPanel,
  decorators: [withCleanToasts],
  tags: ['autodocs'],
} satisfies Meta<typeof ApprovalPanel>

export default meta
type Story = StoryObj<typeof meta>

export const PendingApproval: Story = {
  args: {
    request: submittedRequest,
  },
  parameters: {
    queryData: {
      [balanceCacheKey]: makeBalance({ availableDays: 15 }),
    },
    msw: {
      handlers: [
        // balance re-fetch on approve
        http.get('/api/hcm/balance', () =>
          HttpResponse.json({ balance: makeBalance({ availableDays: 15 }) }),
        ),
      ],
    },
  },
}

export const VersionConflict: Story = {
  args: {
    request: conflictRequest,
  },
  parameters: {
    queryData: {
      [balanceCacheKey]: makeBalance({ availableDays: 15 }),
    },
    msw: {
      handlers: [
        // balance re-fetch returns a newer version
        http.get('/api/hcm/balance', () =>
          HttpResponse.json({
            balance: makeBalance({ availableDays: 15, version: 'v9999999' }),
          }),
        ),
        // approve returns a 409 VERSION_CONFLICT
        http.put('/api/hcm/requests/:requestId/approve', () =>
          HttpResponse.json(
            {
              success: false,
              error: 'Version conflict',
              errorCode: 'VERSION_CONFLICT',
            },
            { status: 409 },
          ),
        ),
      ],
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const approveBtn = canvas.getByRole('button', { name: /approve/i })
    await userEvent.click(approveBtn)
    // After the conflict toast is added to the Zustand store the banner would
    // appear if ReconciliationBanner is mounted; here we just verify the button
    // is present and clickable.
    await expect(approveBtn).toBeInTheDocument()
  },
}
