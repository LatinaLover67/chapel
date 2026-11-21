import { test, expect } from 'vitest'
import { mkdtempSync, mkdirSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { listStyles, parseFrontmatter } from './styles'

test('parseFrontmatter reads name and description', () => {
  expect(parseFrontmatter('---\nname: clip\ndescription: Cut on beats\n---\n# x')).toEqual({ name: 'clip', description: 'Cut on beats' })
})

test('parseFrontmatter tolerates CRLF and missing frontmatter', () => {
  expect(parseFrontmatter('---\r\nname: clip\r\n---\r\n')).toEqual({ name: 'clip' })
  expect(parseFrontmatter('# no frontmatter')).toEqual({})
})

test('listStyles keeps only folders with SKILL.md and render.py', () => {
  const d = mkdtempSync(join(tmpdir(), 'chapel-styles-'))
  for (const s of ['b', 'a']) {
    mkdirSync(join(d, s))
    writeFileSync(join(d, s, 'SKILL.md'), `---\nname: ${s}\ndescription: style ${s}\n---\n`)
  }
  writeFileSync(join(d, 'a', 'render.py'), '')
  writeFileSync(join(d, 'c.txt'), '')
  expect(listStyles(d)).toEqual([{ name: 'a', description: 'style a', dir: join(d, 'a') }])
})
