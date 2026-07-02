import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Dropdown } from '../dropdown'

function setup() {
  return render(
    <div>
      <Dropdown trigger={<span>Menu</span>}>
        <button role="menuitem">Log out</button>
      </Dropdown>
      <button>outside</button>
    </div>,
  )
}

test('opens on trigger click and closes on Escape', async () => {
  const user = userEvent.setup()
  setup()
  expect(screen.queryByRole('menu')).not.toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: 'Menu' }))
  expect(screen.getByRole('menu')).toBeInTheDocument()

  await user.keyboard('{Escape}')
  expect(screen.queryByRole('menu')).not.toBeInTheDocument()
})

test('closes when clicking outside', async () => {
  const user = userEvent.setup()
  setup()
  await user.click(screen.getByRole('button', { name: 'Menu' }))
  expect(screen.getByRole('menu')).toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: 'outside' }))
  expect(screen.queryByRole('menu')).not.toBeInTheDocument()
})
