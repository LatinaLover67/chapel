import { app, shell, BrowserWindow, ipcMain, protocol, net, safeStorage, dialog, Notification } from 'electron'
import { basename, join, resolve, sep } from 'path'
import { existsSync, mkdirSync, readdirSync, statSync } from 'fs'
import { mkdtemp, rm } from 'fs/promises'
import { tmpdir } from 'os'
import { spawn } from 'child_process'
import { pathToFileURL } from 'url'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import type { ChatLine } from '../shared/chat'
import type { RunResult } from '../shared/api'
import { mediaPathFromUrl, mediaUrl } from '../shared/media'
import { createSettingsStore, sanitizePatch } from './settings'
import { addStyle, listStyles, removeStyle, type StyleRoot } from './styles'
import { detectAgents, envApiKey } from './agents'
import { findCodex, runCodex, type CodexStatus } from './codex'
import { downloadUpdate, fetchBuild, installArgs, isNewBuild, RELEASE_URL, type BuildInfo } from './updater'
import type { UpdateState } from '../shared/api'

declare const __BUILD_ID__: string
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

const OVERLAY = { night: { color: '#0e0e0d', symbolColor: '#f2f0ea' }, day: { color: '#f7f6f2', symbolColor: '#141413' } }

const exec: ExecFn = (cmd, args, env) =>
  new Promise((res, rej) => {
    const p = spawn(cmd, args, { windowsHide: true, env: env ? { ...process.env, ...env } : process.env })
    let stdout = '', stderr = ''
    p.stdout.on('data', (d) => (stdout += d))
    p.stderr.on('data', (d) => (stderr += d))
    p.on('error', rej)
    p.on('close', (code) => res({ code: code ?? 1, stdout, stderr }))
  })

function createWindow(mode: 'night' | 'day'): void {
  win = new BrowserWindow({
    width: 1280,
    height: 800,
    title: 'Chapel',
    backgroundColor: mode === 'day' ? '#ebeae5' : '#080807',
    show: false,
    autoHideMenuBar: true,
    titleBarStyle: 'hidden',
    ...(process.platform !== 'darwin' ? { titleBarOverlay: { ...OVERLAY[mode], height: 36 } } : {}),
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

  const userStyles = join(userData, 'styles')
  const roots = (): StyleRoot[] => [{ dir: stylesDir(), builtIn: true }, { dir: userStyles, builtIn: false }]
  const apiKey = (): string | null => store.getApiKey() ?? envApiKey(process.env)

  let codex: Promise<CodexStatus | null> | null = null
  const getCodex = (fresh = false): Promise<CodexStatus | null> =>
    (fresh || !codex ? (codex = findCodex({ exec, platform: process.platform, exists: existsSync, nodePath: process.execPath })) : codex)

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
    const s = store.get()
    const key = apiKey(), cx = s.agent === 'codex' ? await getCodex() : null, openaiKey = store.getOpenAiKey()
    const notReady = s.agent === 'codex'
      ? !cx ? "Codex isn't installed. Install the Codex CLI, or pick Claude in the model menu." : !cx.loggedIn && !openaiKey ? 'Run codex login, or add an OpenAI API key in Settings.' : null
      : !key ? 'Add your Anthropic API key in Settings first.' : null
    if (notReady) {
      send(editDir, { kind: 'error', text: notReady })
      return done(editDir, { ok: false, video: null })
    }
    const ac = new AbortController()
    running.set(editDir, ac)
    try {
      const rt = await getRuntime()
      const onLine = (l: ChatLine): void => send(editDir, l)
      const r = cx
        ? await runCodex({ editDir, prompt, model: s.codexModel, effort: s.effort, python: rt.python, codex: cx.cmd, apiKey: openaiKey, signal: ac.signal, onLine })
        : await runAgent({
          editDir, prompt, apiKey: key!, model: s.model, effort: s.effort, maxTurns: s.maxTurns, budgetUsd: s.budgetUsd,
          python: rt.python, configDir, claudePath, signal: ac.signal, onLine
        })
      done(editDir, r)
      if (s.notify && win && !win.isFocused() && Notification.isSupported())
        new Notification({ title: r.ok ? 'Edit ready' : 'Edit stopped', body: basename(editDir) }).show()
    } catch (e) {
      send(editDir, { kind: 'error', text: (e as Error).message })
      done(editDir, { ok: false, video: null })
    } finally {
      running.delete(editDir)
    }
  }

  ipcMain.handle('settings:get', () => store.get())
  ipcMain.handle('settings:update', (_e, p) => {
    const s = store.update(sanitizePatch(p))
    if (process.platform !== 'darwin') win?.setTitleBarOverlay({ ...OVERLAY[s.mode], height: 36 })
    return s
  })
  ipcMain.handle('settings:clearApiKey', () => store.clearApiKey())
  ipcMain.handle('settings:setOpenAiKey', (_e, k: string) => store.setOpenAiKey(String(k)))
  ipcMain.handle('settings:clearOpenAiKey', () => store.clearOpenAiKey())
  ipcMain.handle('agents:detect', async (_e, fresh?: boolean) => {
    const cx = await getCodex(!!fresh)
    return detectAgents({ savedKey: !!store.getApiKey(), env: process.env, codex: cx && { loggedIn: cx.loggedIn }, openaiKey: !!store.getOpenAiKey() })
  })
  ipcMain.handle('settings:setApiKey', (_e, k: string) => store.setApiKey(String(k)))
  ipcMain.handle('settings:pickEditsDir', async () => {
    const r = await dialog.showOpenDialog(win!, { properties: ['openDirectory', 'createDirectory'] })
    return r.canceled || !r.filePaths[0] ? store.get() : store.update({ editsDir: r.filePaths[0] })
  })
  ipcMain.handle('styles:list', () => listStyles(roots()))
  // only paths the user picked in the dialog can be added
  const picked = new Set<string>()
  ipcMain.handle('styles:pick', async (_e, kind: 'zip' | 'folder') => {
    const r = await dialog.showOpenDialog(win!, kind === 'zip'
      ? { properties: ['openFile'], filters: [{ name: 'Style', extensions: ['zip'] }] }
      : { properties: ['openDirectory'] })
    const p = r.canceled ? null : r.filePaths[0] ?? null
    if (p) picked.add(p)
    return p
  })
  ipcMain.handle('styles:add', async (_e, source: string, name: string) => {
    if (!picked.has(source)) throw new Error('Pick the style again.')
    const builtIn = listStyles([{ dir: stylesDir(), builtIn: true }]).map((s) => s.name)
    let from = source, tmp: string | null = null
    try {
      if (source.toLowerCase().endsWith('.zip')) {
        tmp = await mkdtemp(join(tmpdir(), 'chapel-style-'))
        if ((await exec('tar', ['-xf', source, '-C', tmp])).code !== 0) throw new Error("Chapel couldn't open that zip.")
        from = tmp
      }
      const style = addStyle(userStyles, from, String(name), builtIn)
      const req = join(style.dir, 'requirements.txt')
      if (existsSync(req)) {
        const r = await exec((await getRuntime()).python, ['-m', 'pip', 'install', '-r', req])
        if (r.code !== 0) {
          removeStyle(userStyles, style.name)
          throw new Error(`Chapel couldn't install what ${style.name} needs: ${r.stderr.trim().split(/\r?\n/).pop() ?? ''}`)
        }
      }
    } finally {
      if (tmp) await rm(tmp, { recursive: true, force: true })
    }
    picked.delete(source)
    return listStyles(roots())
  })
  ipcMain.handle('styles:remove', (_e, name: string) => {
    removeStyle(userStyles, String(name))
    return listStyles(roots())
  })
  ipcMain.handle('app:info', () => ({ version: app.getVersion(), build: __BUILD_ID__, dataDir: userData }))

  let update: UpdateState = { kind: 'idle' }, build: BuildInfo | null = null, installer: string | null = null, lastSent = 0
  const setUpdate = (u: UpdateState): void => {
    update = u
    win?.webContents.send('update:state', u)
  }
  const getUpdate = async (): Promise<void> => {
    if (!build) return
    setUpdate({ kind: 'downloading', progress: 0 })
    try {
      installer = await downloadUpdate(RELEASE_URL, build, join(userData, 'update'), (u) => net.fetch(u), (p) => {
        if (Date.now() - lastSent > 250) { lastSent = Date.now(); setUpdate({ kind: 'downloading', progress: p }) }
      })
      setUpdate({ kind: 'ready' })
    } catch (e) {
      setUpdate({ kind: 'error', detail: (e as Error).message })
    }
  }
  const checkUpdate = async (): Promise<void> => {
    if (!app.isPackaged || __BUILD_ID__ === 'dev') return setUpdate({ kind: 'none', detail: 'This build doesn\'t update itself.' })
    if (update.kind === 'checking' || update.kind === 'downloading' || update.kind === 'ready') return
    setUpdate({ kind: 'checking' })
    try {
      build = await fetchBuild(RELEASE_URL, (u) => net.fetch(u, { cache: 'no-store' }))
      if (!isNewBuild(__BUILD_ID__, build)) return setUpdate({ kind: 'none' })
      if (store.get().autoUpdate) await getUpdate()
      else setUpdate({ kind: 'available' })
    } catch {
      setUpdate({ kind: 'error', detail: "Chapel couldn't reach GitHub to check for updates." })
    }
  }
  const runInstaller = (reopen: boolean): void => {
    if (!installer) return
    spawn(installer, installArgs(reopen), { detached: true, stdio: 'ignore' }).unref()
    installer = null
  }
  ipcMain.handle('update:get', () => update)
  ipcMain.handle('update:check', () => checkUpdate())
  ipcMain.handle('update:download', () => getUpdate())
  ipcMain.handle('update:install', () => {
    runInstaller(true)
    app.quit()
  })
  // a downloaded update installs when chapel closes, and the next start is the new build
  app.on('before-quit', () => runInstaller(false))
  setTimeout(() => void checkUpdate(), 8000)
  setInterval(() => void checkUpdate(), 4 * 60 * 60 * 1000)
  ipcMain.handle('app:open', async (_e, what: string) => {
    const target = what === 'data' ? userData : what === 'edits' ? store.get().editsDir : what === 'styles' ? userStyles : ownEdit(what)
    mkdirSync(target, { recursive: true })
    await shell.openPath(target)
  })
  ipcMain.handle('edits:list', () => listEdits(store.get().editsDir))
  ipcMain.handle('edits:create', async (_e, req: { notes: string; clips: string[]; song: string; style: string }) => {
    const style = listStyles(roots()).find((s) => s.name === req.style)
    if (!style) throw new Error('Pick a style.')
    if (store.get().agent !== 'codex' && !apiKey()) throw new Error('Add your Anthropic API key in Settings first.')
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
  ipcMain.handle('edits:info', (_e, editDir: string) => {
    const d = ownEdit(editDir), m = readMeta(d)
    const count = (sub: string, re: RegExp): number => (existsSync(join(d, sub)) ? readdirSync(join(d, sub)).filter((f) => re.test(f)).length : 0)
    return { style: m.style, song: m.song, clips: count('clips', /./), versions: count('versions', /^v\d+\.json$/) }
  })

  createWindow(store.get().mode)
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow(store.get().mode)
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
