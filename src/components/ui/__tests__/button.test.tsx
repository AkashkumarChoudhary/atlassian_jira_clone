import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Button } from '../button'

test('renders its children as a button', () => {
  render(<Button>Save</Button>)
  expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument()
})

test('fires onClick when enabled and not when disabled', async () => {
  const onClick = jest.fn()
  const user = userEvent.setup()
  const { rerender } = render(<Button onClick={onClick}>Go</Button>)
  await user.click(screen.getByRole('button', { name: 'Go' }))
  expect(onClick).toHaveBeenCalledTimes(1)

  rerender(
    <Button onClick={onClick} disabled>
      Go
    </Button>,
  )
  await user.click(screen.getByRole('button', { name: 'Go' }))
  expect(onClick).toHaveBeenCalledTimes(1)
})
