/**
 * @jest-environment node
 */
import { encrypt, decrypt } from '../jwt'

test('encrypt then decrypt returns the original payload', async () => {
  const payload = { userId: 'user_123', expiresAt: '2030-01-01T00:00:00.000Z' }
  const token = await encrypt(payload)
  expect(await decrypt(token)).toEqual(payload)
})

test('decrypt returns null for a tampered token', async () => {
  const token = await encrypt({
    userId: 'user_123',
    expiresAt: '2030-01-01T00:00:00.000Z',
  })
  expect(await decrypt(token + 'tampered')).toBeNull()
})

test('decrypt returns null for an empty or undefined token', async () => {
  expect(await decrypt(undefined)).toBeNull()
  expect(await decrypt('')).toBeNull()
})
