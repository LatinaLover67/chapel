import { AUDIO_EXT, VIDEO_EXT } from '../../shared/constants'

const ext = (f: string): string => (/\.[^./\\]+$/.exec(f)?.[0] ?? '').toLowerCase()
export const fileName = (f: string): string => f.split(/[\\/]/).pop() ?? f

export function splitFiles(files: string[]): { clips: string[]; songs: string[]; other: string[] } {
  return {
    clips: files.filter((f) => VIDEO_EXT.includes(ext(f))),
    songs: files.filter((f) => AUDIO_EXT.includes(ext(f))),
    other: files.filter((f) => !VIDEO_EXT.includes(ext(f)) && !AUDIO_EXT.includes(ext(f)))
  }
}

export function canStart(s: { hasApiKey: boolean; files: string[]; style: string | null }): string | null {
  const { clips, songs, other } = splitFiles(s.files)
  if (!s.hasApiKey) return 'Add your Anthropic API key in Settings first.'
  if (other.length) return `${fileName(other[0])} isn't a video or a song.`
  if (clips.length < 2) return 'Add at least two video clips.'
  if (songs.length === 0) return 'Add a song.'
  if (songs.length > 1) return 'Use one song per edit.'
  if (!s.style) return 'Pick a style.'
  return null
}
