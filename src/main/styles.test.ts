import { test, expect } from 'vitest'
import { existsSync, mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { addStyle, listStyles, parseFrontmatter, removeStyle, styleName } from './styles'

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
  expect(listStyles([{ dir: d, builtIn: true }])).toEqual([{ name: 'a', description: 'style a', dir: join(d, 'a'), builtIn: true }])
})

const style = (root: string, name: string, extra: Record<string, string> = {}): string => {
  const d = join(root, name)
  mkdirSync(d, { recursive: true })
  writeFileSync(join(d, 'SKILL.md'), `---
name: ${name}
description: the ${name} cut
---
recipe`)
  writeFileSync(join(d, 'render.py'), 'print(1)')
  for (const [f, body] of Object.entries(extra)) {
    mkdirSync(join(d, f, '..'), { recursive: true })
    writeFileSync(join(d, f), body)
  }
  return d
}

test('listStyles marks built-in and user styles, and a user style cannot shadow a built-in one', () => {
  const built = mkdtempSync(join(tmpdir(), 'chapel-built-')), mine = mkdtempSync(join(tmpdir(), 'chapel-mine-'))
  style(built, 'clip')
  style(mine, 'clip')
  style(mine, 'wings')
  expect(listStyles([{ dir: built, builtIn: true }, { dir: mine, builtIn: false }]).map((s) => [s.name, s.builtIn]))
    .toEqual([['clip', true], ['wings', false]])
})

test('styleName turns a file name into a style name', () => {
  expect(styleName('My Wings Style v2.zip')).toBe('my-wings-style-v2')
  expect(styleName('  __Sukuna__  ')).toBe('sukuna')
  expect(styleName('!!!')).toBe('')
})

test('addStyle copies a style folder, even one nested a level down, under the name you give it', () => {
  const src = mkdtempSync(join(tmpdir(), 'chapel-src-')), mine = mkdtempSync(join(tmpdir(), 'chapel-mine-'))
  style(join(src, 'wrapper'), 'wings', { 'tests/test_x.py': 'x', 'scripts/kit.py': 'y' })
  const s = addStyle(mine, src, 'sukuna', ['clip'])
  expect(s).toEqual({ name: 'sukuna', description: 'the wings cut', dir: join(mine, 'sukuna'), builtIn: false })
  expect(readFileSync(join(mine, 'sukuna', 'SKILL.md'), 'utf8')).toMatch(/^---\nname: sukuna\n/)
  expect(existsSync(join(mine, 'sukuna', 'scripts', 'kit.py'))).toBe(true)
  expect(existsSync(join(mine, 'sukuna', 'tests'))).toBe(false)
})

test('addStyle refuses bad names, taken names and folders that are not styles', () => {
  const src = mkdtempSync(join(tmpdir(), 'chapel-src-')), mine = mkdtempSync(join(tmpdir(), 'chapel-mine-'))
  style(src, 'wings')
  expect(() => addStyle(mine, join(src, 'wings'), 'Bad Name', [])).toThrow('Use lowercase letters, numbers and dashes for the name.')
  expect(() => addStyle(mine, join(src, 'wings'), 'clip', ['clip'])).toThrow('There is already a style called clip.')
  const empty = mkdtempSync(join(tmpdir(), 'chapel-empty-'))
  expect(() => addStyle(mine, empty, 'x', [])).toThrow("That isn't a Chapel style. A style needs a SKILL.md and a render.py.")
})

test('removeStyle deletes only a style in your own styles folder', () => {
  const mine = mkdtempSync(join(tmpdir(), 'chapel-mine-'))
  style(mine, 'wings')
  removeStyle(mine, 'wings')
  expect(existsSync(join(mine, 'wings'))).toBe(false)
  expect(() => removeStyle(mine, '../x')).toThrow('Unknown style.')
})
