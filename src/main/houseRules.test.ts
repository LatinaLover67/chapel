import { test, expect } from 'vitest'
import { renderHouseRules } from './houseRules'

test('house rules name the style, python and song', () => {
  const md = renderHouseRules({ style: 'clip', python: 'C:/p y/python.exe', song: 'song.wav' })
  expect(md).toContain('"C:/p y/python.exe" .claude/skills/clip/render.py edit.json renders/final.mp4')
  expect(md).toContain('Never change, move or delete anything in clips/')
  expect(md).toContain('the song song.wav')
  expect(md).not.toContain('{{')
})

test('a Windows python path is written with forward slashes (the gate refuses backslashes)', () => {
  const md = renderHouseRules({ style: 'clip', python: ['C:', 'Users', 'x', 'py', 'Scripts', 'python.exe'].join(String.fromCharCode(92)), song: 'song.wav' })
  expect(md).toContain('"C:/Users/x/py/Scripts/python.exe" .claude/skills/clip/render.py')
  expect(md).not.toContain(String.fromCharCode(92))
})
