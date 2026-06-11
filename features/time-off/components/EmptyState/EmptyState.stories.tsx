import type { Meta, StoryObj } from '@storybook/nextjs'
import { EmptyState } from './EmptyState'

const meta = {
  title: 'Time Off/EmptyState',
  component: EmptyState,
  tags: ['autodocs'],
} satisfies Meta<typeof EmptyState>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const WithCustomMessage: Story = {
  args: {
    message: 'No time-off requests found. Submit your first request above.',
  },
}
