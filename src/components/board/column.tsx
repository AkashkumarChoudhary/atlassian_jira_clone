'use client'

import { Draggable } from '@hello-pangea/dnd'
import type { Status } from '@prisma/client'
import type { BoardTicket } from '@/lib/dal/boards'
import { StrictModeDroppable } from './strict-mode-droppable'
import { TicketCard } from './ticket-card'

const titles: Record<Status, string> = {
  TODO: 'To Do',
  IN_PROGRESS: 'In Progress',
  DONE: 'Done',
}

export function Column({
  status,
  tickets,
}: {
  status: Status
  tickets: BoardTicket[]
}) {
  return (
    <div className="flex w-72 shrink-0 flex-col rounded-lg bg-gray-100 p-3 dark:bg-gray-900/40">
      <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-300">
        {titles[status]}
        <span className="rounded-full bg-gray-200 px-2 text-xs text-gray-600 dark:bg-gray-700 dark:text-gray-400">
          {tickets.length}
        </span>
      </h2>
      <StrictModeDroppable droppableId={status}>
        {(provided) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className="flex min-h-8 flex-1 flex-col gap-2"
          >
            {tickets.map((ticket, index) => (
              <Draggable key={ticket.id} draggableId={ticket.id} index={index}>
                {(prov) => (
                  <div
                    ref={prov.innerRef}
                    {...prov.draggableProps}
                    {...prov.dragHandleProps}
                  >
                    <TicketCard ticket={ticket} />
                  </div>
                )}
              </Draggable>
            ))}
            {provided.placeholder}
          </div>
        )}
      </StrictModeDroppable>
    </div>
  )
}
