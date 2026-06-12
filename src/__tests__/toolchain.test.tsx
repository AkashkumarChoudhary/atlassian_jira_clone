import { render, screen } from '@testing-library/react'

function Hello() {
  return <h1>Hello Jira</h1>
}

test('jest, jsdom, RTL and jest-dom are wired up', () => {
  render(<Hello />)
  expect(
    screen.getByRole('heading', { name: 'Hello Jira' }),
  ).toBeInTheDocument()
})
