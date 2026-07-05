import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { Navbar } from './navbar'

const meta: Meta<typeof Navbar> = {
  component: Navbar,
  title: 'layout/Navbar',
  parameters: { layout: 'fullscreen' },
  args: {
    user: {
      name: 'Demo User',
      email: 'demo@example.com',
      avatarColor: '#6366f1',
    },
  },
}
export default meta

export const Default: StoryObj<typeof Navbar> = {}
