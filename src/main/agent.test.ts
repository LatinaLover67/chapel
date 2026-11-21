import { test, expect, beforeEach } from 'vitest'
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { firstPrompt, runAgent, type QueryFn, type RunArgs } from './agent'
import { readMeta, writeMeta } from './editFolder'
import type { ChatLine } from '../shared/chat'

const KEY = 'sk-ant-api03-secretsecretsecret'
let dir: string, lines: ChatLine[], seen: Record<string, unknown>

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'chapel agent '))
  mkdirSync(join(dir, 'renders'))
  mkdirSync(join(dir, 'versions'))
  writeMeta(dir, { style: 'clip', song: 'song.wav', created: '2026-11-19T00:00:00Z', sessionId: null, watermark: { chapel: true, text: null } })
  lines = []
  seen = {}
})

const args = (over: Partial<RunArgs> = {}): RunArgs => ({
  editDir: dir, prompt: 'go', apiKey: KEY, model: 'claude-opus-5-5', python: 'C:/py/python.exe', configDir: 'C:/cfg',
  signal: new AbortController().signal, onLine: (l) => lines.push(l), ...over
})

function fake(opts: { video?: boolean; text?: string } = {}): QueryFn {
  return async function* ({ options }) {
    seen = options
    yield { type: 'system', subtype: 'init', session_id: 's1' }
    yield { type: 'assistant', message: { content: [{ type: 'text', text: opts.text ?? 'Cutting on the beat.' }] } }
    writeFileSync(join(dir, 'edit.json'), '{"style":"clip"}')
    if (opts.video !== false) writeFileSync(join(dir, 'renders', 'final.mp4'), 'video')
    yield { type: 'result', subtype: 'success', result: 'Made it.', total_cost_usd: 1.23, is_error: false }
  }
}

test('firstPrompt', () => {
  expect(firstPrompt('clip', 'song.wav', '')).toBe('Make a clip edit from the clips in clips/ and the song song.wav. Follow the clip style.')
  expect(firstPrompt('clip', 'song.wav', ' warm colours ')).toBe(
    'Make a clip edit from the clips in clips/ and the song song.wav. Follow the clip style. Notes from the person: warm colours')
})

test('options keep the agent in its folder, on the user key, away from personal config', async () => {
  process.env.ANTHROPIC_AUTH_TOKEN = 'personal-token'
  await runAgent(args(), fake())
  delete process.env.ANTHROPIC_AUTH_TOKEN
  const env = seen.env as Record<string, string | undefined>
  expect(seen.cwd).toBe(dir)
  expect(env.ANTHROPIC_API_KEY).toBe(KEY)
  expect(env.CLAUDE_CONFIG_DIR).toBe('C:/cfg')
  expect(env.ANTHROPIC_AUTH_TOKEN).toBeUndefined()
  expect(seen.settingSources).toContain('project')
  expect(seen.allowedTools).not.toEqual(expect.arrayContaining(['Read']))
  for (const t of ['Read', 'Write', 'Edit', 'Bash']) expect(seen.allowedTools as string[]).not.toContain(t)
  expect(typeof seen.canUseTool).toBe('function')
  expect(seen.disallowedTools).toContain('WebSearch')
  expect(seen.model).toBe('claude-opus-5-5')
  expect('resume' in seen).toBe(false)
})

test('saves the session, snapshots versions, returns the video', async () => {
  const r = await runAgent(args(), fake())
  expect(readMeta(dir).sessionId).toBe('s1')
  expect(readFileSync(join(dir, 'versions', 'v1.json'), 'utf8')).toBe('{"style":"clip"}')
  expect(r).toEqual({ ok: true, video: join(dir, 'renders', 'final.mp4') })
  expect(lines).toContainEqual({ kind: 'done', text: 'Edit ready.', costUsd: 1.23 })
  await runAgent(args(), fake())
  expect(existsSync(join(dir, 'versions', 'v2.json'))).toBe(true)
})

test('resumes a saved session', async () => {
  writeMeta(dir, { ...readMeta(dir), sessionId: 's1' })
  await runAgent(args(), fake())
  expect(seen.resume).toBe('s1')
})

test('success without a video is an error', async () => {
  const r = await runAgent(args(), fake({ video: false }))
  expect(r).toEqual({ ok: false, video: null })
  expect(lines).toContainEqual({ kind: 'error', text: 'The editor finished without a video.' })
})

test('the key never reaches the chat', async () => {
  await runAgent(args(), fake({ text: `my key is ${KEY}` }))
  expect(JSON.stringify(lines)).not.toContain(KEY)
  expect(lines).toContainEqual({ kind: 'agent', text: 'my key is [key]' })
})

test('cancelling stops the run', async () => {
  const ac = new AbortController()
  const q: QueryFn = async function* ({ options }) {
    yield { type: 'system', subtype: 'init', session_id: 's1' }
    ac.abort()
    const sig = (options.abortController as AbortController).signal
    if (sig.aborted) throw new Error('aborted')
    yield { type: 'result', subtype: 'success', total_cost_usd: 0 }
  }
  const r = await runAgent(args({ signal: ac.signal }), q)
  expect(r).toEqual({ ok: false, video: null })
  expect(lines.at(-1)).toEqual({ kind: 'status', text: 'Stopped.' })
})

test('a start failure is reported plainly', async () => {
  const q: QueryFn = () => { throw new Error(`Native CLI binary for win32-x64 not found (${KEY})`) }
  const r = await runAgent(args(), q)
  expect(r.ok).toBe(false)
  expect(lines).toEqual([{ kind: 'error', text: "Chapel couldn't start the AI: Native CLI binary for win32-x64 not found ([key])" }])
})

test('long renders get a 10 minute command timeout; personal Claude/cloud settings are dropped', async () => {
  const saved = { ...process.env }
  Object.assign(process.env, { CLAUDE_CODE_OAUTH_TOKEN: 't', ANTHROPIC_BASE_URL: 'http://proxy', CLAUDE_CODE_USE_BEDROCK: '1', CLAUDE_CODE_USE_VERTEX: '1' })
  await runAgent(args(), fake())
  process.env = saved
  const env = seen.env as Record<string, string | undefined>
  expect(env.BASH_DEFAULT_TIMEOUT_MS).toBe('600000')
  expect(env.BASH_MAX_TIMEOUT_MS).toBe('1200000')
  for (const k of ['CLAUDE_CODE_OAUTH_TOKEN', 'ANTHROPIC_BASE_URL', 'CLAUDE_CODE_USE_BEDROCK', 'CLAUDE_CODE_USE_VERTEX']) expect(env[k], k).toBeUndefined()
})

test('an API failure reported as an errored result is one sentence, not "Edit ready"', async () => {
  writeFileSync(join(dir, 'renders', 'final.mp4'), 'older video')
  writeFileSync(join(dir, 'edit.json'), '{}')
  const q: QueryFn = async function* () {
    yield { type: 'assistant', error: 'authentication_failed', message: { content: [{ type: 'text', text: 'Invalid API key' }] } }
    yield { type: 'result', subtype: 'success', is_error: true, result: 'Invalid API key', total_cost_usd: 0 }
  }
  const r = await runAgent(args(), q)
  expect(lines).toEqual([{ kind: 'error', text: 'Your API key was rejected. Check it in Settings.' }])
  expect(r).toEqual({ ok: false, video: null })
  expect(existsSync(join(dir, 'versions', 'v1.json'))).toBe(false)
})

test('an errored result with no explanation still says something', async () => {
  const q: QueryFn = async function* () { yield { type: 'result', subtype: 'success', is_error: true, total_cost_usd: 0 } }
  await runAgent(args(), q)
  expect(lines).toEqual([{ kind: 'error', text: 'Something went wrong talking to Claude.' }])
})

test('each run rewrites the house rules with this computer\'s python', async () => {
  await runAgent(args({ python: ['D:', 'new py', 'python.exe'].join(String.fromCharCode(92)) }), fake())
  expect(readFileSync(join(dir, 'CLAUDE.md'), 'utf8')).toContain('"D:/new py/python.exe" .claude/skills/clip/render.py')
  expect(readFileSync(join(dir, 'AGENTS.md'), 'utf8')).toContain('"D:/new py/python.exe"')
})

test('a session that can no longer be resumed starts fresh', async () => {
  writeMeta(dir, { ...readMeta(dir), sessionId: 'gone' })
  const calls: Record<string, unknown>[] = []
  const normal = fake()
  const q: QueryFn = (a) => {
    calls.push(a.options)
    if (a.options.resume) throw new Error('No conversation found with session ID: gone')
    return normal(a)
  }
  const r = await runAgent(args(), q)
  expect(r.ok).toBe(true)
  expect(calls.map((o) => o.resume)).toEqual(['gone', undefined])
  expect(readMeta(dir).sessionId).toBe('s1')
})

test('passes effort, limits and no MCP servers to the SDK', async () => {
  await runAgent(args({ effort: 'high', maxTurns: 30, budgetUsd: 2 }), fake())
  expect(seen).toMatchObject({ effort: 'high', maxTurns: 30, maxBudgetUsd: 2, mcpServers: {}, strictMcpConfig: true })
})

test('leaves effort and budget to the defaults when they are off', async () => {
  await runAgent(args(), fake())
  expect(seen.maxTurns).toBe(80)
  expect('effort' in seen || 'maxBudgetUsd' in seen).toBe(false)
})
