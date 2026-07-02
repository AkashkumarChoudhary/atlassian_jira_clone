'use client'

import { useState } from 'react'
import { createTicket } from '@/actions/tickets'
import type { TicketFormOptions } from '@/lib/dal/tickets'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { TicketForm } from './ticket-form'

export function NewTicketButton({
  boardId,
  options,
}: {
  boardId: string
  options: TicketFormOptions
}) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button onClick={() => setOpen(true)}>New ticket</Button>
      <Modal open={open} onClose={() => setOpen(false)} title="New ticket">
        <TicketForm
          action={createTicket.bind(null, boardId)}
          options={options}
          submitLabel="Create"
          onSuccess={() => setOpen(false)}
        />
      </Modal>
    </>
  )
}
