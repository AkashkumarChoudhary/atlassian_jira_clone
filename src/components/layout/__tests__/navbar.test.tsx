import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Navbar } from '../navbar'

jest.mock('@/actions/auth', () => ({ logout: jest.fn() }))
jest.mock('next-themes', () => ({
  useTheme: () => ({ resolvedTheme: 'light', setTheme: jest.fn() }),
}))

const user = {
  name: 'Demo User',
  email: 'demo@example.com',
  avatarColor: '#6366f1',
}

test('renders the app name and the user avatar', () => {
  render(<Navbar user={user} />)
  expect(screen.getByText('Jira Clone')).toBeInTheDocument()
  expect(screen.getByLabelText('Demo User')).toBeInTheDocument()
})

test('reveals the user details and a logout control when the menu opens', async () => {
  const u = userEvent.setup()
  render(<Navbar user={user} />)
  await u.click(screen.getByLabelText('Demo User'))
  expect(screen.getByText('demo@example.com')).toBeInTheDocument()
  expect(screen.getByRole('menuitem', { name: /log out/i })).toBeInTheDocument()
})
