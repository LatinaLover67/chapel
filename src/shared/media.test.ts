import { test, expect } from 'vitest'
import { join } from 'path'
import { mediaPathFromUrl, mediaUrl } from './media'

const E = join('C:', 'Users', 'x', 'Documents', 'My Edits')

test('round-trips a path with spaces and accents', () => {
  const p = join(E, 'día 1', 'renders', 'final.mp4')
  expect(mediaPathFromUrl(mediaUrl(E, p), E)).toBe(p)
})

test('refuses paths that leave the edits folder', () => {
  expect(mediaPathFromUrl('chapel-media://edit/..%2F..%2FWindows%2Fwin.ini', E)).toBeNull()
  expect(mediaPathFromUrl('chapel-media://edit/C%3A%2FWindows%2Fwin.ini', E)).toBeNull()
  expect(mediaPathFromUrl('https://example.com/x.mp4', E)).toBeNull()
})

test('adds a version so the player reloads', () => {
  expect(mediaUrl(E, join(E, 'a', 'renders', 'final.mp4'), 3)).toMatch(/\?v=3$/)
  expect(mediaPathFromUrl(mediaUrl(E, join(E, 'a', 'final.mp4'), 3), E)).toBe(join(E, 'a', 'final.mp4'))
})
