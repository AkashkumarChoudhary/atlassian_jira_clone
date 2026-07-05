import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { Dropdown } from './dropdown'

const meta: Meta<typeof Dropdown> = {
  component: Dropdown,
  title: 'ui/Dropdown',
}
export default meta

export const Default: StoryObj<typeof Dropdown> = {
  args: {
    trigger: <span className="rounded border px-3 py-1 text-sm">Open</span>,
    children: (
      <button className="w-full px-3 py-2 text-left text-sm">Log out</button>
    ),
  },
}
