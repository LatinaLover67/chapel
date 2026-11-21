import { resolve, sep } from 'path'

export type GateResult = { behavior: 'allow'; updatedInput: Record<string, unknown> } | { behavior: 'deny'; message: string }

const FILES = "Chapel's editor can only use files in this edit."
const ONLY_EDIT = "Chapel's editor can only change edit.json."
const ONE = 'Run one command at a time, inside this edit.'
const RULES = 'Use only the commands listed in CLAUDE.md.'
const PROGRAMS = 'Only python, ffmpeg and ffprobe can run here.'
const READ_TOOLS = ['Read', 'Glob', 'Grep']
const WRITE_TOOLS = ['Write', 'Edit', 'NotebookEdit']

const UNSAFE = /[;&|`<>'$~{}\\%\r\n]/
const PROTOCOL = /^[A-Za-z][A-Za-z0-9+.-]+:/
const RENDERER = /^\.claude\/skills\/[a-z0-9_-]+\/render\.py$/

const norm = (p: string): string => (process.platform === 'win32' ? resolve(p).toLowerCase() : resolve(p))

function tokens(cmd: string): string[] {
  return [...cmd.matchAll(/"([^"]*)"|(\S+)/g)].map((m) => m[1] ?? m[2])
}

const FFMPEG: Record<string, RegExp | null> = {
  '-v': /^[a-z]+$/, '-y': null, '-ss': /^\d+(\.\d+)?$/, '-t': /^\d+(\.\d+)?$/, '-frames:v': /^\d+$/,
  '-vf': /^scale=-?\d+:-?\d+$/, '-q:v': /^\d+$/, '-an': null
}
const FFPROBE: Record<string, RegExp | null> = {
  '-v': /^[a-z]+$/, '-show_entries': /^[a-z_=,:]+$/, '-of': /^[a-z]+(=[a-z_=:0-9]+)?$/, '-print_format': /^[a-z]+$/,
  '-select_streams': /^[av]:\d+$/, '-show_streams': null, '-show_format': null, '-count_frames': null
}

export function makeToolGate(editDir: string, python: string) {
  const under = (p: string, ...dirs: string[]): boolean => {
    const n = norm(resolve(editDir, p))
    return dirs.some((d) => {
      const base = norm(resolve(editDir, d))
      return n === base || n.startsWith(base + sep)
    })
  }
  const isSong = (p: string): boolean => /^song\.[a-z0-9]+$/i.test(p.replace(/^\.\//, ''))
  const allow = (input: Record<string, unknown>): GateResult => ({ behavior: 'allow', updatedInput: input })
  const deny = (message: string): GateResult => ({ behavior: 'deny', message })

  function checkFlags(args: string[], flags: Record<string, RegExp | null>, input: (p: string) => boolean): string[] | GateResult {
    const positional: string[] = []
    for (let i = 0; i < args.length; i++) {
      const a = args[i]
      if (a === '-i') {
        if (!input(args[++i] ?? '')) return deny(ONE)
      } else if (a in flags) {
        const test = flags[a]
        if (test && !test.test(args[++i] ?? '')) return deny(RULES)
      } else if (a.startsWith('-')) return deny(RULES)
      else positional.push(a)
    }
    return positional
  }

  function bash(cmd: string): GateResult {
    cmd = cmd.trim().replace(/\s+2>&1$/, '')
    if (UNSAFE.test(cmd)) return deny(ONE)
    const [first, ...args] = tokens(cmd)
    const isPython = !!first && norm(first) === norm(python)
    if (!isPython && first !== 'ffmpeg' && first !== 'ffprobe') return deny(PROGRAMS)
    if (args.some((t) => PROTOCOL.test(t))) return deny(ONE)

    if (isPython) {
      if (!RENDERER.test(args[0] ?? '')) return deny(RULES)
      for (const a of args.slice(1)) {
        if (['--beat', '--frames', '--fast'].includes(a) || /^\d+$/.test(a)) continue
        if (!(a === 'edit.json' || isSong(a) || under(a, 'renders'))) return deny(ONE)
      }
      return allow({ command: cmd })
    }
    if (first === 'ffmpeg') {
      const r = checkFlags(args, FFMPEG, (p) => under(p, 'clips', 'renders'))
      if (!Array.isArray(r)) return r
      if (r.length !== 1 || !under(r[0], 'renders') || !/\.(jpe?g|png)$/i.test(r[0])) return deny(ONE)
      return allow({ command: cmd })
    }
    if (first === 'ffprobe') {
      const r = checkFlags(args, FFPROBE, (p) => under(p, 'clips', 'renders'))
      if (!Array.isArray(r)) return r
      if (r.length !== 1 || !(under(r[0], 'clips', 'renders') || isSong(r[0]))) return deny(ONE)
      return allow({ command: cmd })
    }
    return deny(PROGRAMS)
  }

  return async (toolName: string, input: Record<string, unknown>): Promise<GateResult> => {
    if (toolName === 'Skill' || toolName === 'TodoWrite') return allow(input)
    const p = (input.file_path ?? input.path ?? input.notebook_path) as string | undefined
    if (READ_TOOLS.includes(toolName)) return p === undefined || under(p, '.') ? allow(input) : deny(FILES)
    if (WRITE_TOOLS.includes(toolName)) {
      if (p === undefined || !under(p, '.')) return deny(FILES)
      if (under(p, 'clips')) return deny('The clips are read-only.')
      return norm(resolve(editDir, p)) === norm(resolve(editDir, 'edit.json')) ? allow(input) : deny(ONLY_EDIT)
    }
    if (toolName === 'Bash') {
      const r = bash(String(input.command ?? ''))
      return r.behavior === 'allow' ? allow(input) : r
    }
    return deny('Not available in Chapel.')
  }
}
