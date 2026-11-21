import { spawn as nodeSpawn } from 'child_process'
import { dirname, join } from 'path'
import type { Readable, Writable } from 'stream'
import type { ChatLine } from '../shared/chat'
import type { Effort, RunResult } from '../shared/api'
import { readMeta, writeMeta } from './editFolder'
import { commandStatus } from './progress'
import { finishRun, refreshRules } from './agent'
import type { ExecFn } from './runtime'

export interface CodexCmd { cmd: string; pre: string[]; env: Record<string, string> }
export interface CodexStatus { cmd: CodexCmd; loggedIn: boolean }

interface Child { stdin: Writable; stdout: Readable; stderr: Readable; pid?: number; kill(): boolean; on(e: 'close', f: (code: number | null) => void): unknown; on(e: 'error', f: (err: Error) => void): unknown }
export type SpawnFn = (cmd: string, args: string[], opts: { cwd: string; env: Record<string, string | undefined>; windowsHide: boolean }) => Child

// npm installs codex as a .cmd shim, and a .cmd can only start through a shell; run its js with node instead
export async function findCodex(o: { exec: ExecFn; platform: NodeJS.Platform; exists(p: string): boolean; nodePath: string }): Promise<CodexStatus | null> {
  const where = await o.exec(o.platform === 'win32' ? 'where' : 'which', ['codex']).catch(() => null)
  if (!where || where.code !== 0) return null
  const found = where.stdout.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
  let cmd: CodexCmd | null = null
  if (o.platform !== 'win32') cmd = found[0] ? { cmd: found[0], pre: [], env: {} } : null
  else {
    const exe = found.find((l) => /\.exe$/i.test(l))
    const shim = found.find((l) => /\.cmd$/i.test(l))
    const js = shim ? join(dirname(shim), 'node_modules', '@openai', 'codex', 'bin', 'codex.js') : null
    if (exe) cmd = { cmd: exe, pre: [], env: {} }
    else if (js && o.exists(js)) cmd = { cmd: o.nodePath, pre: [js], env: { ELECTRON_RUN_AS_NODE: '1' } }
  }
  if (!cmd) return null
  const version = await o.exec(cmd.cmd, [...cmd.pre, '--version'], cmd.env).catch(() => null)
  if (!version || version.code !== 0) return null
  const login = await o.exec(cmd.cmd, [...cmd.pre, 'login', 'status'], cmd.env).catch(() => null)
  return { cmd, loggedIn: login?.code === 0 }
}

export function codexArgs(o: { editDir: string; model: string; effort: Effort | null; resume: string | null }): string[] {
  return [
    'exec', '--json', '--cd', o.editDir, '--sandbox', 'workspace-write', '--skip-git-repo-check', '--ignore-user-config',
    '-c', 'approval_policy=never', '-c', 'web_search=disabled', '-c', 'sandbox_workspace_write.network_access=false',
    ...(o.model !== 'default' ? ['-m', o.model] : []),
    ...(o.effort ? ['-c', `model_reasoning_effort=${o.effort}`] : []),
    ...(o.resume ? ['resume', o.resume] : []),
    '-'
  ]
}

function codexError(msg: unknown): string {
  const m = String(msg ?? '').trim()
  if (/401|unauthori[sz]ed|invalid api key|incorrect api key/i.test(m)) return 'Codex was refused. Check your OpenAI key in Settings, or run codex login.'
  if (/usage limit|rate limit|429|quota/i.test(m)) return 'Codex hit a usage limit. Try again later.'
  return `Codex stopped: ${m}`.slice(0, 300)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function codexLines(ev: any): ChatLine[] {
  const item = ev?.item
  switch (ev?.type) {
    case 'item.started': {
      if (item?.type === 'command_execution') {
        const s = commandStatus(String(item.command ?? ''))
        return s ? [{ kind: 'status', text: s }] : []
      }
      return item?.type === 'file_change' ? [{ kind: 'status', text: 'Changing the edit…' }] : []
    }
    case 'item.completed':
      return item?.type === 'agent_message' && item.text?.trim() ? [{ kind: 'agent', text: item.text.trim() }] : []
    case 'turn.completed':
      return [{ kind: 'done', text: 'Edit ready.' }]
    case 'turn.failed':
      return [{ kind: 'error', text: codexError(ev.error?.message) }]
    case 'error':
      return [{ kind: 'error', text: codexError(ev.message) }]
  }
  return []
}

export interface CodexRun {
  editDir: string; prompt: string; model: string; effort: Effort | null; python: string
  codex: CodexCmd; apiKey: string | null; signal: AbortSignal; onLine(l: ChatLine): void
}

export async function runCodex(run: CodexRun, spawn: SpawnFn = nodeSpawn as unknown as SpawnFn): Promise<RunResult> {
  let last: ChatLine | undefined
  const emit = (l: ChatLine): void => {
    const text = run.apiKey ? l.text.replaceAll(run.apiKey, '[key]') : l.text
    if (l.kind === 'status' && last?.kind === 'status' && last.text === text) return
    last = { ...l, text }
    run.onLine(last)
  }
  refreshRules(run.editDir, run.python)
  const env: Record<string, string | undefined> = { ...process.env, ...run.codex.env, ...(run.apiKey ? { CODEX_API_KEY: run.apiKey } : {}) }
  delete env.ANTHROPIC_API_KEY

  const attempt = (resume: string | null): Promise<{ events: number; done: boolean; failed: boolean; stderr: string; code: number }> =>
    new Promise((resolve) => {
      const child = spawn(run.codex.cmd, [...run.codex.pre, ...codexArgs({ editDir: run.editDir, model: run.model, effort: run.effort, resume })], { cwd: run.editDir, env, windowsHide: true })
      // codex runs its own child processes; on windows only a tree kill stops them
      const stop = (): void => {
        if (process.platform === 'win32' && child.pid) nodeSpawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], { windowsHide: true })
        else child.kill()
      }
      run.signal.addEventListener('abort', stop)
      let buf = '', events = 0, done = false, failed = false, stderr = ''
      child.stdout.on('data', (d: Buffer) => {
        buf += d
        for (let i = buf.indexOf('\n'); i >= 0; i = buf.indexOf('\n')) {
          const line = buf.slice(0, i).trim()
          buf = buf.slice(i + 1)
          if (!line) continue
          let ev
          try { ev = JSON.parse(line) } catch { continue }
          events++
          if (ev.type === 'thread.started' && ev.thread_id) writeMeta(run.editDir, { ...readMeta(run.editDir), codexThreadId: ev.thread_id })
          if (ev.type === 'turn.completed') done = true
          for (const l of codexLines(ev)) {
            if (l.kind === 'error') failed = true
            emit(l)
          }
        }
      })
      child.stderr.on('data', (d: Buffer) => (stderr += d))
      child.on('error', (e) => (stderr += e.message))
      child.on('close', (code) => {
        run.signal.removeEventListener('abort', stop)
        resolve({ events, done, failed, stderr, code: code ?? 1 })
      })
      child.stdin.end(run.prompt)
    })

  const saved = readMeta(run.editDir).codexThreadId ?? null
  let r = await attempt(saved)
  // a thread this computer no longer has: start fresh once
  if (saved && r.events === 0 && !run.signal.aborted) r = await attempt(null)
  if (run.signal.aborted) {
    emit({ kind: 'status', text: 'Stopped.' })
    return { ok: false, video: null }
  }
  if (!r.done) {
    if (!r.failed) {
      const why = r.stderr.trim().split(/\r?\n/).pop() || `it exited with code ${r.code}`
      emit({ kind: 'error', text: r.events ? 'Codex stopped before the edit was done.' : `Chapel couldn't start Codex: ${why}` })
    }
    return { ok: false, video: null }
  }
  return finishRun(run.editDir, emit)
}
