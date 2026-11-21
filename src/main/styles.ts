import { existsSync, readdirSync, readFileSync } from 'fs'
import { join } from 'path'

import type { StyleInfo } from '../shared/api'
export type { StyleInfo } from '../shared/api'

export function parseFrontmatter(md: string): { name?: string; description?: string } {
  const m = /^---\r?\n([\s\S]*?)\r?\n---/.exec(md)
  const out: { name?: string; description?: string } = {}
  for (const line of m ? m[1].split(/\r?\n/) : []) {
    const kv = /^(name|description):\s*(.*)$/.exec(line)
    if (kv) out[kv[1] as 'name' | 'description'] = kv[2].trim()
  }
  return out
}

export function listStyles(stylesDir: string): StyleInfo[] {
  if (!existsSync(stylesDir)) return []
  return readdirSync(stylesDir, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => join(stylesDir, e.name))
    .filter((dir) => existsSync(join(dir, 'SKILL.md')) && existsSync(join(dir, 'render.py')))
    .map((dir) => {
      const fm = parseFrontmatter(readFileSync(join(dir, 'SKILL.md'), 'utf8'))
      return { name: fm.name ?? dir.split(/[\\/]/).pop()!, description: fm.description ?? '', dir }
    })
    .sort((a, b) => a.name.localeCompare(b.name))
}
