import { test, expect, beforeEach } from 'vitest'
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, statSync, existsSync, utimesSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { createEdit, listEdits, readMeta, safeName, type NewEdit } from './editFolder'

let root: string, edits: string, src: string, style: NewEdit['style']
const WM = { chapel: true, text: '@me' }

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'chapel-edits-'))
  edits = join(root, 'My Edits')
  src = join(root, 'source files')
  mkdirSync(src)
  for (const f of ['día 1.mp4', 'b.mov', 'song.mp3', 'photo.jpg', 'notes.txt']) writeFileSync(join(src, f), `bytes of ${f}`)
  const sd = join(root, 'styles', 'clip')
  mkdirSync(join(sd, 'tests'), { recursive: true })
  mkdirSync(join(sd, 'scripts', '__pycache__'), { recursive: true })
  writeFileSync(join(sd, 'SKILL.md'), '---\nname: clip\n---\n')
  writeFileSync(join(sd, 'render.py'), '')
  writeFileSync(join(sd, 'scripts', 'clip.py'), '')
  writeFileSync(join(sd, 'tests', 'test_x.py'), '')
  style = { name: 'clip', description: '', dir: sd, builtIn: true }
})

const make = (over: Partial<NewEdit> = {}): Promise<string> =>
  createEdit(edits, { name: 'Magnus', clips: [join(src, 'día 1.mp4'), join(src, 'b.mov')], song: join(src, 'song.mp3'), style, python: 'C:/py/python.exe', watermark: WM, ...over })

test('createEdit lays out the folder and leaves the originals alone', async () => {
  const before = statSync(join(src, 'día 1.mp4')).mtimeMs
  const d = await make()
  for (const p of ['clips/día 1.mp4', 'clips/b.mov', 'song.mp3', '.claude/skills/clip/SKILL.md', '.claude/skills/clip/render.py',
    '.claude/skills/clip/scripts/clip.py', 'CLAUDE.md', 'AGENTS.md', 'renders/look', 'renders/stills', 'versions', 'chapel.json'])
    expect(existsSync(join(d, p)), p).toBe(true)
  expect(existsSync(join(d, '.claude/skills/clip/tests'))).toBe(false)
  expect(existsSync(join(d, '.claude/skills/clip/scripts/__pycache__'))).toBe(false)
  expect(readFileSync(join(src, 'día 1.mp4'), 'utf8')).toBe('bytes of día 1.mp4')
  expect(statSync(join(src, 'día 1.mp4')).mtimeMs).toBe(before)
  expect(readFileSync(join(d, 'CLAUDE.md'), 'utf8')).toContain('song.mp3')
  expect(readMeta(d)).toMatchObject({ style: 'clip', song: 'song.mp3', sessionId: null, watermark: WM })
})

test('clips with the same name get a suffix', async () => {
  mkdirSync(join(src, 'other'))
  writeFileSync(join(src, 'other', 'b.mov'), 'other b')
  const d = await make({ clips: [join(src, 'b.mov'), join(src, 'other', 'b.mov')] })
  expect(readFileSync(join(d, 'clips', 'b-2.mov'), 'utf8')).toBe('other b')
})

test('createEdit refuses bad inputs before copying anything', async () => {
  await expect(make({ clips: [join(src, 'b.mov')] })).rejects.toThrow('Add at least two video clips.')
  await expect(make({ clips: [join(src, 'b.mov'), join(src, 'photo.jpg')] })).rejects.toThrow("photo.jpg isn't a video Chapel can use.")
  await expect(make({ song: join(src, 'notes.txt') })).rejects.toThrow("notes.txt isn't a song Chapel can use.")
  expect(existsSync(edits) ? listEdits(edits) : []).toEqual([])
})

test('safeName', () => {
  mkdirSync(edits, { recursive: true })
  expect(safeName(edits, 'a/b:c?')).toBe('a b c')
  expect(safeName(edits, '  ')).toBe('Untitled edit')
  expect(safeName(edits, 'x'.repeat(80))).toHaveLength(60)
  mkdirSync(join(edits, 'Magnus'))
  expect(safeName(edits, 'Magnus')).toBe('Magnus 2')
  mkdirSync(join(edits, 'Magnus 2'))
  expect(safeName(edits, 'Magnus')).toBe('Magnus 3')
})

test('listEdits is newest first and skips folders without chapel.json', async () => {
  const a = await make({ name: 'first' })
  const b = await make({ name: 'second' })
  utimesSync(join(a, 'chapel.json'), new Date(2026, 0, 1), new Date(2026, 0, 1))
  mkdirSync(join(edits, 'stray'))
  expect(listEdits(edits).map((e) => e.name)).toEqual(['second', 'first'])
  expect(listEdits(edits)[0].dir).toBe(b)
})

test('a failed copy removes the half-made edit and says which file', async () => {
  await expect(make({ clips: [join(src, 'b.mov'), join(src, 'gone.mp4')] })).rejects.toThrow("Chapel couldn't copy gone.mp4.")
  expect(existsSync(join(edits, 'Magnus'))).toBe(false)
})
