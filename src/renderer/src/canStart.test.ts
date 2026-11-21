import { test, expect } from 'vitest'
import { canStart, splitFiles } from './canStart'

const OK = { hasApiKey: true, files: ['C:/a.mp4', 'C:/b.MOV', 'C:/song.mp3'], style: 'clip' }

test('splitFiles sorts by extension, ignoring case', () => {
  expect(splitFiles(['C:/a.MP4', 'C:/s.wav', 'C:/x.jpg'])).toEqual({ clips: ['C:/a.MP4'], songs: ['C:/s.wav'], other: ['C:/x.jpg'] })
})

test('canStart returns the first problem, in order', () => {
  expect(canStart({ ...OK, hasApiKey: false })).toBe('Add your Anthropic API key in Settings first.')
  expect(canStart({ ...OK, files: [...OK.files, 'C:/dir/photo.jpg'] })).toBe("photo.jpg isn't a video or a song.")
  expect(canStart({ ...OK, files: ['C:/a.mp4', 'C:/song.mp3'] })).toBe('Add at least two video clips.')
  expect(canStart({ ...OK, files: ['C:/a.mp4', 'C:/b.mp4'] })).toBe('Add a song.')
  expect(canStart({ ...OK, files: [...OK.files, 'C:/two.wav'] })).toBe('Use one song per edit.')
  expect(canStart({ ...OK, style: null })).toBe('Pick a style.')
  expect(canStart(OK)).toBeNull()
})
