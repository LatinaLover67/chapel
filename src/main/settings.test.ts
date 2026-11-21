import { test, expect, beforeEach } from 'vitest'
import { mkdtempSync, readdirSync, readFileSync, existsSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { createSettingsStore, sanitizePatch, type KeyVault, type SettingsStore } from './settings'

const EDITS = 'C:/Users/x/Documents/Chapel'
const KEY = 'sk-ant-api03-abcdefghijklmnop'
let dir: string
let vault: KeyVault & { ok: boolean }
let store: SettingsStore

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'chapel-settings-'))
  vault = {
    ok: true,
    available() { return this.ok },
    encrypt: (s) => Buffer.from([...s].reverse().join(''), 'utf8'),
    decrypt: (b) => [...b.toString('utf8')].reverse().join('')
  }
  store = createSettingsStore(dir, EDITS, vault)
})

test('defaults', () => {
  expect(store.get()).toEqual({
    model: 'claude-opus-5-5', codexModel: 'default', effort: null, agent: 'claude', editsDir: EDITS, watermark: { chapel: true, text: null },
    ascii: 'theme', mode: 'night', look: 'soft', notify: true, autoUpdate: true, maxTurns: 80, budgetUsd: null, hasApiKey: false, hasOpenAiKey: false
  })
})

test('key round-trips and is never stored in plain text', () => {
  store.setApiKey(`  ${KEY}  `)
  expect(store.getApiKey()).toBe(KEY)
  expect(store.get().hasApiKey).toBe(true)
  for (const f of readdirSync(dir)) expect(readFileSync(join(dir, f), 'utf8')).not.toContain(KEY)
})

test('rejects a non-Anthropic key', () => {
  expect(() => store.setApiKey('hello')).toThrow("That doesn't look like an Anthropic API key.")
})

test('refuses to store when encryption is unavailable', () => {
  vault.ok = false
  expect(() => store.setApiKey(KEY)).toThrow("Chapel can't store your key securely on this computer.")
})

test('update rejects unknown models but takes aliases and claude ids', () => {
  expect(() => store.update({ model: 'gpt-5' })).toThrow('Unknown model.')
  expect(store.update({ model: 'fable' }).model).toBe('fable')
  expect(store.update({ model: 'claude-haiku-5-5' }).model).toBe('claude-haiku-5-5')
})

test('update persists across stores', () => {
  store.update({ model: 'claude-sonnet-5-5', watermark: { chapel: false, text: '@me' } })
  const again = createSettingsStore(dir, EDITS, vault)
  expect(again.get()).toMatchObject({ model: 'claude-sonnet-5-5', watermark: { chapel: false, text: '@me' } })
})

test('clearApiKey removes key.bin', () => {
  store.setApiKey(KEY)
  store.clearApiKey()
  expect(store.getApiKey()).toBeNull()
  expect(existsSync(join(dir, 'key.bin'))).toBe(false)
})

test('sanitizePatch keeps only model and a well-formed watermark (the screens cannot move the edits folder)', () => {
  expect(sanitizePatch({ editsDir: 'C:/', model: 'claude-sonnet-5-5', extra: 1 })).toEqual({ model: 'claude-sonnet-5-5' })
  expect(sanitizePatch({ watermark: { chapel: false, text: '@me', x: 1 } })).toEqual({ watermark: { chapel: false, text: '@me' } })
  expect(sanitizePatch({ watermark: { chapel: 'yes', text: 5 } })).toEqual({ watermark: { chapel: true, text: null } })
  expect(sanitizePatch(null)).toEqual({})
})

test('sanitizePatch keeps the appearance, effort and limit settings only when they are valid', () => {
  expect(sanitizePatch({ effort: 'high', ascii: 'lagoon', mode: 'day', look: 'square', notify: false, agent: 'claude' }))
    .toEqual({ effort: 'high', ascii: 'lagoon', mode: 'day', look: 'square', notify: false, agent: 'claude' })
  expect(sanitizePatch({ effort: 'turbo', ascii: 'neon', mode: 'dusk', look: 'round', notify: 'yes', agent: 'gpt' })).toEqual({})
  expect(sanitizePatch({ effort: null, maxTurns: null, budgetUsd: null })).toEqual({ effort: null, maxTurns: null, budgetUsd: null })
  expect(sanitizePatch({ maxTurns: 40.7, budgetUsd: 2.5 })).toEqual({ maxTurns: 41, budgetUsd: 2.5 })
  expect(sanitizePatch({ maxTurns: 0, budgetUsd: -1 })).toEqual({})
  expect(sanitizePatch({ maxTurns: 100000, budgetUsd: 1e9 })).toEqual({})
})

test('the OpenAI key is stored encrypted and separately from the Anthropic key', () => {
  const OPENAI = 'sk-proj-abcdefghijklmnopqrstu'
  store.setOpenAiKey(OPENAI)
  expect(store.getOpenAiKey()).toBe(OPENAI)
  expect(store.getApiKey()).toBeNull()
  expect(store.get().hasOpenAiKey).toBe(true)
  for (const f of readdirSync(dir)) expect(readFileSync(join(dir, f), 'utf8')).not.toContain(OPENAI)
  expect(() => store.setOpenAiKey('sk-ant-api03-abcdefghijklmnop')).toThrow("That doesn't look like an OpenAI API key.")
  store.clearOpenAiKey()
  expect(store.getOpenAiKey()).toBeNull()
})

test('codex can be picked, with its own model', () => {
  expect(sanitizePatch({ agent: 'codex', codexModel: 'gpt-6.2-sol' })).toEqual({ agent: 'codex', codexModel: 'gpt-6.2-sol' })
  expect(sanitizePatch({ codexModel: 'default' })).toEqual({ codexModel: 'default' })
  expect(() => store.update({ codexModel: 'claude-opus-5-5' })).toThrow('Unknown model.')
})

test('auto update can be switched off', () => {
  expect(sanitizePatch({ autoUpdate: false })).toEqual({ autoUpdate: false })
  expect(sanitizePatch({ autoUpdate: 'no' })).toEqual({})
})
