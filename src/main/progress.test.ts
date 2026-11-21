import { test, expect } from 'vitest'
import { friendlyError, toChatLines } from './progress'

const assistant = (content: unknown[], extra: Record<string, unknown> = {}): unknown => ({ type: 'assistant', message: { content }, ...extra })
const bash = (command: string): unknown => ({ type: 'tool_use', name: 'Bash', input: { command } })

test('assistant text becomes trimmed agent lines', () => {
  expect(toChatLines(assistant([{ type: 'text', text: '  I found the drop.  ' }, { type: 'text', text: '  ' }])))
    .toEqual([{ kind: 'agent', text: 'I found the drop.' }])
})

test('tool calls become status lines', () => {
  const s = (m: unknown): string | undefined => toChatLines(m)[0]?.text
  expect(s(assistant([bash('"C:/py/python.exe" .claude/skills/clip/render.py edit.json renders/stills --frames 0 300')]))).toBe('Checking frames…')
  expect(s(assistant([bash('"C:/py/python.exe" .claude/skills/clip/render.py edit.json renders/final.mp4')]))).toBe('Rendering…')
  expect(s(assistant([bash('"C:/py/python.exe" .claude/skills/clip/render.py --beat song.wav')]))).toBe('Listening to the song…')
  expect(s(assistant([bash('ffprobe -v error -of json "clips/a.mp4"')]))).toBe('Looking at your clips…')
  expect(s(assistant([{ type: 'tool_use', name: 'Read', input: { file_path: 'renders/look/a.jpg' } }]))).toBe('Looking at a frame…')
  expect(toChatLines(assistant([{ type: 'tool_use', name: 'Write', input: { file_path: 'edit.json' } }]))).toEqual([])
})

test('success result is done with its cost', () => {
  expect(toChatLines({ type: 'result', subtype: 'success', result: 'Made it.', total_cost_usd: 1.234, is_error: false }))
    .toEqual([{ kind: 'done', text: 'Edit ready.', costUsd: 1.234 }])
})

test('error result lists its errors, capped at 300 characters', () => {
  expect(toChatLines({ type: 'result', subtype: 'error_max_turns', errors: ['a', 'b'] })).toEqual([{ kind: 'error', text: 'The edit stopped: a; b' }])
  expect(toChatLines({ type: 'result', subtype: 'error_during_execution', errors: ['x'.repeat(400)] })[0].text).toHaveLength(300)
})

test('assistant errors become friendly sentences', () => {
  expect(toChatLines(assistant([], { error: 'authentication_failed' }))).toEqual([{ kind: 'error', text: 'Your API key was rejected. Check it in Settings.' }])
  expect(friendlyError('billing_error')).toBe('Your Anthropic account is out of credit.')
  expect(friendlyError('rate_limit')).toBe('Anthropic is busy or rate-limiting your key. Try again in a minute.')
  expect(friendlyError('something_new')).toBe('Something went wrong talking to Claude.')
})

test('system and user messages show nothing', () => {
  expect(toChatLines({ type: 'system', subtype: 'init', session_id: 's1' })).toEqual([])
  expect(toChatLines({ type: 'user', message: { content: [] } })).toEqual([])
})

test('a success result flagged as an error shows nothing (the error line already did)', () => {
  expect(toChatLines({ type: 'result', subtype: 'success', is_error: true, result: 'Invalid API key', total_cost_usd: 0 })).toEqual([])
})
