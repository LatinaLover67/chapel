import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'fs'
import { join } from 'path'
import { ASCII_PALETTES, DEFAULT_MODEL, EFFORTS, isCodexModel, isModel } from '../shared/constants'

import type { Settings } from '../shared/api'
export type { Settings, Watermark } from '../shared/api'
export interface KeyVault { available(): boolean; encrypt(s: string): Buffer; decrypt(b: Buffer): string }
export interface SettingsStore {
  get(): Settings
  update(patch: Partial<Omit<Settings, 'hasApiKey' | 'hasOpenAiKey'>>): Settings
  setApiKey(key: string): void
  getApiKey(): string | null
  clearApiKey(): void
  setOpenAiKey(key: string): void
  getOpenAiKey(): string | null
  clearOpenAiKey(): void
}

type Stored = Omit<Settings, 'hasApiKey' | 'hasOpenAiKey'>

type Patch = Partial<Omit<Settings, 'hasApiKey' | 'hasOpenAiKey' | 'editsDir'>>

const num = (v: unknown, min: number, max: number, round: (n: number) => number): number | null | undefined =>
  v === null ? null : typeof v === 'number' && v >= min && v <= max ? round(v) : undefined

export function sanitizePatch(p: unknown): Patch {
  const o = (p && typeof p === 'object' ? p : {}) as Record<string, unknown>
  const out: Patch = {}
  if (typeof o.model === 'string') out.model = o.model
  if (typeof o.codexModel === 'string') out.codexModel = o.codexModel
  if (o.effort === null || EFFORTS.includes(o.effort as never)) out.effort = o.effort as Patch['effort']
  if (o.agent === 'claude' || o.agent === 'codex') out.agent = o.agent
  if (ASCII_PALETTES.some((a) => a.id === o.ascii)) out.ascii = o.ascii as string
  if (o.mode === 'night' || o.mode === 'day') out.mode = o.mode
  if (o.look === 'soft' || o.look === 'square') out.look = o.look
  if (typeof o.notify === 'boolean') out.notify = o.notify
  const turns = num(o.maxTurns, 1, 500, Math.round), budget = num(o.budgetUsd, 0.1, 1000, (n) => Math.round(n * 100) / 100)
  if (turns !== undefined) out.maxTurns = turns
  if (budget !== undefined) out.budgetUsd = budget
  if (o.watermark && typeof o.watermark === 'object') {
    const w = o.watermark as Record<string, unknown>
    out.watermark = { chapel: typeof w.chapel === 'boolean' ? w.chapel : true, text: typeof w.text === 'string' && w.text ? w.text.slice(0, 40) : null }
  }
  return out
}

function writeAtomic(path: string, data: string | Buffer): void {
  writeFileSync(path + '.tmp', data)
  renameSync(path + '.tmp', path)
}

export function createSettingsStore(dir: string, defaultEditsDir: string, vault: KeyVault): SettingsStore {
  mkdirSync(dir, { recursive: true })
  const file = join(dir, 'settings.json')
  const keyFile = join(dir, 'key.bin')
  const openaiFile = join(dir, 'openai.bin')
  const defaults: Stored = {
    model: DEFAULT_MODEL, codexModel: 'default', effort: null, agent: 'claude', editsDir: defaultEditsDir, watermark: { chapel: true, text: null },
    ascii: 'theme', mode: 'night', look: 'soft', notify: true, maxTurns: 80, budgetUsd: null
  }
  const read = (): Stored => (existsSync(file) ? { ...defaults, ...JSON.parse(readFileSync(file, 'utf8')) } : defaults)

  return {
    get: () => ({ ...read(), hasApiKey: existsSync(keyFile), hasOpenAiKey: existsSync(openaiFile) }),
    update(patch) {
      if (patch.model !== undefined && !isModel(patch.model)) throw new Error('Unknown model.')
      if (patch.codexModel !== undefined && !isCodexModel(patch.codexModel)) throw new Error('Unknown model.')
      writeAtomic(file, JSON.stringify({ ...read(), ...patch }, null, 2))
      return this.get()
    },
    setApiKey(key) {
      const k = key.trim()
      if (!k.startsWith('sk-ant-') || k.length < 20) throw new Error("That doesn't look like an Anthropic API key.")
      if (!vault.available()) throw new Error("Chapel can't store your key securely on this computer.")
      writeAtomic(keyFile, vault.encrypt(k))
    },
    getApiKey: () => (existsSync(keyFile) ? vault.decrypt(readFileSync(keyFile)) : null),
    clearApiKey: () => rmSync(keyFile, { force: true }),
    setOpenAiKey(key) {
      const k = key.trim()
      if (!k.startsWith('sk-') || k.startsWith('sk-ant-') || k.length < 20) throw new Error("That doesn't look like an OpenAI API key.")
      if (!vault.available()) throw new Error("Chapel can't store your key securely on this computer.")
      writeAtomic(openaiFile, vault.encrypt(k))
    },
    getOpenAiKey: () => (existsSync(openaiFile) ? vault.decrypt(readFileSync(openaiFile)) : null),
    clearOpenAiKey: () => rmSync(openaiFile, { force: true })
  }
}
