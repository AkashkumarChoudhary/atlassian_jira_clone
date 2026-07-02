'use server'

import { revalidatePath } from 'next/cache'
import type { Status } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { verifySession } from '@/lib/dal/auth'
import { moveTicketSchema } from '@/schemas/ticket'

export type MoveResult = { ok: true } | { ok: false; error: string }

export async function moveTicket(
  ticketId: string,
  toStatus: Status,
  toIndex: number,
): Promise<MoveResult> {
  await verifySession()

  const parsed = moveTicketSchema.safeParse({ ticketId, toStatus, toIndex })
  if (!parsed.success) return { ok: false, error: 'Invalid move.' }
  const toStatusVal: Status = parsed.data.toStatus

  try {
    const ticket = await prisma.ticket.findUnique({
      where: { id: parsed.data.ticketId },
      select: {
        id: true,
        boardId: true,
        status: true,
        board: { select: { slug: true } },
      },
    })
    if (!ticket) return { ok: false, error: 'Ticket not found.' }
    const fromStatus = ticket.status

    await prisma.$transaction(async (tx) => {
      // Destination column without the moved ticket, in order.
      const dest = await tx.ticket.findMany({
        where: {
          boardId: ticket.boardId,
          status: toStatusVal,
          id: { not: ticket.id },
        },
        orderBy: { position: 'asc' },
        select: { id: true },
      })
      const destIds = dest.map((d) => d.id)
      const index = Math.max(0, Math.min(parsed.data.toIndex, destIds.length))
      destIds.splice(index, 0, ticket.id)

      for (let position = 0; position < destIds.length; position++) {
        await tx.ticket.update({
          where: { id: destIds[position] },
          data: { position, status: toStatusVal },
        })
      }

      // Cross-column move: close the gap in the source column.
      if (fromStatus !== toStatusVal) {
        const source = await tx.ticket.findMany({
          where: { boardId: ticket.boardId, status: fromStatus },
          orderBy: { position: 'asc' },
          select: { id: true },
        })
        for (let position = 0; position < source.length; position++) {
          await tx.ticket.update({
            where: { id: source[position].id },
            data: { position },
          })
        }
      }
    })

    revalidatePath(`/boards/${ticket.board.slug}`)
    return { ok: true }
  } catch {
    return { ok: false, error: 'Could not move the ticket.' }
  }
}
