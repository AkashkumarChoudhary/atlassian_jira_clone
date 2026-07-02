import { loginSchema } from '../auth'

test('accepts valid credentials', () => {
  const result = loginSchema.safeParse({
    email: 'demo@example.com',
    password: 'demo1234',
  })
  expect(result.success).toBe(true)
})

test('rejects an invalid email with the expected message', () => {
  const result = loginSchema.safeParse({
    email: 'not-an-email',
    password: 'demo1234',
  })
  expect(result.success).toBe(false)
  if (!result.success) {
    expect(result.error.flatten().fieldErrors.email).toContain(
      'Enter a valid email.',
    )
  }
})

test('rejects an empty password with the expected message', () => {
  const result = loginSchema.safeParse({
    email: 'demo@example.com',
    password: '',
  })
  expect(result.success).toBe(false)
  if (!result.success) {
    expect(result.error.flatten().fieldErrors.password).toContain(
      'Password is required.',
    )
  }
})
