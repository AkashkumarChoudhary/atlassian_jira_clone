'use client'

import { useState } from 'react'
import { updateTicket } from '@/actions/tickets'
import type { TicketFormOptions, TicketWithRelations } from '@/lib/dal/tickets'
import { Avatar } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { TicketForm } from './ticket-form'

export function TicketDetail({
  ticket,
  options,
}: {
  ticket: TicketWithRelations
  options: TicketFormOptions
}) {
  const [editing, setEditing] = useState(false)

  if (editing) {
    return (
      <TicketForm
        action={updateTicket.bind(null, ticket.id)}
        options={options}
        submitLabel="Save"
        onSuccess={() => setEditing(false)}
        defaultValues={{
          title: ticket.title,
          description: ticket.description ?? '',
          status: ticket.status,
          priority: ticket.priority,
          assigneeId: ticket.assigneeId ?? '',
          epicId: ticket.epicId ?? '',
          labelIds: ticket.labels.map((l) => l.id),
        }}
      />
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-xs text-gray-500 dark:text-gray-400">
          {ticket.key}
        </span>
        <Button variant="secondary" size="sm" onClick={() => setEditing(true)}>
          Edit
        </Button>
      </div>
      <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
        {ticket.title}
      </h2>
      {ticket.description && (
        <p className="text-sm whitespace-pre-wrap text-gray-600 dark:text-gray-300">
          {ticket.description}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <Badge>{ticket.status}</Badge>
        <Badge>{ticket.priority}</Badge>
        {ticket.epic && (
          <Badge color={ticket.epic.color}>{ticket.epic.name}</Badge>
        )}
        {ticket.labels.map((l) => (
          <Badge key={l.id} color={l.color}>
            {l.name}
          </Badge>
        ))}
      </div>
      <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-300">
        <span className="flex items-center gap-2">
          Assignee:
          {ticket.assignee ? (
            <>
              <Avatar
                name={ticket.assignee.name}
                color={ticket.assignee.avatarColor}
                size="sm"
              />
              {ticket.assignee.name}
            </>
          ) : (
            'Unassigned'
          )}
        </span>
        <span>Reporter: {ticket.reporter.name}</span>
      </div>
    </div>
  )
}
