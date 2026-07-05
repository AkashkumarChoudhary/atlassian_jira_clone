import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ThemeToggle } from '../theme-toggle'

const setTheme = jest.fn()
let resolvedTheme = 'light'

jest.mock('next-themes', () => ({
  useTheme: () => ({ resolvedTheme, setTheme }),
}))

beforeEach(() => {
  setTheme.mockClear()
})

test('switches to dark when currently light', async () => {
  resolvedTheme = 'light'
  const user = userEvent.setup()
  render(<ThemeToggle />)
  await user.click(screen.getByRole('button', { name: /toggle theme/i }))
  expect(setTheme).toHaveBeenCalledWith('dark')
})

test('switches to light when currently dark', async () => {
  resolvedTheme = 'dark'
  const user = userEvent.setup()
  render(<ThemeToggle />)
  await user.click(screen.getByRole('button', { name: /toggle theme/i }))
  expect(setTheme).toHaveBeenCalledWith('light')
})
