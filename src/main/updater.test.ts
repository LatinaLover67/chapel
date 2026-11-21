import { test, expect } from 'vitest'
import { createHash } from 'crypto'
import { existsSync, mkdtempSync, readFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { downloadUpdate, fetchBuild, installArgs, isNewBuild, type FetchFn } from './updater'

const BYTES = Buffer.from('pretend this is the installer '.repeat(5000))
const INFO = { id: 'abc123-xyz', sha512: createHash('sha512').update(BYTES).digest('base64'), size: BYTES.length }

const server = (files: Record<string, Buffer | string | null>): FetchFn & { urls: string[] } => {
  const urls: string[] = []
  const fn = (async (url: string) => {
    urls.push(url)
    const body = files[url.split('/').pop()!]
    return body == null ? new Response('nope', { status: 404 }) : new Response(typeof body === 'string' ? body : new Uint8Array(body))
  }) as FetchFn & { urls: string[] }
  fn.urls = urls
  return fn
}

test('fetchBuild reads build.json from the latest release', async () => {
  const f = server({ 'build.json': JSON.stringify(INFO) })
  expect(await fetchBuild('https://x/latest/download', f)).toEqual(INFO)
  expect(f.urls).toEqual(['https://x/latest/download/build.json'])
})

test('fetchBuild ignores a missing or broken build.json', async () => {
  expect(await fetchBuild('https://x', server({}))).toBeNull()
  expect(await fetchBuild('https://x', server({ 'build.json': '{"id": 5}' }))).toBeNull()
  expect(await fetchBuild('https://x', server({ 'build.json': 'not json' }))).toBeNull()
})

test('only a different published build counts as an update, and dev builds never update', () => {
  expect(isNewBuild('old-1', INFO)).toBe(true)
  expect(isNewBuild(INFO.id, INFO)).toBe(false)
  expect(isNewBuild('dev', INFO)).toBe(false)
  expect(isNewBuild('old-1', null)).toBe(false)
})

test('downloadUpdate saves the installer once its sha512 matches', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'chapel-update-'))
  const seen: number[] = []
  const file = await downloadUpdate('https://x', INFO, dir, server({ 'Chapel-Setup.exe': BYTES }), (p) => seen.push(p))
  expect(file).toBe(join(dir, 'Chapel-Setup.exe'))
  expect(readFileSync(file).equals(BYTES)).toBe(true)
  expect(seen.at(-1)).toBe(1)
})

test('downloadUpdate throws away a damaged download', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'chapel-update-'))
  await expect(downloadUpdate('https://x', INFO, dir, server({ 'Chapel-Setup.exe': Buffer.from('tampered') }), () => {}))
    .rejects.toThrow('The update download was damaged. Chapel will try again later.')
  expect(existsSync(join(dir, 'Chapel-Setup.exe'))).toBe(false)
  expect(existsSync(join(dir, 'Chapel-Setup.exe.part'))).toBe(false)
})

test('installArgs installs silently, keeps your data, and reopens Chapel only when asked', () => {
  expect(installArgs(true)).toEqual(['/S', '--updated', '--force-run'])
  expect(installArgs(false)).toEqual(['/S', '--updated'])
})
