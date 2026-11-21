import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, renameSync, statSync, writeFileSync } from 'fs'
import { copyFile, rm } from 'fs/promises'
import { basename, extname, join } from 'path'
import { AUDIO_EXT, VIDEO_EXT } from '../shared/constants'
import { renderHouseRules } from './houseRules'
import type { Watermark } from './settings'
import type { StyleInfo } from './styles'

export interface ChapelMeta { style: string; song: string; created: string; sessionId: string | null; codexThreadId?: string | null; watermark: Watermark }
export interface NewEdit { name: string; clips: string[]; song: string; style: StyleInfo; python: string; watermark: Watermark }

export function safeName(editsDir: string, name: string): string {
  // eslint-disable-next-line no-control-regex
  let base = name.replace(/[<>:"/\\|?*\x00-\x1f]+/g, ' ').replace(/\s+/g, ' ').trim().replace(/^[. ]+|[. ]+$/g, '').slice(0, 60).trim()
  if (!base) base = 'Untitled edit'
  let out = base
  for (let n = 2; existsSync(join(editsDir, out)); n++) out = `${base} ${n}`
  return out
}

function freeName(dir: string, file: string): string {
  const ext = extname(file), stem = basename(file, ext)
  let out = file
  for (let n = 2; existsSync(join(dir, out)); n++) out = `${stem}-${n}${ext}`
  return out
}

export function readMeta(editDir: string): ChapelMeta {
  return JSON.parse(readFileSync(join(editDir, 'chapel.json'), 'utf8'))
}

export function writeMeta(editDir: string, m: ChapelMeta): void {
  const p = join(editDir, 'chapel.json')
  writeFileSync(p + '.tmp', JSON.stringify(m, null, 2))
  renameSync(p + '.tmp', p)
}

async function copy(from: string, to: string): Promise<void> {
  try {
    await copyFile(from, to)
  } catch (err) {
    const why = (err as NodeJS.ErrnoException).code === 'ENOSPC' ? ' The disk is full.' : ''
    throw new Error(`Chapel couldn't copy ${basename(from)}.${why}`, { cause: err })
  }
}

export async function createEdit(editsDir: string, e: NewEdit): Promise<string> {
  if (e.clips.length < 2) throw new Error('Add at least two video clips.')
  for (const c of e.clips)
    if (!VIDEO_EXT.includes(extname(c).toLowerCase())) throw new Error(`${basename(c)} isn't a video Chapel can use.`)
  if (!AUDIO_EXT.includes(extname(e.song).toLowerCase())) throw new Error(`${basename(e.song)} isn't a song Chapel can use.`)

  mkdirSync(editsDir, { recursive: true })
  const dir = join(editsDir, safeName(editsDir, e.name))
  for (const d of ['clips', 'renders/look', 'renders/stills', 'versions']) mkdirSync(join(dir, d), { recursive: true })
  const song = 'song' + extname(e.song).toLowerCase()
  try {
    for (const c of e.clips) await copy(c, join(dir, 'clips', freeName(join(dir, 'clips'), basename(c))))
    await copy(e.song, join(dir, song))
  } catch (err) {
    await rm(dir, { recursive: true, force: true })
    throw err
  }
  cpSync(e.style.dir, join(dir, '.claude', 'skills', e.style.name), {
    recursive: true,
    filter: (p) => !['tests', '__pycache__'].includes(basename(p))
  })
  const rules = renderHouseRules({ style: e.style.name, python: e.python, song })
  writeFileSync(join(dir, 'CLAUDE.md'), rules)
  writeFileSync(join(dir, 'AGENTS.md'), rules)
  writeMeta(dir, { style: e.style.name, song, created: new Date().toISOString(), sessionId: null, watermark: e.watermark })
  return dir
}

export function listEdits(editsDir: string): { name: string; dir: string; created: string }[] {
  if (!existsSync(editsDir)) return []
  return readdirSync(editsDir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && existsSync(join(editsDir, d.name, 'chapel.json')))
    .map((d) => {
      const dir = join(editsDir, d.name)
      return { name: d.name, dir, created: readMeta(dir).created, t: statSync(join(dir, 'chapel.json')).mtimeMs }
    })
    .sort((a, b) => b.t - a.t)
    .map(({ name, dir, created }) => ({ name, dir, created }))
}
