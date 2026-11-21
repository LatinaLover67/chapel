export const MODELS = ['claude-opus-5-5', 'claude-sonnet-5-5'] as const

export const VIDEO_EXT = ['.mp4', '.mov', '.mkv', '.webm', '.m4v']
export const AUDIO_EXT = ['.wav', '.mp3', '.m4a', '.flac', '.aac', '.ogg']

export const modelLabel = (m: string): string =>
  m.replace(/^claude-/, '').replace(/-(\d+)-(\d+)$/, ' $1.$2').replace(/^./, (c) => c.toUpperCase())
