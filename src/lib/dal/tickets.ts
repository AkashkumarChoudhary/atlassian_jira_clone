import type { Status } from '@prisma/client'
import { prisma } from '../prisma'
import { formatTicketKey } from '../ticket-key'
import type { TicketFormInput } from '../../schemas/ticket'

/**
 * Persists a ticket move: sets the ticket's status and densely reindexes the
 * destination column (and, on a cross-column move, the source column) so
 * positions stay gapless `0..n`. Returns the board slug for revalidation, or
 * null if the ticket no longer exists. All Prisma access for moves lives here.
 */
export async function moveTicketPositions(
  ticketId: string,
  toStatus: Status,
  toIndex: number,
): Promise<{ slug: string } | null> {
  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    select: {
      id: true,
      boardId: true,
      status: true,
      board: { select: { slug: true } },
    },
  })
  if (!ticket) return null
  const fromStatus = ticket.status

  await prisma.$transaction(async (tx) => {
    // Destination column without the moved ticket, in order.
    const dest = await tx.ticket.findMany({
      where: {
        boardId: ticket.boardId,
        status: toStatus,
        id: { not: ticket.id },
      },
      orderBy: { position: 'asc' },
      select: { id: true },
    })
    const destIds = dest.map((d) => d.id)
    const index = Math.max(0, Math.min(toIndex, destIds.length))
    destIds.splice(index, 0, ticket.id)

    for (let position = 0; position < destIds.length; position++) {
      await tx.ticket.update({
        where: { id: destIds[position] },
        data: { position, status: toStatus },
      })
    }

    // Cross-column move: close the gap in the source column.
    if (fromStatus !== toStatus) {
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

  return { slug: ticket.board.slug }
}

export async function getTicketByKey(slug: string, key: string) {
  return prisma.ticket.findFirst({
    where: { key, board: { slug } },
    include: {
      assignee: { select: { id: true, name: true, avatarColor: true } },
      reporter: { select: { id: true, name: true, avatarColor: true } },
      epic: true,
      labels: true,
      board: { select: { id: true, slug: true, name: true, prefix: true } },
    },
  })
}

export type TicketWithRelations = NonNullable<
  Awaited<ReturnType<typeof getTicketByKey>>
>

export async function getTicketFormOptions(slug: string) {
  const board = await prisma.board.findUnique({
    where: { slug },
    select: {
      id: true,
      epics: { select: { id: true, name: true, color: true } },
    },
  })
  if (!board) return null
  const [users, labels] = await Promise.all([
    prisma.user.findMany({
      orderBy: { name: 'asc' },
      select: { id: true, name: true, avatarColor: true },
    }),
    prisma.label.findMany({
      orderBy: { name: 'asc' },
      select: { id: true, name: true, color: true },
    }),
  ])
  return { users, epics: board.epics, labels }
}

export type TicketFormOptions = NonNullable<
  Awaited<ReturnType<typeof getTicketFormOptions>>
>

export async function createTicketRecord(
  boardId: string,
  reporterId: string,
  input: TicketFormInput,
): Promise<{ key: string; slug: string } | null> {
  try {
    return await prisma.$transaction(async (tx) => {
      const board = await tx.board.update({
        where: { id: boardId },
        data: { ticketCounter: { increment: 1 } },
        select: { prefix: true, slug: true, ticketCounter: true },
      })
      const key = formatTicketKey(board.prefix, board.ticketCounter)
      const position = await tx.ticket.count({
        where: { boardId, status: input.status },
      })
      await tx.ticket.create({
        data: {
          key,
          title: input.title,
          description: input.description,
          status: input.status,
          priority: input.priority,
          position,
          boardId,
          reporterId,
          assigneeId: input.assigneeId,
          epicId: input.epicId,
          labels: { connect: input.labelIds.map((id) => ({ id })) },
        },
      })
      return { key, slug: board.slug }
    })
  } catch {
    return null
  }
}

export async function updateTicketRecord(
  ticketId: string,
  input: TicketFormInput,
): Promise<{ slug: string } | null> {
  const current = await prisma.ticket.findUnique({
    where: { id: ticketId },
    select: { status: true, boardId: true, board: { select: { slug: true } } },
  })
  if (!current) return null

  // If the edit moves the ticket to a different column, append it there.
  const position =
    input.status !== current.status
      ? await prisma.ticket.count({
          where: { boardId: current.boardId, status: input.status },
        })
      : undefined

  await prisma.ticket.update({
    where: { id: ticketId },
    data: {
      title: input.title,
      description: input.description,
      status: input.status,
      priority: input.priority,
      ...(position !== undefined ? { position } : {}),
      assigneeId: input.assigneeId,
      epicId: input.epicId,
      labels: { set: input.labelIds.map((id) => ({ id })) },
    },
  })
  return { slug: current.board.slug }
}
