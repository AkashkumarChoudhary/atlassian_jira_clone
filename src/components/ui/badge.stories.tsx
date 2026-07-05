import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { Badge } from './badge'

const meta: Meta<typeof Badge> = { component: Badge, title: 'ui/Badge' }
export default meta
type Story = StoryObj<typeof Badge>

export const Default: Story = { args: { children: 'chore' } }
export const Colored: Story = { args: { children: 'bug', color: '#ef4444' } }
