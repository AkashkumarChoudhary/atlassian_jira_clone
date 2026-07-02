import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { Avatar } from './avatar'

const meta: Meta<typeof Avatar> = { component: Avatar, title: 'ui/Avatar' }
export default meta
type Story = StoryObj<typeof Avatar>

export const Default: Story = { args: { name: 'Demo User', color: '#6366f1' } }
export const Small: Story = {
  args: { name: 'Ava Patel', color: '#f59e0b', size: 'sm' },
}
