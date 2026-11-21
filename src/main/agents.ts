import type { AgentInfo } from '../shared/api'

export const envApiKey = (env: Record<string, string | undefined>): string | null => {
  const k = (env.ANTHROPIC_API_KEY ?? '').trim()
  return k.startsWith('sk-ant-') && k.length >= 20 ? k : null
}

// claude runs on an api key only; a claude.ai login isn't allowed in third party apps
export function detectAgents(o: { savedKey: boolean; env: Record<string, string | undefined>; codex: { loggedIn: boolean } | null; openaiKey: boolean }): AgentInfo[] {
  const fromEnv = !!envApiKey(o.env)
  const claude: AgentInfo = {
    id: 'claude',
    name: 'Claude',
    ready: o.savedKey || fromEnv,
    detail: o.savedKey ? 'API key saved in Chapel' : fromEnv ? 'API key from ANTHROPIC_API_KEY' : 'Add an Anthropic API key'
  }
  // codex can use the person's own codex cli login (openai allows that for open source apps) or an api key
  const codex: AgentInfo = !o.codex
    ? { id: 'codex', name: 'Codex', ready: false, detail: 'Install the Codex CLI to use it' }
    : o.openaiKey ? { id: 'codex', name: 'Codex', ready: true, detail: 'OpenAI API key saved in Chapel' }
      : o.codex.loggedIn ? { id: 'codex', name: 'Codex', ready: true, detail: 'Your Codex CLI login' }
        : { id: 'codex', name: 'Codex', ready: false, detail: 'Run codex login, or add an OpenAI API key' }
  return [claude, codex]
}
