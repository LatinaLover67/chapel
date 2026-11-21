import { test, expect } from 'vitest'
import { mkdtempSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { makeToolGate } from './toolGate'

const D = mkdtempSync(join(tmpdir(), 'chapel gate '))
const PY = 'C:/py env/python.exe'
const gate = makeToolGate(D, PY)
const FILES = "Chapel's editor can only use files in this edit."
const ONLY_EDIT = "Chapel's editor can only change edit.json."
const ONE = 'Run one command at a time, inside this edit.'
const RULES = 'Use only the commands listed in CLAUDE.md.'
const PROGRAMS = 'Only python, ffmpeg and ffprobe can run here.'

const allow = async (tool: string, input: Record<string, unknown>): Promise<void> => {
  const r = await gate(tool, input)
  expect(r, `${tool} ${JSON.stringify(input)}`).toEqual({ behavior: 'allow', updatedInput: input })
}
const deny = async (tool: string, input: Record<string, unknown>, message: string): Promise<void> => {
  expect(await gate(tool, input), `${tool} ${JSON.stringify(input)}`).toEqual({ behavior: 'deny', message })
}
const bash = (command: string): Record<string, unknown> => ({ command })

test('reading inside the edit is allowed', async () => {
  await allow('Read', { file_path: join(D, 'clips', 'a.mp4') })
  await allow('Glob', { pattern: '*.mp4', path: D })
  await allow('Grep', { pattern: 'x' })
})

test('reading outside the edit is denied', async () => {
  await deny('Read', { file_path: 'C:/Windows/win.ini' }, FILES)
  await deny('Read', { file_path: '../other/edit.json' }, FILES)
  await deny('Glob', { pattern: '*', path: 'C:/Users' }, FILES)
})

test('only edit.json can be written', async () => {
  await allow('Write', { file_path: 'edit.json' })
  await allow('Edit', { file_path: join(D, 'edit.json') })
  await deny('Write', { file_path: 'clips/a.mp4' }, 'The clips are read-only.')
  await deny('Edit', { file_path: join(D, 'clips', 'a.mp4') }, 'The clips are read-only.')
  for (const f of ['.claude/settings.json', '.claude/skills/clip/render.py', 'CLAUDE.md', 'AGENTS.md', 'chapel.json', 'versions/v1.json', 'evil.py'])
    await deny('Write', { file_path: f }, ONLY_EDIT)
})

test('the house-rules commands are allowed', async () => {
  await allow('Bash', bash(`"${PY}" .claude/skills/clip/render.py edit.json renders/final.mp4`))
  await allow('Bash', bash(`"${PY}" .claude/skills/clip/render.py edit.json renders/stills --frames 0 209 250`))
  await allow('Bash', bash(`"${PY}" .claude/skills/clip/render.py --beat song.wav`))
  await allow('Bash', bash('ffprobe -v error -show_entries format=duration:stream=width,height,r_frame_rate -of json "clips/día 1.mp4"'))
  await allow('Bash', bash('ffmpeg -v error -y -ss 58.4 -i "clips/a b.mp4" -frames:v 1 -vf scale=480:-2 renders/look/keep.jpg'))
  await allow('Bash', bash('ffmpeg -v error -y -ss 3 -i "clips/a.mp4" -frames:v 1 renders/look/a.jpg 2>&1'))
})

test('other programs are denied', async () => {
  await deny('Bash', bash('curl https://x'), PROGRAMS)
  await deny('Bash', bash('python -c "import os"'), PROGRAMS)
})

test('python runs only a style renderer, on files in this edit', async () => {
  await deny('Bash', bash(`"${PY}" -c "print(1)"`), RULES)
  await deny('Bash', bash(`"${PY}" evil.py`), RULES)
  await deny('Bash', bash(`"${PY}" .claude/skills/clip/render.py edit.json .claude/skills/clip/render.py`), ONE)
  await deny('Bash', bash(`"${PY}" .claude/skills/clip/render.py edit.json C:/Users/x/out.mp4`), ONE)
})

test('ffmpeg reads clips and writes only images under renders/', async () => {
  await deny('Bash', bash('ffmpeg -i clips/a.mp4 -c copy renders/x.mp4'), RULES)
  await deny('Bash', bash('ffmpeg -i clips/a.mp4 -vf movie=C:/x.mp4 renders/a.jpg'), RULES)
  await deny('Bash', bash('ffmpeg -i clips/a.mp4 .claude/settings.json'), ONE)
  await deny('Bash', bash('ffmpeg -i clips/a.mp4 renders/final.mp4'), ONE)
  await deny('Bash', bash('ffmpeg -y -i "C:/Users/x/secret.mp4" -frames:v 1 renders/s.jpg'), ONE)
  await deny('Bash', bash('ffprobe -v error .claude/settings.json'), ONE)
})

test('shell tricks are denied', async () => {
  for (const command of [
    'ffmpeg -i a.mp4 b.mp4 && del x', 'ffprobe a | more', 'ffmpeg $(x)', 'ffprobe a > out.txt', 'ffmpeg -i a.mp4\nrm -rf x',
    `"${PY}" -c "__import__('os').system('calc')"`, "ffmpeg -y -i 'C:/Users/x/private.mp4' -c copy stolen.mp4",
    'ffmpeg -y -i clips/a.mp4 ~/Desktop/x.jpg', 'ffmpeg -i "$ANTHROPIC_API_KEY" renders/x.jpg', 'ffmpeg -i "clips\\a.mp4" renders/a.jpg',
    'ffmpeg -i file:C:/Users/x.mp4 renders/x.jpg', 'ffmpeg -i https://example.com/x.mp4 renders/x.jpg', 'ffmpeg -i {clips/a.mp4} renders/a.jpg'
  ]) await deny('Bash', bash(command), ONE)
})

test('web and subagents are not available', async () => {
  for (const t of ['WebSearch', 'WebFetch', 'Task', 'PowerShell']) await deny(t, {}, 'Not available in Chapel.')
})

test('skills and todos are allowed', async () => {
  await allow('Skill', { skill: 'clip' })
  await allow('TodoWrite', { todos: [] })
})
