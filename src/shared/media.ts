import { isAbsolute, relative, resolve, sep } from 'path'

export function mediaUrl(editsDir: string, absPath: string, version?: number): string {
  const rel = relative(editsDir, absPath).split(sep).join('/')
  return `chapel-media://edit/${encodeURIComponent(rel)}${version !== undefined ? `?v=${version}` : ''}`
}

export function mediaPathFromUrl(url: string, editsDir: string): string | null {
  let u: URL
  try {
    u = new URL(url)
  } catch {
    return null
  }
  if (u.protocol !== 'chapel-media:' || u.hostname !== 'edit') return null
  const rel = decodeURIComponent(u.pathname.replace(/^\//, ''))
  if (!rel || isAbsolute(rel) || /^[A-Za-z]:/.test(rel)) return null
  const root = resolve(editsDir)
  const p = resolve(root, rel)
  return p.startsWith(root + sep) ? p : null
}
