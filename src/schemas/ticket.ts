import { z } from 'zod'

export const moveTicketSchema = z.object({
  ticketId: z.string().min(1),
  toStatus: z.enum(['TODO', 'IN_PROGRESS', 'DONE']),
  toIndex: z.number().int().min(0),
})

export const ticketFormSchema = z.object({
  title: z.string().min(1, { error: 'Title is required.' }),
  description: z.string().optional(),
  status: z.enum(['TODO', 'IN_PROGRESS', 'DONE']),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']),
  assigneeId: z.string().nullable(),
  epicId: z.string().nullable(),
  labelIds: z.array(z.string()),
})

export type TicketFormInput = z.infer<typeof ticketFormSchema>
