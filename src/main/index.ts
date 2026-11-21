import { app, shell, BrowserWindow, ipcMain, protocol, net, safeStorage, dialog } from 'electron'
import { join, resolve, sep } from 'path'
import { existsSync, mkdirSync, statSync } from 'fs'
import { spawn } from 'child_process'
import { pathToFileURL } from 'url'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import type { ChatLine } from '../shared/chat'
import type { RunResult } from '../shared/api'
import { mediaPathFromUrl, mediaUrl } from '../shared/media'
import { createSettingsStore, sanitizePatch } from './settings'
import { listStyles } from './styles'
import { ensureRuntime, type ExecFn, type Runtime } from './runtime'
import { createEdit, listEdits, readMeta } from './editFolder'
import { firstPrompt, runAgent } from './agent'

protocol.registerSchemesAsPrivileged([
  { scheme: 'chapel-media', privileges: { standard: true, secure: true, stream: true, supportFetchAPI: true } }
])

let win: BrowserWindow | null = null

// spawn can't run a program packed inside app.asar
const claudePath = app.isPackaged
  ? join(process.resourcesPath, 'app.asar.unpacked', 'node_modules', '@anthropic-ai', `claude-agent-sdk-${process.platform}-${process.arch}`, process.platform === 'win32' ? 'claude.exe' : 'claude')
  : undefined

const stylesDir = (): string => (app.isPackaged ? join(process.resourcesPath, 'styles') : join(app.getAppPath(), 'styles'))

const exec: ExecFn = (cmd, args) =>
  new Promise((res, rej) => {
    const p = spawn(cmd, args, { windowsHide: true })
    let stdout = '', stderr = ''
    p.stdout.on('data', (d) => (stdout += d))
    p.stderr.on('data', (d) => (stderr += d))
    p.on('error', rej)
    p.on('close', (code) => res({ code: code ?? 1, stdout, stderr }))
  })

function createWindow(): void {
  win = new BrowserWindow({
    width: 1280,
    height: 800,
    title: 'Chapel',
    backgroundColor: '#080807',
    show: false,
    autoHideMenuBar: true,
    titleBarStyle: 'hidden',
    ...(process.platform !== 'darwin' ? { titleBarOverlay: { color: '#0e0e0d', symbolColor: '#f2f0ea', height: 36 } } : {}),
    ...(process.platform !== 'darwin' ? { icon } : {}),
    webPreferences: { preload: join(__dirname, '../preload/index.js'), sandbox: false }
  })
  win.on('ready-to-show', () => win?.show())
  win.on('closed', () => (win = null))
  // a stray file drop would navigate the window away
  win.webContents.on('will-navigate', (e) => e.preventDefault())
  win.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  else win.loadFile(join(__dirname, '../renderer/index.html'))
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.chapel.app')
  app.on('browser-window-created', (_, w) => optimizer.watchWindowShortcuts(w))

  const userData = app.getPath('userData')
  const configDir = join(userData, 'agent')
  mkdirSync(configDir, { recursive: true })
  const store = createSettingsStore(userData, join(app.getPath('documents'), 'Chapel'), {
    available: () => safeStorage.isEncryptionAvailable(),
    encrypt: (s) => safeStorage.encryptString(s),
    decrypt: (b) => safeStorage.decryptString(b)
  })

  let runtime: Promise<Runtime> | null = null
  const getRuntime = (): Promise<Runtime> =>
    (runtime ??= ensureRuntime({
      appData: userData, requirements: join(stylesDir(), 'requirements.txt'), platform: process.platform, exec, exists: existsSync
    }).catch((e) => {
      runtime = null
      throw e
    }))

  const ownEdit = (editDir: string): string => {
    const root = resolve(store.get().editsDir), d = resolve(String(editDir))
    if (!d.startsWith(root + sep) || !existsSync(join(d, 'chapel.json'))) throw new Error('That edit is not in your edits folder.')
    return d
  }

  protocol.handle('chapel-media', (req) => {
    const p = mediaPathFromUrl(req.url, store.get().editsDir)
    return p && existsSync(p) ? net.fetch(pathToFileURL(p).toString(), { headers: req.headers }) : new Response('Not found', { status: 404 })
  })

  const running = new Map<string, AbortController>()
  const send = (editDir: string, l: ChatLine): void => win?.webContents.send('edits:line', editDir, l)
  const done = (editDir: string, r: RunResult): void => win?.webContents.send('edits:done', editDir, r)

  async function startRun(editDir: string, prompt: string): Promise<void> {
    if (running.has(editDir)) return send(editDir, { kind: 'error', text: 'Wait for the current change to finish.' })
    const apiKey = store.getApiKey()
    if (!apiKey) return send(editDir, { kind: 'error', text: 'Add your Anthropic API key in Settings first.' })
    const ac = new AbortController()
    running.set(editDir, ac)
    try {
      const rt = await getRuntime()
      const s = store.get()
      done(editDir, await runAgent({ editDir, prompt, apiKey, model: s.model, python: rt.python, configDir, claudePath, signal: ac.signal, onLine: (l) => send(editDir, l) }))
    } catch (e) {
      send(editDir, { kind: 'error', text: (e as Error).message })
      done(editDir, { ok: false, video: null })
    } finally {
      running.delete(editDir)
    }
  }

  ipcMain.handle('settings:get', () => store.get())
  ipcMain.handle('settings:update', (_e, p) => store.update(sanitizePatch(p)))
  ipcMain.handle('settings:setApiKey', (_e, k: string) => store.setApiKey(String(k)))
  ipcMain.handle('settings:pickEditsDir', async () => {
    const r = await dialog.showOpenDialog(win!, { properties: ['openDirectory', 'createDirectory'] })
    return r.canceled || !r.filePaths[0] ? store.get() : store.update({ editsDir: r.filePaths[0] })
  })
  ipcMain.handle('styles:list', () => listStyles(stylesDir()))
  ipcMain.handle('edits:list', () => listEdits(store.get().editsDir))
  ipcMain.handle('edits:create', async (_e, req: { notes: string; clips: string[]; song: string; style: string }) => {
    const style = listStyles(stylesDir()).find((s) => s.name === req.style)
    if (!style) throw new Error('Pick a style.')
    if (!store.getApiKey()) throw new Error('Add your Anthropic API key in Settings first.')
    const rt = await getRuntime()
    const clips = req.clips.map(String)
    const name = String(req.notes).trim().slice(0, 40) || (clips[0]?.split(/[\\/]/).pop()?.replace(/\.[^.]+$/, '') ?? '')
    const s = store.get()
    const editDir = await createEdit(s.editsDir, { name, clips, song: String(req.song), style, python: rt.python, watermark: s.watermark })
    void startRun(editDir, firstPrompt(style.name, readMeta(editDir).song, String(req.notes)))
    return { editDir }
  })
  ipcMain.handle('edits:change', (_e, editDir: string, text: string) => {
    const d = ownEdit(editDir)
    send(d, { kind: 'you', text: String(text) })
    void startRun(d, String(text))
  })
  ipcMain.handle('edits:cancel', (_e, editDir: string) => running.get(ownEdit(editDir))?.abort())
  ipcMain.handle('edits:videoUrl', (_e, editDir: string) => {
    const p = join(ownEdit(editDir), 'renders', 'final.mp4')
    return existsSync(p) ? mediaUrl(store.get().editsDir, p, Math.floor(statSync(p).mtimeMs)) : null
  })

  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
