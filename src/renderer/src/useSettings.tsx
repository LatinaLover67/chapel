import { createContext, useContext } from 'react'
import type { AgentInfo, Settings } from '../../shared/api'
import { ASCII_PALETTES, codexModelLabel, modelLabel } from '../../shared/constants'

export type Patch = Partial<Omit<Settings, 'hasApiKey' | 'hasOpenAiKey' | 'editsDir'>>
export interface SettingsCtx {
  s: Settings
  agents: AgentInfo[]
  set(s: Settings): void
  update(p: Patch): Promise<void>
  refreshAgents(fresh?: boolean): Promise<void>
}

export const SettingsContext = createContext<SettingsCtx | null>(null)
export const useSettings = (): SettingsCtx => useContext(SettingsContext)!

export const modelText = (s: Settings): string => (s.agent === 'codex' ? codexModelLabel(s.codexModel) : modelLabel(s.model))

const mix = (hex: string, to: number, f: number): string =>
  '#' + [1, 3, 5].map((i) => Math.round(parseInt(hex.slice(i, i + 2), 16) * (1 - f) + to * f).toString(16).padStart(2, '0')).join('')

// day mode darkens the colours so they read on paper
export function paletteColors(id: string, mode: Settings['mode']): string[] {
  const p = ASCII_PALETTES.find((a) => a.id === id) ?? ASCII_PALETTES[0]
  if (mode === 'night') return [...p.colors]
  if (p.id === 'theme' || p.id === 'ink') return ['#141413', '#34332f', '#5c5a55', '#7f7c75']
  return p.colors.map((c) => mix(c, 0, 0.38))
}
