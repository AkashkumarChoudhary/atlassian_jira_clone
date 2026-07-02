import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { ThemeToggle } from './theme-toggle'

const meta: Meta<typeof ThemeToggle> = {
  component: ThemeToggle,
  title: 'ui/ThemeToggle',
}
export default meta

export const Default: StoryObj<typeof ThemeToggle> = {}
