import { test, expect, beforeEach } from 'vitest'
import { EventEmitter } from 'events'
import { PassThrough } from 'stream'
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { codexArgs, codexLines, findCodex, runCodex, type SpawnFn } from './codex'
import { readMeta, writeMeta } from './editFolder'
import type { ExecFn } from './runtime'
import type { ChatLine } from '../shared/chat'

const ok = { code: 0, stdout: '', stderr: '' }

test('findCodex prefers codex.exe on PATH', async () => {
  const exec: ExecFn = async (cmd) => (cmd === 'where' ? { ...ok, stdout: 'C:\\npm\\codex\r\nC:\\tools\\codex.exe\r\n' } : ok)
  expect(await findCodex({ exec, platform: 'win32', exists: () => false, nodePath: 'C:/chapel.exe' }))
    .toEqual({ cmd: { cmd: 'C:\\tools\\codex.exe', pre: [], env: {} }, loggedIn: true })
})

test('findCodex runs the npm install through node instead of the .cmd shim, so no shell sees the prompt', async () => {
  const calls: string[][] = []
  const exec: ExecFn = async (cmd, args) => {
    calls.push([cmd, ...args])
    if (cmd === 'where') return { ...ok, stdout: 'C:\\npm\\codex\r\nC:\\npm\\codex.cmd\r\n' }
    return args.includes('status') ? { ...ok, code: 1 } : ok
  }
  const js = join('C:\\npm', 'node_modules', '@openai', 'codex', 'bin', 'codex.js')
  const found = await findCodex({ exec, platform: 'win32', exists: (p) => p === js, nodePath: 'C:/chapel.exe' })
  expect(found).toEqual({ cmd: { cmd: 'C:/chapel.exe', pre: [js], env: { ELECTRON_RUN_AS_NODE: '1' } }, loggedIn: false })
  expect(calls[1]).toEqual(['C:/chapel.exe', js, '--version'])
})

test('findCodex returns null when codex is not installed or does not run', async () => {
  expect(await findCodex({ exec: async () => ({ ...ok, code: 1 }), platform: 'win32', exists: () => true, nodePath: 'x' })).toBeNull()
  const broken: ExecFn = async (cmd) => (cmd === 'where' ? { ...ok, stdout: 'C:\\t\\codex.exe' } : { ...ok, code: 1 })
  expect(await findCodex({ exec: broken, platform: 'win32', exists: () => true, nodePath: 'x' })).toBeNull()
})

test('codexArgs locks Codex into the edit folder, offline, with no user config or MCP, prompt on stdin', () => {
  expect(codexArgs({ editDir: 'C:/e/a', model: 'default', effort: null, resume: null })).toEqual([
    'exec', '--json', '--cd', 'C:/e/a', '--sandbox', 'workspace-write', '--skip-git-repo-check', '--ignore-user-config',
    '-c', 'approval_policy=never', '-c', 'web_search=disabled', '-c', 'sandbox_workspace_write.network_access=false', '-'
  ])
  const a = codexArgs({ editDir: 'C:/e/a', model: 'gpt-6.2-sol', effort: 'high', resume: 'th-1' })
  expect(a.slice(-7)).toEqual(['-m', 'gpt-6.2-sol', '-c', 'model_reasoning_effort=high', 'resume', 'th-1', '-'])
})

test('codexLines turns Codex events into chat lines', () => {
  expect(codexLines({ type: 'item.started', item: { type: 'command_execution', command: 'powershell -Command "C:/py/python.exe .claude/skills/clip/render.py --beat song.wav"' } }))
    .toEqual([{ kind: 'status', text: 'Listening to the song…' }])
  expect(codexLines({ type: 'item.started', item: { type: 'command_execution', command: 'bash -lc "ffprobe -v error clips/a.mp4"' } }))
    .toEqual([{ kind: 'status', text: 'Looking at your clips…' }])
  expect(codexLines({ type: 'item.completed', item: { type: 'agent_message', text: ' Cut on the beat. ' } })).toEqual([{ kind: 'agent', text: 'Cut on the beat.' }])
  expect(codexLines({ type: 'item.completed', item: { type: 'reasoning', text: 'hmm' } })).toEqual([])
  expect(codexLines({ type: 'turn.completed', usage: {} })).toEqual([{ kind: 'done', text: 'Edit ready.' }])
  expect(codexLines({ type: 'turn.failed', error: { message: '401 Unauthorized' } })[0].text).toBe('Codex was refused. Check your OpenAI key in Settings, or run codex login.')
  expect(codexLines({ type: 'error', message: 'You hit your usage limit' })[0].text).toBe('Codex hit a usage limit. Try again later.')
  expect(codexLines({ type: 'error', message: 'boom' })[0].text).toBe('Codex stopped: boom')
})

let dir: string, lines: ChatLine[]
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'chapel codex '))
  mkdirSync(join(dir, 'renders'))
  mkdirSync(join(dir, 'versions'))
  writeMeta(dir, { style: 'clip', song: 'song.wav', created: '2026-11-20T00:00:00Z', sessionId: null, watermark: { chapel: true, text: null } })
  lines = []
})

interface Call { args: string[]; env: Record<string, string | undefined>; stdin: string }

function fakeSpawn(events: object[], opts: { code?: number; video?: boolean } = {}): SpawnFn & { calls: Call[] } {
  const calls: Call[] = []
  const fn = ((_cmd: string, args: string[], o: { env: Record<string, string | undefined> }) => {
    const child = Object.assign(new EventEmitter(), { stdin: new PassThrough(), stdout: new PassThrough(), stderr: new PassThrough(), pid: undefined, kill: () => true })
    const call: Call = { args, env: o.env, stdin: '' }
    calls.push(call)
    child.stdin.on('data', (d) => (call.stdin += d))
    setTimeout(() => {
      if (opts.video !== false) {
        writeFileSync(join(dir, 'edit.json'), '{}')
        writeFileSync(join(dir, 'renders', 'final.mp4'), 'v')
      }
      for (const e of events) child.stdout.write(JSON.stringify(e) + '\n')
      child.stdout.end()
      setTimeout(() => child.emit('close', opts.code ?? 0), 5)
    }, 5)
    return child
  }) as unknown as SpawnFn & { calls: Call[] }
  fn.calls = calls
  return fn
}

const run = (over = {}): Parameters<typeof runCodex>[0] => ({
  editDir: dir, prompt: 'make it', model: 'default', effort: null, python: 'C:/py/python.exe',
  codex: { cmd: 'codex.exe', pre: [], env: {} }, apiKey: null, signal: new AbortController().signal, onLine: (l: ChatLine) => lines.push(l), ...over
})

test('runCodex streams the run, saves the thread and snapshots the edit', async () => {
  const spawn = fakeSpawn([{ type: 'thread.started', thread_id: 'th-9' }, { type: 'item.completed', item: { type: 'agent_message', text: 'Done.' } }, { type: 'turn.completed' }])
  const r = await runCodex(run({ apiKey: 'sk-proj-abc', prompt: 'cut it' }), spawn)
  expect(r).toEqual({ ok: true, video: join(dir, 'renders', 'final.mp4') })
  expect(lines.map((l) => l.kind)).toEqual(['agent', 'done'])
  expect(readMeta(dir).codexThreadId).toBe('th-9')
  expect(spawn.calls[0].stdin).toBe('cut it')
  expect(spawn.calls[0].env.CODEX_API_KEY).toBe('sk-proj-abc')
  expect(spawn.calls[0].env.ANTHROPIC_API_KEY).toBeUndefined()
  expect(readFileSync(join(dir, 'AGENTS.md'), 'utf8')).toContain('C:/py/python.exe')
  expect(existsSync(join(dir, 'versions', 'v1.json'))).toBe(true)
})

test('runCodex resumes the saved thread and starts fresh once if Codex no longer has it', async () => {
  writeMeta(dir, { ...readMeta(dir), codexThreadId: 'gone' })
  let n = 0
  const good = fakeSpawn([{ type: 'thread.started', thread_id: 'th-2' }, { type: 'turn.completed' }])
  const bad = fakeSpawn([], { code: 1, video: false })
  const spawn = ((...a: Parameters<SpawnFn>) => (n++ === 0 ? bad : good)(...a)) as SpawnFn
  const r = await runCodex(run(), spawn)
  expect(r.ok).toBe(true)
  expect(bad.calls[0].args).toContain('resume')
  expect(good.calls[0].args).not.toContain('resume')
})

test('runCodex reports a run that ends without finishing', async () => {
  const r = await runCodex(run(), fakeSpawn([{ type: 'thread.started', thread_id: 't' }], { code: 1, video: false }))
  expect(r.ok).toBe(false)
  expect(lines.at(-1)).toEqual({ kind: 'error', text: 'Codex stopped before the edit was done.' })
})
