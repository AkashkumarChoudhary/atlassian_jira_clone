import { render, screen } from '@testing-library/react'
import { Badge } from '../badge'

test('renders its children', () => {
  render(<Badge>bug</Badge>)
  expect(screen.getByText('bug')).toBeInTheDocument()
})

test('applies a custom background color when given one', () => {
  render(<Badge color="#ef4444">urgent</Badge>)
  expect(screen.getByText('urgent')).toHaveStyle({ backgroundColor: '#ef4444' })
})
