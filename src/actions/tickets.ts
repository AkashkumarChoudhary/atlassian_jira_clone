'use server'

import { revalidatePath } from 'next/cache'
import type { Status } from '@prisma/client'
import { verifySession } from '@/lib/dal/auth'
import { moveTicketPositions } from '@/lib/dal/tickets'
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

  try {
    const result = await moveTicketPositions(
      parsed.data.ticketId,
      parsed.data.toStatus,
      parsed.data.toIndex,
    )
    if (!result) return { ok: false, error: 'Ticket not found.' }
    revalidatePath(`/boards/${result.slug}`)
    return { ok: true }
  } catch {
    return { ok: false, error: 'Could not move the ticket.' }
  }
}
