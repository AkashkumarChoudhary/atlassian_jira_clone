import { z } from 'zod'

export const moveTicketSchema = z.object({
  ticketId: z.string().min(1),
  toStatus: z.enum(['TODO', 'IN_PROGRESS', 'DONE']),
  toIndex: z.number().int().min(0),
})
