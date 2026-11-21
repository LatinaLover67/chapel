import type { ChatLine } from './chat'

export interface Watermark { chapel: boolean; text: string | null }
export type Effort = 'low' | 'medium' | 'high' | 'xhigh' | 'max'
export interface Settings {
  model: string
  codexModel: string
  effort: Effort | null
  agent: string
  editsDir: string
  watermark: Watermark
  ascii: string
  mode: 'night' | 'day'
  look: 'soft' | 'square'
  notify: boolean
  autoUpdate: boolean
  maxTurns: number | null
  budgetUsd: number | null
  hasApiKey: boolean
  hasOpenAiKey: boolean
}
export interface AgentInfo { id: string; name: string; ready: boolean; detail: string }
export interface StyleInfo { name: string; description: string; dir: string; builtIn: boolean }
export interface EditSummary { name: string; dir: string; created: string }
export interface EditInfo { style: string; song: string; clips: number; versions: number }
export interface AppInfo { version: string; build: string; dataDir: string }
export interface UpdateState { kind: 'idle' | 'checking' | 'none' | 'available' | 'downloading' | 'ready' | 'error'; progress?: number; detail?: string }
export interface RunResult { ok: boolean; video: string | null }

export interface ChapelApi {
  settings: {
    get(): Promise<Settings>
    update(p: Partial<Omit<Settings, 'hasApiKey' | 'hasOpenAiKey'>>): Promise<Settings>
    setApiKey(k: string): Promise<void>
    clearApiKey(): Promise<void>
    setOpenAiKey(k: string): Promise<void>
    clearOpenAiKey(): Promise<void>
    pickEditsDir(): Promise<Settings>
  }
  agents: { detect(fresh?: boolean): Promise<AgentInfo[]> }
  styles: {
    list(): Promise<StyleInfo[]>
    pick(kind: 'zip' | 'folder'): Promise<string | null>
    add(source: string, name: string): Promise<StyleInfo[]>
    remove(name: string): Promise<StyleInfo[]>
  }
  app: { info(): Promise<AppInfo>; open(what: 'data' | 'edits' | 'styles' | string): Promise<void> }
  update: {
    get(): Promise<UpdateState>
    check(): Promise<void>
    download(): Promise<void>
    install(): Promise<void>
    onState(cb: (u: UpdateState) => void): () => void
  }
  edits: {
    list(): Promise<EditSummary[]>
    create(e: { notes: string; clips: string[]; song: string; style: string }): Promise<{ editDir: string }>
    change(editDir: string, text: string): Promise<void>
    cancel(editDir: string): Promise<void>
    videoUrl(editDir: string): Promise<string | null>
    info(editDir: string): Promise<EditInfo>
    onLine(cb: (editDir: string, l: ChatLine) => void): () => void
    onDone(cb: (editDir: string, r: RunResult) => void): () => void
  }
  pathForFile(f: File): string
}
