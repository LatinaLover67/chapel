import { test, expect } from 'vitest'
import { detectAgents, envApiKey } from './agents'

const KEY = 'sk-ant-api03-abcdefghijklmnopqrstuv'

test('Claude is ready with a key saved in Chapel', () => {
  expect(detectAgents({ savedKey: true, env: {}, codex: null, openaiKey: false })[0]).toEqual({ id: 'claude', name: 'Claude', ready: true, detail: 'API key saved in Chapel' })
})

test('Claude is ready with a key in the environment', () => {
  expect(detectAgents({ savedKey: false, env: { ANTHROPIC_API_KEY: KEY }, codex: null, openaiKey: false })[0]).toMatchObject({ ready: true, detail: 'API key from ANTHROPIC_API_KEY' })
  expect(envApiKey({ ANTHROPIC_API_KEY: `  ${KEY} ` })).toBe(KEY)
})

test('Claude needs a key otherwise, and junk in the environment does not count', () => {
  expect(detectAgents({ savedKey: false, env: { ANTHROPIC_API_KEY: 'hello' }, codex: null, openaiKey: false })[0]).toMatchObject({ ready: false, detail: 'Add an Anthropic API key' })
  expect(envApiKey({})).toBeNull()
})

test('Codex shows up with how it signs in, or what it still needs', () => {
  const codex = (o: { codex: { loggedIn: boolean } | null; openaiKey: boolean }): ReturnType<typeof detectAgents>[number] => detectAgents({ savedKey: false, env: {}, ...o })[1]
  expect(codex({ codex: null, openaiKey: false })).toEqual({ id: 'codex', name: 'Codex', ready: false, detail: 'Install the Codex CLI to use it' })
  expect(codex({ codex: { loggedIn: true }, openaiKey: false })).toMatchObject({ ready: true, detail: 'Your Codex CLI login' })
  expect(codex({ codex: { loggedIn: true }, openaiKey: true })).toMatchObject({ ready: true, detail: 'OpenAI API key saved in Chapel' })
  expect(codex({ codex: { loggedIn: false }, openaiKey: false })).toMatchObject({ ready: false, detail: 'Run codex login, or add an OpenAI API key' })
})
