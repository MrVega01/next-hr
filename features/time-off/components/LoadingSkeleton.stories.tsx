import type { Meta, StoryObj } from '@storybook/nextjs'
import { LoadingSkeleton } from './LoadingSkeleton'

const meta = {
  title: 'Time Off/LoadingSkeleton',
  component: LoadingSkeleton,
  tags: ['autodocs'],
} satisfies Meta<typeof LoadingSkeleton>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
