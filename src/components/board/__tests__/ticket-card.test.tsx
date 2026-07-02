import { render, screen } from '@testing-library/react'
import type { BoardTicket } from '@/lib/dal/boards'
import { TicketCard } from '../ticket-card'

const ticket = {
  id: 't1',
  key: 'WR-3',
  title: 'Build hero section',
  priority: 'HIGH',
  labels: [{ id: 'l1', name: 'feature', color: '#22c55e' }],
  assignee: { id: 'u1', name: 'Ava Patel', avatarColor: '#f59e0b' },
} as unknown as BoardTicket

test('renders the key, title, label and assignee', () => {
  render(<TicketCard ticket={ticket} slug="website-redesign" />)
  expect(screen.getByText('WR-3')).toBeInTheDocument()
  expect(screen.getByText('Build hero section')).toBeInTheDocument()
  expect(screen.getByText('feature')).toBeInTheDocument()
  expect(screen.getByLabelText('Ava Patel')).toBeInTheDocument()
})

test('renders without an assignee', () => {
  const unassigned = { ...ticket, assignee: null } as unknown as BoardTicket
  render(<TicketCard ticket={unassigned} slug="website-redesign" />)
  expect(screen.getByText('WR-3')).toBeInTheDocument()
  expect(screen.queryByLabelText('Ava Patel')).not.toBeInTheDocument()
})
