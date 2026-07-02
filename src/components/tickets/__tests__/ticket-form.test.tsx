import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TicketForm } from '../ticket-form'

const options = {
  users: [{ id: 'u1', name: 'Ava Patel', avatarColor: '#f59e0b' }],
  epics: [{ id: 'e1', name: 'Landing page', color: '#6366f1' }],
  labels: [{ id: 'l1', name: 'bug', color: '#ef4444' }],
}

test('renders the title field and a submit button', () => {
  render(
    <TicketForm
      action={jest.fn(async () => undefined)}
      options={options}
      submitLabel="Create"
    />,
  )
  expect(screen.getByLabelText(/title/i)).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /create/i })).toBeInTheDocument()
})

test('shows a field error returned by the action', async () => {
  const user = userEvent.setup()
  const action = jest.fn(async () => ({
    fieldErrors: { title: ['Title is required.'] },
  }))
  render(<TicketForm action={action} options={options} submitLabel="Create" />)
  await user.click(screen.getByRole('button', { name: /create/i }))
  expect(await screen.findByText('Title is required.')).toBeInTheDocument()
})
