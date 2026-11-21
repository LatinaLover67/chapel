import type { ChatLine } from './chat'

export interface Watermark { chapel: boolean; text: string | null }
export interface Settings { model: string; editsDir: string; watermark: Watermark; hasApiKey: boolean }
export interface StyleInfo { name: string; description: string; dir: string }
export interface EditSummary { name: string; dir: string; created: string }
export interface RunResult { ok: boolean; video: string | null }

export interface ChapelApi {
  settings: {
    get(): Promise<Settings>
    update(p: Partial<Omit<Settings, 'hasApiKey'>>): Promise<Settings>
    setApiKey(k: string): Promise<void>
    pickEditsDir(): Promise<Settings>
  }
  styles: { list(): Promise<StyleInfo[]> }
  edits: {
    list(): Promise<EditSummary[]>
    create(e: { notes: string; clips: string[]; song: string; style: string }): Promise<{ editDir: string }>
    change(editDir: string, text: string): Promise<void>
    cancel(editDir: string): Promise<void>
    videoUrl(editDir: string): Promise<string | null>
    onLine(cb: (editDir: string, l: ChatLine) => void): () => void
    onDone(cb: (editDir: string, r: RunResult) => void): () => void
  }
  pathForFile(f: File): string
}
