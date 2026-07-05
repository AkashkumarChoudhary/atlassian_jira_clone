import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { Button } from './button'

const meta: Meta<typeof Button> = { component: Button, title: 'ui/Button' }
export default meta
type Story = StoryObj<typeof Button>

export const Primary: Story = { args: { children: 'Primary' } }
export const Secondary: Story = {
  args: { children: 'Secondary', variant: 'secondary' },
}
export const Ghost: Story = { args: { children: 'Ghost', variant: 'ghost' } }
export const Danger: Story = { args: { children: 'Delete', variant: 'danger' } }
export const Small: Story = { args: { children: 'Small', size: 'sm' } }
