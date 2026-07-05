import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { LoginForm } from '../login-form'

jest.mock('@/actions/auth', () => ({
  login: jest.fn(async () => ({ error: 'Invalid email or password.' })),
}))

test('renders email and password fields and a submit button', () => {
  render(<LoginForm />)
  expect(screen.getByLabelText(/email/i)).toBeInTheDocument()
  expect(screen.getByLabelText(/password/i)).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument()
})

test('shows the error returned by the login action after submit', async () => {
  const user = userEvent.setup()
  render(<LoginForm />)

  await user.type(screen.getByLabelText(/email/i), 'demo@example.com')
  await user.type(screen.getByLabelText(/password/i), 'wrong-password')
  await user.click(screen.getByRole('button', { name: /sign in/i }))

  expect(
    await screen.findByText('Invalid email or password.'),
  ).toBeInTheDocument()
})
