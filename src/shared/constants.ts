export const VIDEO_EXT = ['.mp4', '.mov', '.mkv', '.webm', '.m4v']
export const AUDIO_EXT = ['.wav', '.mp3', '.m4a', '.flac', '.aac', '.ogg']

export const DEFAULT_MODEL = 'claude-opus-5-5'
export const MODEL_CHOICES = [
  { id: 'fable', label: 'Fable, newest' },
  { id: 'opus', label: 'Opus, newest' },
  { id: 'sonnet', label: 'Sonnet, newest' },
  { id: 'haiku', label: 'Haiku, newest' },
  { id: 'claude-fable-5-2', label: 'Fable 5.2' },
  { id: 'claude-opus-5-5', label: 'Opus 5.5' },
  { id: 'claude-sonnet-5-5', label: 'Sonnet 5.5' },
  { id: 'claude-haiku-5-5', label: 'Haiku 5.5' }
]
export const isModel = (m: string): boolean => /^(opus|sonnet|haiku|fable|claude-[a-z0-9][a-z0-9.-]{1,60})$/.test(m)

export const CODEX_MODEL_CHOICES = [
  { id: 'default', label: 'Default' },
  { id: 'gpt-6.2-astra', label: 'GPT-6.2 Astra' },
  { id: 'gpt-6.2-sol', label: 'GPT-6.2 Sol' },
  { id: 'gpt-6.1-sol', label: 'GPT-6.1 Sol' },
  { id: 'gpt-6.1-terra', label: 'GPT-6.1 Terra' }
]
export const isCodexModel = (m: string): boolean => /^(default|gpt-[a-z0-9][a-z0-9.-]{0,60}|o\d[a-z0-9.-]{0,30})$/.test(m)
export const codexModelLabel = (m: string): string => CODEX_MODEL_CHOICES.find((c) => c.id === m)?.label ?? m

export const EFFORTS = ['low', 'medium', 'high', 'xhigh', 'max'] as const

export const modelLabel = (m: string): string =>
  m.replace(/^claude-/, '').replace(/-(\d+)-(\d+)$/, ' $1.$2').replace(/^./, (c) => c.toUpperCase())

// digits, letters, slashes and bars, everything else
export const ASCII_PALETTES = [
  { id: 'theme', name: 'Theme', colors: ['#f2f0ea', '#d6d3ca', '#a9a69d', '#7d7a73'] },
  { id: 'ink', name: 'Ink', colors: ['#ffffff', '#ffffff', '#e6e4de', '#c9c6bd'] },
  { id: 'lagoon', name: 'Lagoon', colors: ['#5ee6d0', '#9be7ff', '#3fb8c9', '#2a8fb0'] },
  { id: 'cobalt', name: 'Cobalt', colors: ['#a9c1ff', '#7aa2ff', '#ffd166', '#4f7cff'] },
  { id: 'dusk', name: 'Dusk', colors: ['#ffb3c6', '#ff8fab', '#c77dff', '#9d4edd'] },
  { id: 'meadow', name: 'Meadow', colors: ['#c9f29b', '#9be564', '#ff9e7a', '#5cc46b'] },
  { id: 'koi', name: 'Koi', colors: ['#ffd56b', '#ff7b54', '#ffb26b', '#ff5d5d'] },
  { id: 'ember', name: 'Ember', colors: ['#f7c548', '#ff6b35', '#ff9f1c', '#e63946'] },
  { id: 'aurora', name: 'Aurora', colors: ['#7cffcb', '#74b9ff', '#a29bfe', '#55efc4'] },
  { id: 'riso', name: 'Riso', colors: ['#ff48b0', '#00b8f0', '#ffe800', '#00a95c'] },
  { id: 'phosphor', name: 'Phosphor', colors: ['#7dff63', '#39ff14', '#2bd40f', '#1fa80b'] },
  { id: 'amber', name: 'Amber CRT', colors: ['#ffd98a', '#ffb000', '#ffcc4d', '#e09600'] },
  { id: 'sakura', name: 'Sakura', colors: ['#ffd1dc', '#ffb7c5', '#ff8fab', '#f4a6b8'] },
  { id: 'brass', name: 'Brass', colors: ['#f4d58d', '#e9c46a', '#d4a373', '#b08968'] }
] as const
