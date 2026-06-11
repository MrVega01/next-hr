import type { Meta, StoryObj, Decorator } from '@storybook/nextjs'
import { within, userEvent, expect } from '@storybook/test'
import React from 'react'
import { ReconciliationBanner } from './ReconciliationBanner'
import { useUiStore } from '@/features/time-off/store/uiStore'

/**
 * Reset the Zustand store before every story so state doesn't leak
 * between stories when running in the same browser tab.
 */
const withCleanStore: Decorator = (Story) => {
  // Reset toasts to empty before rendering
  useUiStore.setState({ toasts: [] })
  return <Story />
}

const meta = {
  title: 'Time Off/ReconciliationBanner',
  component: ReconciliationBanner,
  decorators: [withCleanStore],
  tags: ['autodocs'],
} satisfies Meta<typeof ReconciliationBanner>

export default meta
type Story = StoryObj<typeof meta>

export const Hidden: Story = {
  // No toasts seeded — banner renders nothing
}

export const Visible: Story = {
  decorators: [
    (Story) => {
      // Seed a reconciliation warning toast before render
      useUiStore.setState({
        toasts: [
          {
            id: 'toast-recon-001',
            type: 'warning',
            message:
              'Your vacation request (req-001) was rolled back — the HCM balance did not update as expected.',
            requestId: 'req-001',
          },
        ],
      })
      return <Story />
    },
  ],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(
      canvas.getByText('Balance Reconciliation Notice'),
    ).toBeInTheDocument()

    const dismissBtn = canvas.getByRole('button', { name: /dismiss/i })
    await expect(dismissBtn).toBeInTheDocument()
    await userEvent.click(dismissBtn)
    // After dismiss the banner should be gone
    await expect(
      canvas.queryByText('Balance Reconciliation Notice'),
    ).not.toBeInTheDocument()
  },
}
