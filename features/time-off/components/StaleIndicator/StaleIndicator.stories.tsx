import type { Meta, StoryObj } from '@storybook/nextjs'
import { StaleIndicator } from './StaleIndicator'

const meta = {
  title: 'Time Off/StaleIndicator',
  component: StaleIndicator,
  tags: ['autodocs'],
} satisfies Meta<typeof StaleIndicator>

export default meta
type Story = StoryObj<typeof meta>

const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString()
const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString()

export const Fresh: Story = {
  args: {
    asOf: fiveMinAgo,
    isFetching: false,
  },
}

export const Stale: Story = {
  args: {
    asOf: tenMinAgo,
    isFetching: false,
  },
}

export const Fetching: Story = {
  args: {
    asOf: tenMinAgo,
    isFetching: true,
  },
}
