import { render, screen } from '@testing-library/react'
import { Sidenav } from '../sidenav'

let pathname = '/boards'
jest.mock('next/navigation', () => ({
  usePathname: () => pathname,
}))

test('marks the item matching the current path as current', () => {
  pathname = '/boards'
  render(<Sidenav />)
  expect(screen.getByRole('link', { name: /boards/i })).toHaveAttribute(
    'aria-current',
    'page',
  )
})

test('does not mark items on an unrelated path', () => {
  pathname = '/settings'
  render(<Sidenav />)
  expect(screen.getByRole('link', { name: /boards/i })).not.toHaveAttribute(
    'aria-current',
  )
})
