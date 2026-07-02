import { ticketFormSchema } from '../ticket'

const valid = {
  title: 'Build the thing',
  description: 'details',
  status: 'TODO',
  priority: 'HIGH',
  assigneeId: null,
  epicId: null,
  labelIds: [],
}

test('accepts a valid ticket', () => {
  expect(ticketFormSchema.safeParse(valid).success).toBe(true)
})

test('rejects an empty title', () => {
  const result = ticketFormSchema.safeParse({ ...valid, title: '' })
  expect(result.success).toBe(false)
  if (!result.success) {
    expect(result.error.flatten().fieldErrors.title).toContain(
      'Title is required.',
    )
  }
})

test('accepts a null assignee and epic and a list of label ids', () => {
  const result = ticketFormSchema.safeParse({
    ...valid,
    assigneeId: 'u1',
    epicId: null,
    labelIds: ['l1', 'l2'],
  })
  expect(result.success).toBe(true)
  if (result.success) {
    expect(result.data.labelIds).toEqual(['l1', 'l2'])
  }
})
