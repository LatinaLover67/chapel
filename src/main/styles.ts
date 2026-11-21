import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { basename, join } from 'path'

import type { StyleInfo } from '../shared/api'
export type { StyleInfo } from '../shared/api'

export interface StyleRoot { dir: string; builtIn: boolean }

export const STYLE_NAME = /^[a-z0-9][a-z0-9_-]{0,39}$/

export function parseFrontmatter(md: string): { name?: string; description?: string } {
  const m = /^---\r?\n([\s\S]*?)\r?\n---/.exec(md)
  const out: { name?: string; description?: string } = {}
  for (const line of m ? m[1].split(/\r?\n/) : []) {
    const kv = /^(name|description):\s*(.*)$/.exec(line)
    if (kv) out[kv[1] as 'name' | 'description'] = kv[2].trim()
  }
  return out
}

const isStyle = (dir: string): boolean => existsSync(join(dir, 'SKILL.md')) && existsSync(join(dir, 'render.py'))

function read(dir: string, builtIn: boolean): StyleInfo {
  const fm = parseFrontmatter(readFileSync(join(dir, 'SKILL.md'), 'utf8'))
  return { name: basename(dir), description: fm.description ?? '', dir, builtIn }
}

export function listStyles(roots: StyleRoot[]): StyleInfo[] {
  const out = new Map<string, StyleInfo>()
  for (const r of roots) {
    if (!existsSync(r.dir)) continue
    for (const e of readdirSync(r.dir, { withFileTypes: true })) {
      const dir = join(r.dir, e.name)
      if (e.isDirectory() && isStyle(dir) && !out.has(e.name)) out.set(e.name, read(dir, r.builtIn))
    }
  }
  return [...out.values()].sort((a, b) => a.name.localeCompare(b.name))
}

export const styleName = (raw: string): string =>
  raw.toLowerCase().replace(/\.zip$/, '').replace(/[^a-z0-9_-]+/g, '-').replace(/^[-_]+|[-_]+$/g, '').slice(0, 40)

// a zip often wraps the style in one folder
function findRoot(dir: string, depth = 2): string | null {
  if (isStyle(dir)) return dir
  if (depth === 0) return null
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (!e.isDirectory() || e.name === '__MACOSX') continue
    const hit = findRoot(join(dir, e.name), depth - 1)
    if (hit) return hit
  }
  return null
}

export function addStyle(userDir: string, source: string, name: string, taken: string[]): StyleInfo {
  if (!STYLE_NAME.test(name)) throw new Error('Use lowercase letters, numbers and dashes for the name.')
  if (taken.includes(name) || existsSync(join(userDir, name))) throw new Error(`There is already a style called ${name}.`)
  const root = existsSync(source) ? findRoot(source) : null
  if (!root) throw new Error("That isn't a Chapel style. A style needs a SKILL.md and a render.py.")
  mkdirSync(userDir, { recursive: true })
  const dest = join(userDir, name)
  cpSync(root, dest, { recursive: true, filter: (p) => !['tests', '__pycache__', '.git'].includes(basename(p)) })
  const skill = join(dest, 'SKILL.md')
  const md = readFileSync(skill, 'utf8')
  writeFileSync(skill, /^---\r?\n[\s\S]*?^name:.*$/m.test(md) ? md.replace(/^name:.*$/m, `name: ${name}`) : md)
  return read(dest, false)
}

export function removeStyle(userDir: string, name: string): void {
  if (!STYLE_NAME.test(name) || !existsSync(join(userDir, name))) throw new Error('Unknown style.')
  rmSync(join(userDir, name), { recursive: true, force: true })
}
