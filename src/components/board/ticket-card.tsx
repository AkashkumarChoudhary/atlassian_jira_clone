import Link from 'next/link'
import type { BoardTicket } from '@/lib/dal/boards'
import { Avatar } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'

const priorityColor: Record<string, string> = {
  LOW: '#64748b',
  MEDIUM: '#3b82f6',
  HIGH: '#f59e0b',
  URGENT: '#ef4444',
}

export function TicketCard({
  ticket,
  slug,
}: {
  ticket: BoardTicket
  slug: string
}) {
  return (
    <Link
      href={`/boards/${slug}/${ticket.key}`}
      className="block rounded-md border border-gray-200 bg-white p-3 shadow-sm hover:border-indigo-400 dark:border-gray-700 dark:bg-gray-800 dark:hover:border-indigo-500"
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="font-mono text-xs text-gray-500 dark:text-gray-400">
          {ticket.key}
        </span>
        <Badge color={priorityColor[ticket.priority]}>{ticket.priority}</Badge>
      </div>
      <p className="text-sm text-gray-900 dark:text-gray-100">{ticket.title}</p>
      <div className="mt-2 flex items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1">
          {ticket.labels.map((label) => (
            <Badge key={label.id} color={label.color}>
              {label.name}
            </Badge>
          ))}
        </div>
        {ticket.assignee && (
          <Avatar
            name={ticket.assignee.name}
            color={ticket.assignee.avatarColor}
            size="sm"
          />
        )}
      </div>
    </Link>
  )
}
