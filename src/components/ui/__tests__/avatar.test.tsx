import { render, screen } from '@testing-library/react'
import { Avatar } from '../avatar'

test('shows two-letter initials for a multi-word name', () => {
  render(<Avatar name="Demo User" color="#6366f1" />)
  expect(screen.getByText('DU')).toBeInTheDocument()
})

test('shows the first two letters for a single-word name', () => {
  render(<Avatar name="Marketing" color="#ef4444" />)
  expect(screen.getByText('MA')).toBeInTheDocument()
})

test('labels the avatar with the full name for accessibility', () => {
  render(<Avatar name="Ava Patel" color="#f59e0b" />)
  expect(screen.getByLabelText('Ava Patel')).toHaveTextContent('AP')
})
