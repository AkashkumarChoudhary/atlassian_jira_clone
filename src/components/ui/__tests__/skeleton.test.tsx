import { render } from '@testing-library/react'
import { Skeleton } from '../skeleton'

test('renders a pulsing placeholder element', () => {
  const { container } = render(<Skeleton className="h-4 w-10" />)
  const el = container.firstChild as HTMLElement
  expect(el).toHaveClass('animate-pulse')
  expect(el).toHaveClass('h-4')
})
