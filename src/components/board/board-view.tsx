'use client'

import { useOptimistic, useTransition } from 'react'
import { DragDropContext, type DropResult } from '@hello-pangea/dnd'
import { toast } from 'sonner'
import { Status } from '@prisma/client'
import type { BoardWithTickets } from '@/lib/dal/boards'
import { moveTicketInColumns, type Columns } from '@/lib/board/move'
import { moveTicket } from '@/actions/tickets'
import { Column } from './column'

const ORDER: Status[] = [Status.TODO, Status.IN_PROGRESS, Status.DONE]

export function BoardView({ board }: { board: BoardWithTickets }) {
  const [, startTransition] = useTransition()
  const [columns, setOptimistic] = useOptimistic(
    board.columns,
    (_current: Columns, next: Columns) => next,
  )

  function onDragEnd(result: DropResult) {
    const { destination, source, draggableId } = result
    if (!destination) return
    if (
      destination.droppableId === source.droppableId &&
      destination.index === source.index
    ) {
      return
    }

    const toStatus = destination.droppableId as Status
    const toIndex = destination.index
    const next = moveTicketInColumns(columns, {
      ticketId: draggableId,
      toStatus,
      toIndex,
    })

    startTransition(async () => {
      setOptimistic(next)
      const res = await moveTicket(draggableId, toStatus, toIndex)
      if (!res.ok) toast.error('Move failed — reverted')
    })
  }

  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <div className="flex flex-1 gap-4 overflow-x-auto pb-4">
        {ORDER.map((status) => (
          <Column
            key={status}
            status={status}
            tickets={columns[status]}
            slug={board.slug}
          />
        ))}
      </div>
    </DragDropContext>
  )
}
