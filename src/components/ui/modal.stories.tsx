import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { useState } from 'react'
import { Modal } from './modal'

const meta: Meta<typeof Modal> = { component: Modal, title: 'ui/Modal' }
export default meta

export const Default: StoryObj<typeof Modal> = {
  render: () => {
    const [open, setOpen] = useState(false)
    return (
      <div>
        <button onClick={() => setOpen(true)}>Open modal</button>
        <Modal open={open} onClose={() => setOpen(false)} title="Ticket">
          <p className="text-sm">Modal body content.</p>
        </Modal>
      </div>
    )
  },
}
