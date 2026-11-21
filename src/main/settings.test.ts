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
  expect(store.get()).toEqual({ model: 'claude-opus-5-5', editsDir: EDITS, watermark: { chapel: true, text: null }, hasApiKey: false })
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

test('update rejects unknown models', () => {
  expect(() => store.update({ model: 'gpt-5' })).toThrow('Unknown model.')
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
