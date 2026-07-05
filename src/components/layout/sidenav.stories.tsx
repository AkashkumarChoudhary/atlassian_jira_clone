import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { Sidenav } from './sidenav'

const meta: Meta<typeof Sidenav> = {
  component: Sidenav,
  title: 'layout/Sidenav',
  parameters: { layout: 'fullscreen', nextjs: { appDirectory: true } },
}
export default meta

export const Default: StoryObj<typeof Sidenav> = {}
