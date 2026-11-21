import type { ChatLine } from '../shared/chat'

export function friendlyError(code: string): string {
  switch (code) {
    case 'authentication_failed': return 'Your API key was rejected. Check it in Settings.'
    case 'billing_error': return 'Your Anthropic account is out of credit.'
    case 'rate_limit':
    case 'overloaded': return 'Anthropic is busy or rate-limiting your key. Try again in a minute.'
    default: return 'Something went wrong talking to Claude.'
  }
}

function status(block: { name?: string; input?: Record<string, unknown> }): string | null {
  if (block.name === 'Read' && /\.(jpe?g|png)$/i.test(String(block.input?.file_path ?? ''))) return 'Looking at a frame…'
  if (block.name !== 'Bash') return null
  const cmd = String(block.input?.command ?? '')
  if (cmd.includes('--beat')) return 'Listening to the song…'
  if (cmd.includes('render.py') && cmd.includes('--frames')) return 'Checking frames…'
  if (cmd.includes('render.py')) return 'Rendering…'
  if (/^\s*ffprobe\b/.test(cmd)) return 'Looking at your clips…'
  return null
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function toChatLines(msg: any): ChatLine[] {
  if (msg?.type === 'assistant') {
    if (msg.error) return [{ kind: 'error', text: friendlyError(String(msg.error)) }]
    const out: ChatLine[] = []
    for (const b of msg.message?.content ?? []) {
      if (b.type === 'text' && b.text?.trim()) out.push({ kind: 'agent', text: b.text.trim() })
      if (b.type === 'tool_use') {
        const s = status(b)
        if (s) out.push({ kind: 'status', text: s })
      }
    }
    return out
  }
  if (msg?.type === 'result') {
    if (msg.subtype === 'success' && msg.is_error) return []
    if (msg.subtype === 'success') return [{ kind: 'done', text: 'Edit ready.', costUsd: msg.total_cost_usd }]
    return [{ kind: 'error', text: `The edit stopped: ${(msg.errors ?? []).join('; ')}`.slice(0, 300) }]
  }
  return []
}
