import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'fs'
import { join } from 'path'
import { MODELS } from '../shared/constants'

import type { Settings } from '../shared/api'
export type { Settings, Watermark } from '../shared/api'
export interface KeyVault { available(): boolean; encrypt(s: string): Buffer; decrypt(b: Buffer): string }
export interface SettingsStore {
  get(): Settings
  update(patch: Partial<Omit<Settings, 'hasApiKey'>>): Settings
  setApiKey(key: string): void
  getApiKey(): string | null
  clearApiKey(): void
}

type Stored = Omit<Settings, 'hasApiKey'>

export function sanitizePatch(p: unknown): Partial<Pick<Settings, 'model' | 'watermark'>> {
  const o = (p && typeof p === 'object' ? p : {}) as Record<string, unknown>
  const out: Partial<Pick<Settings, 'model' | 'watermark'>> = {}
  if (typeof o.model === 'string') out.model = o.model
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
  const defaults: Stored = { model: MODELS[0], editsDir: defaultEditsDir, watermark: { chapel: true, text: null } }
  const read = (): Stored => (existsSync(file) ? { ...defaults, ...JSON.parse(readFileSync(file, 'utf8')) } : defaults)

  return {
    get: () => ({ ...read(), hasApiKey: existsSync(keyFile) }),
    update(patch) {
      if (patch.model !== undefined && !(MODELS as readonly string[]).includes(patch.model)) throw new Error('Unknown model.')
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
    clearApiKey: () => rmSync(keyFile, { force: true })
  }
}
