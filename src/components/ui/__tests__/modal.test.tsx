import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { Modal } from '../modal'

function Harness() {
  const [open, setOpen] = useState(false)
  return (
    <div>
      <button onClick={() => setOpen(true)}>open</button>
      <Modal open={open} onClose={() => setOpen(false)} title="Details">
        <p>Body content</p>
      </Modal>
    </div>
  )
}

test('opens the dialog when open becomes true', async () => {
  const user = userEvent.setup()
  render(<Harness />)
  expect(screen.getByRole('dialog', { hidden: true })).not.toHaveAttribute(
    'open',
  )
  await user.click(screen.getByRole('button', { name: 'open' }))
  expect(screen.getByRole('dialog')).toHaveAttribute('open')
  expect(screen.getByText('Body content')).toBeInTheDocument()
})

test('calls onClose when the dialog emits close (Escape)', async () => {
  const onClose = jest.fn()
  render(
    <Modal open onClose={onClose} title="Details">
      <p>Body</p>
    </Modal>,
  )
  screen.getByRole('dialog').dispatchEvent(new Event('close'))
  expect(onClose).toHaveBeenCalled()
})
