import { copyFileSync, existsSync, readdirSync, writeFileSync } from 'fs'
import { join } from 'path'
import { query as sdkQuery } from '@anthropic-ai/claude-agent-sdk'
import type { ChatLine } from '../shared/chat'
import { readMeta, writeMeta } from './editFolder'
import { renderHouseRules } from './houseRules'
import { toChatLines } from './progress'
import { makeToolGate } from './toolGate'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type QueryFn = (args: { prompt: string; options: Record<string, unknown> }) => AsyncIterable<any>
export interface RunArgs {
  editDir: string; prompt: string; apiKey: string; model: string; python: string; configDir: string
  signal: AbortSignal; onLine(l: ChatLine): void; claudePath?: string
}

export function firstPrompt(style: string, song: string, notes: string): string {
  const base = `Make a ${style} edit from the clips in clips/ and the song ${song}. Follow the ${style} style.`
  return notes.trim() ? `${base} Notes from the person: ${notes.trim()}` : base
}

function snapshot(editDir: string): void {
  const n = readdirSync(join(editDir, 'versions')).filter((f) => /^v\d+\.json$/.test(f)).length
  copyFileSync(join(editDir, 'edit.json'), join(editDir, 'versions', `v${n + 1}.json`))
}

export async function runAgent(run: RunArgs, query: QueryFn = sdkQuery as unknown as QueryFn): Promise<{ ok: boolean; video: string | null }> {
  let last: ChatLine | undefined
  const emit = (l: ChatLine): void => {
    const text = run.apiKey ? l.text.replaceAll(run.apiKey, '[key]') : l.text
    if (l.kind === 'status' && last?.kind === 'status' && last.text === text) return
    last = { ...l, text }
    run.onLine(last)
  }

  const env: Record<string, string | undefined> = {
    ...process.env,
    ANTHROPIC_API_KEY: run.apiKey,
    CLAUDE_CONFIG_DIR: run.configDir,
    BASH_DEFAULT_TIMEOUT_MS: '600000', // full renders take minutes
    BASH_MAX_TIMEOUT_MS: '1200000'
  }
  // don't pick up the user's own claude login
  for (const k of ['ANTHROPIC_AUTH_TOKEN', 'CLAUDE_CODE_OAUTH_TOKEN', 'ANTHROPIC_BASE_URL', 'CLAUDE_CODE_USE_BEDROCK', 'CLAUDE_CODE_USE_VERTEX']) delete env[k]
  const abortController = new AbortController()
  const onAbort = (): void => abortController.abort()
  run.signal.addEventListener('abort', onAbort)
  const meta = readMeta(run.editDir)
  const rules = renderHouseRules({ style: meta.style, python: run.python, song: meta.song })
  writeFileSync(join(run.editDir, 'CLAUDE.md'), rules)
  writeFileSync(join(run.editDir, 'AGENTS.md'), rules)
  const options: Record<string, unknown> = {
    cwd: run.editDir,
    model: run.model,
    env,
    settingSources: ['project'],
    skills: 'all',
    allowedTools: ['Skill', 'TodoWrite'], // these skip canUseTool, so never put bash or file tools here
    disallowedTools: ['WebSearch', 'WebFetch', 'Task', 'PowerShell'],
    canUseTool: makeToolGate(run.editDir, run.python),
    permissionMode: 'default',
    maxTurns: 80,
    ...(run.claudePath ? { pathToClaudeCodeExecutable: run.claudePath } : {}),
    abortController
  }

  let started = false, success = false, errored = false
  const attempt = async (resume: string | null): Promise<void> => {
    for await (const msg of query({ prompt: run.prompt, options: resume ? { ...options, resume } : options })) {
      started = true
      if (msg?.type === 'system' && msg.subtype === 'init' && msg.session_id) writeMeta(run.editDir, { ...readMeta(run.editDir), sessionId: msg.session_id })
      if (msg?.type === 'result' && msg.subtype === 'success' && !msg.is_error) success = true
      if (msg?.type === 'result' && msg.is_error && !errored) {
        errored = true
        if (last?.kind !== 'error') emit({ kind: 'error', text: 'Something went wrong talking to Claude.' })
      }
      for (const l of toChatLines(msg)) {
        if (l.kind === 'error') errored = true
        emit(l)
      }
    }
  }
  try {
    try {
      await attempt(meta.sessionId)
    } catch (e) {
      if (!meta.sessionId || started || run.signal.aborted) throw e
      await attempt(null)
    }
  } catch (e) {
    if (run.signal.aborted) {
      emit({ kind: 'status', text: 'Stopped.' })
      return { ok: false, video: null }
    }
    const m = e instanceof Error ? e.message : String(e)
    emit({ kind: 'error', text: started ? `The edit stopped: ${m}` : `Chapel couldn't start the AI: ${m}` })
    return { ok: false, video: null }
  } finally {
    run.signal.removeEventListener('abort', onAbort)
  }
  if (run.signal.aborted) {
    emit({ kind: 'status', text: 'Stopped.' })
    return { ok: false, video: null }
  }
  if (!success) return { ok: false, video: null }
  const video = join(run.editDir, 'renders', 'final.mp4')
  if (!existsSync(video)) {
    emit({ kind: 'error', text: 'The editor finished without a video.' })
    return { ok: false, video: null }
  }
  if (existsSync(join(run.editDir, 'edit.json'))) snapshot(run.editDir)
  return { ok: true, video }
}
