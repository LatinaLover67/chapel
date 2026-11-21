import { test, expect } from 'vitest'
import { ensureRuntime, pythonCandidates, venvPython, type ExecFn } from './runtime'

const APP = 'C:/Users/x/AppData/Roaming/Chapel'
const REQ = 'C:/app/styles/requirements.txt'
const VPY = venvPython(APP, 'win32')

function fakeExec(ok: (cmd: string, args: string[]) => boolean, stderr = ''): ExecFn & { calls: string[][] } {
  const calls: string[][] = []
  const fn = (async (cmd: string, args: string[]) => {
    calls.push([cmd, ...args])
    const good = ok(cmd, args)
    return { code: good ? 0 : 1, stdout: '', stderr: good ? '' : stderr }
  }) as ExecFn & { calls: string[][] }
  fn.calls = calls
  return fn
}

test('candidates and venv path', () => {
  expect(pythonCandidates('win32')).toEqual([['py', '-3.12'], ['python']])
  expect(pythonCandidates('darwin')).toEqual([['python3'], ['python']])
  expect(VPY.replace(/\\/g, '/')).toBe(`${APP}/py/Scripts/python.exe`)
})

const READY = (p: string): boolean => p === VPY || p.endsWith('chapel-ready')

test('uses a ready venv without installing', async () => {
  const exec = fakeExec(() => true)
  const rt = await ensureRuntime({ appData: APP, requirements: REQ, platform: 'win32', exec, exists: READY })
  expect(rt).toEqual({ python: VPY, ffmpeg: 'ffmpeg' })
  expect(exec.calls.some((c) => c.includes('pip'))).toBe(false)
})

test('a venv whose tools never installed gets them installed and marked ready', async () => {
  const exec = fakeExec(() => true)
  const touched: string[] = []
  await ensureRuntime({ appData: APP, requirements: REQ, platform: 'win32', exec, exists: (p) => p === VPY, touch: (p) => touched.push(p) })
  expect(exec.calls).toContainEqual([VPY, '-m', 'pip', 'install', '-r', REQ])
  expect(exec.calls.some((c) => c.includes('venv'))).toBe(false)
  expect(touched).toHaveLength(1)
})

test('creates the venv with py -3.12 and installs requirements', async () => {
  const exec = fakeExec(() => true)
  await ensureRuntime({ appData: APP, requirements: REQ, platform: 'win32', exec, exists: () => false, touch: () => {} })
  expect(exec.calls).toContainEqual(['py', '-3.12', '-m', 'venv', expect.stringMatching(/py$/)])
  expect(exec.calls).toContainEqual([VPY, '-m', 'pip', 'install', '-r', REQ])
})

test('no python', async () => {
  const exec = fakeExec((cmd) => cmd === 'ffmpeg' || cmd === 'git')
  await expect(ensureRuntime({ appData: APP, requirements: REQ, platform: 'win32', exec, exists: () => false, touch: () => {} }))
    .rejects.toThrow('Chapel needs Python 3.12. Install it from python.org, then restart Chapel.')
})

test('no ffmpeg', async () => {
  const exec = fakeExec((cmd) => cmd !== 'ffmpeg')
  await expect(ensureRuntime({ appData: APP, requirements: REQ, platform: 'win32', exec, exists: (p) => p === VPY, touch: () => {} }))
    .rejects.toThrow('Chapel needs ffmpeg. Install it and make sure "ffmpeg" runs in a terminal, then restart Chapel.')
})

test('ffmpeg that throws counts as missing', async () => {
  const exec: ExecFn = async (cmd) => { if (cmd === 'ffmpeg') throw new Error('ENOENT'); return { code: 0, stdout: '', stderr: '' } }
  await expect(ensureRuntime({ appData: APP, requirements: REQ, platform: 'win32', exec, exists: (p) => p === VPY, touch: () => {} }))
    .rejects.toThrow('Chapel needs ffmpeg.')
})

test('failed pip install names the last stderr line', async () => {
  const exec = fakeExec((_cmd, args) => !args.includes('pip'), 'Collecting numpy\nERROR: no space left on device\n')
  await expect(ensureRuntime({ appData: APP, requirements: REQ, platform: 'win32', exec, exists: () => false, touch: () => {} }))
    .rejects.toThrow("Chapel couldn't install its video tools: ERROR: no space left on device")
})

test('windows needs Git for Windows (Claude runs commands in Git Bash)', async () => {
  const exec = fakeExec((cmd) => cmd !== 'git')
  await expect(ensureRuntime({ appData: APP, requirements: REQ, platform: 'win32', exec, exists: READY, touch: () => {} }))
    .rejects.toThrow('Chapel needs Git for Windows, which includes the command shell Claude uses. Install it from git-scm.com, then restart Chapel.')
  await expect(ensureRuntime({ appData: APP, requirements: REQ, platform: 'darwin', exec, exists: () => true, touch: () => {} })).resolves.toBeTruthy()
})
