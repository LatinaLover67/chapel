import { contextBridge, ipcRenderer, webUtils } from 'electron'
import type { ChapelApi } from '../shared/api'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const call = (channel: string, ...args: unknown[]): Promise<any> =>
  ipcRenderer.invoke(channel, ...args).catch((e: Error) => {
    throw new Error(e.message.replace(/^Error invoking remote method '[^']+': (Error: )?/, ''))
  })

const listen = <A extends unknown[]>(channel: string, cb: (...a: A) => void): (() => void) => {
  const h = (_e: unknown, ...a: unknown[]): void => cb(...(a as A))
  ipcRenderer.on(channel, h)
  return () => ipcRenderer.off(channel, h)
}

const api: ChapelApi = {
  settings: {
    get: () => call('settings:get'),
    update: (p) => call('settings:update', p),
    setApiKey: (k) => call('settings:setApiKey', k),
    pickEditsDir: () => call('settings:pickEditsDir')
  },
  styles: { list: () => call('styles:list') },
  edits: {
    list: () => call('edits:list'),
    create: (e) => call('edits:create', e),
    change: (d, t) => call('edits:change', d, t),
    cancel: (d) => call('edits:cancel', d),
    videoUrl: (d) => call('edits:videoUrl', d),
    onLine: (cb) => listen('edits:line', cb),
    onDone: (cb) => listen('edits:done', cb)
  },
  pathForFile: (f) => webUtils.getPathForFile(f)
}

contextBridge.exposeInMainWorld('chapel', api)
