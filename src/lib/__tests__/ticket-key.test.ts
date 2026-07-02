import { deriveBoardPrefix, formatTicketKey } from '../ticket-key'

describe('deriveBoardPrefix', () => {
  test('uses word initials for multi-word names', () => {
    expect(deriveBoardPrefix('Website Redesign')).toBe('WR')
  })

  test('uses first three letters for single-word names', () => {
    expect(deriveBoardPrefix('Marketing')).toBe('MAR')
  })

  test('uppercases lowercase input', () => {
    expect(deriveBoardPrefix('mobile app')).toBe('MA')
  })

  test('caps the prefix at five characters', () => {
    expect(deriveBoardPrefix('Big Hairy Audacious Goal Project X')).toBe(
      'BHAGP',
    )
  })

  test('ignores surrounding and repeated whitespace', () => {
    expect(deriveBoardPrefix('  Website   Redesign  ')).toBe('WR')
  })
})

describe('formatTicketKey', () => {
  test('joins prefix and number with a hyphen', () => {
    expect(formatTicketKey('WR', 12)).toBe('WR-12')
  })
})
