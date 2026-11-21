import { writeFileSync } from 'fs'
import { join } from 'path'

export type ExecFn = (cmd: string, args: string[], env?: Record<string, string>) => Promise<{ code: number; stdout: string; stderr: string }>
export interface Runtime { python: string; ffmpeg: string }

export function pythonCandidates(platform: NodeJS.Platform): string[][] {
  return platform === 'win32' ? [['py', '-3.12'], ['python']] : [['python3'], ['python']]
}

export function venvPython(appData: string, platform: NodeJS.Platform): string {
  return platform === 'win32' ? join(appData, 'py', 'Scripts', 'python.exe') : join(appData, 'py', 'bin', 'python')
}

async function runs(exec: ExecFn, cmd: string, args: string[]): Promise<boolean> {
  try {
    return (await exec(cmd, args)).code === 0
  } catch {
    return false
  }
}

export async function ensureRuntime(o: {
  appData: string
  requirements: string
  platform: NodeJS.Platform
  exec: ExecFn
  exists: (p: string) => boolean
  touch?: (p: string) => void
}): Promise<Runtime> {
  if (!(await runs(o.exec, 'ffmpeg', ['-version'])))
    throw new Error('Chapel needs ffmpeg. Install it and make sure "ffmpeg" runs in a terminal, then restart Chapel.')
  if (o.platform === 'win32' && !(await runs(o.exec, 'git', ['--version'])))
    throw new Error('Chapel needs Git for Windows, which includes the command shell Claude uses. Install it from git-scm.com, then restart Chapel.')
  const python = venvPython(o.appData, o.platform)
  const ready = join(o.appData, 'py', 'chapel-ready')
  if (o.exists(ready)) return { python, ffmpeg: 'ffmpeg' }
  if (!o.exists(python)) {
    let base: string[] | undefined
    for (const c of pythonCandidates(o.platform)) {
      if (await runs(o.exec, c[0], [...c.slice(1), '--version'])) { base = c; break }
    }
    if (!base) throw new Error('Chapel needs Python 3.12. Install it from python.org, then restart Chapel.')
    if (!(await runs(o.exec, base[0], [...base.slice(1), '-m', 'venv', join(o.appData, 'py')])))
      throw new Error("Chapel couldn't set up Python for its video tools.")
  }
  const r = await o.exec(python, ['-m', 'pip', 'install', '-r', o.requirements])
  if (r.code !== 0) {
    const last = r.stderr.trim().split(/\r?\n/).pop() ?? ''
    throw new Error(`Chapel couldn't install its video tools: ${last}`)
  }
  ;(o.touch ?? ((p: string) => writeFileSync(p, '')))(ready)
  return { python, ffmpeg: 'ffmpeg' }
}
