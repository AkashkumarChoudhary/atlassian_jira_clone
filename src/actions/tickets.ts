'use server'

import { revalidatePath } from 'next/cache'
import type { Status } from '@prisma/client'
import { verifySession } from '@/lib/dal/auth'
import {
  createTicketRecord,
  moveTicketPositions,
  updateTicketRecord,
} from '@/lib/dal/tickets'
import { moveTicketSchema, ticketFormSchema } from '@/schemas/ticket'

export type MoveResult = { ok: true } | { ok: false; error: string }

export type TicketFormState =
  | { ok?: boolean; error?: string; fieldErrors?: Record<string, string[]> }
  | undefined

function parseTicketForm(formData: FormData) {
  return ticketFormSchema.safeParse({
    title: formData.get('title'),
    description: formData.get('description') || undefined,
    status: formData.get('status'),
    priority: formData.get('priority'),
    assigneeId: formData.get('assigneeId') || null,
    epicId: formData.get('epicId') || null,
    labelIds: formData.getAll('labelIds'),
  })
}

export async function createTicket(
  boardId: string,
  _prev: TicketFormState,
  formData: FormData,
): Promise<TicketFormState> {
  const session = await verifySession()
  const parsed = parseTicketForm(formData)
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors }
  }
  try {
    const result = await createTicketRecord(
      boardId,
      session.userId,
      parsed.data,
    )
    if (!result) return { error: 'Could not create the ticket.' }
    revalidatePath(`/boards/${result.slug}`)
    return { ok: true }
  } catch {
    return { error: 'Could not create the ticket.' }
  }
}

export async function updateTicket(
  ticketId: string,
  _prev: TicketFormState,
  formData: FormData,
): Promise<TicketFormState> {
  await verifySession()
  const parsed = parseTicketForm(formData)
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors }
  }
  try {
    const result = await updateTicketRecord(ticketId, parsed.data)
    if (!result) return { error: 'Ticket not found.' }
    revalidatePath(`/boards/${result.slug}`)
    return { ok: true }
  } catch {
    return { error: 'Could not save the ticket.' }
  }
}

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
