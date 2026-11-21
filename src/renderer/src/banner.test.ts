import { test, expect } from 'vitest'
import { bannerRows } from './banner'

test('bannerRows fills every row and centres the word in a clear gap', () => {
  const rows = bannerRows(60, 9, 'claude', () => 0.5)
  expect(rows).toHaveLength(9)
  for (const r of rows) expect(r).toHaveLength(60)
  const mid = rows[4], at = Math.floor((60 - 6) / 2)
  expect(mid.slice(at, at + 6)).toBe('claude')
  expect(mid.slice(at - 4, at)).toBe('    ')
  expect(mid.slice(at + 6, at + 10)).toBe('    ')
  expect(rows[0].trim()).toHaveLength(60)
})
