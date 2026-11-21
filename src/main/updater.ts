import { createHash } from 'crypto'
import { createWriteStream, mkdirSync, renameSync, rmSync } from 'fs'
import { join } from 'path'
import { Readable, Transform } from 'stream'
import { pipeline } from 'stream/promises'

// updates go by build id, not version: every published build gets a new id and replaces the installer on the release
export const RELEASE_URL = 'https://github.com/LatinaLover67/chapel/releases/latest/download'

export interface BuildInfo { id: string; sha512: string; size: number }
export type FetchFn = (url: string) => Promise<Response>

export async function fetchBuild(base: string, fetchFn: FetchFn): Promise<BuildInfo | null> {
  const r = await fetchFn(`${base}/build.json`)
  if (!r.ok) return null
  try {
    const j = await r.json()
    return typeof j?.id === 'string' && typeof j.sha512 === 'string' && typeof j.size === 'number' ? { id: j.id, sha512: j.sha512, size: j.size } : null
  } catch {
    return null
  }
}

export const isNewBuild = (current: string, info: BuildInfo | null): boolean => current !== 'dev' && !!info && info.id !== current

export async function downloadUpdate(base: string, info: BuildInfo, dir: string, fetchFn: FetchFn, onProgress: (p: number) => void): Promise<string> {
  mkdirSync(dir, { recursive: true })
  const part = join(dir, 'Chapel-Setup.exe.part'), out = join(dir, 'Chapel-Setup.exe')
  const r = await fetchFn(`${base}/Chapel-Setup.exe`)
  if (!r.ok || !r.body) throw new Error("Chapel couldn't download the update.")
  const hash = createHash('sha512')
  let got = 0
  const count = new Transform({
    transform(chunk: Buffer, _enc, cb) {
      hash.update(chunk)
      got += chunk.length
      onProgress(Math.min(1, got / info.size))
      cb(null, chunk)
    }
  })
  try {
    await pipeline(Readable.fromWeb(r.body as never), count, createWriteStream(part))
  } catch (e) {
    rmSync(part, { force: true })
    throw e
  }
  if (hash.digest('base64') !== info.sha512) {
    rmSync(part, { force: true })
    throw new Error('The update download was damaged. Chapel will try again later.')
  }
  renameSync(part, out)
  return out
}

export const installArgs = (reopen: boolean): string[] => ['/S', '--updated', ...(reopen ? ['--force-run'] : [])]
