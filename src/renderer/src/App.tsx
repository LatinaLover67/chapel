import { useCallback, useEffect, useMemo, useState } from 'react'
import type { AgentInfo, EditSummary, Settings } from '../../shared/api'
import { SettingsContext, type Patch } from './useSettings'
import Sidebar from './Sidebar'
import SettingsView from './Settings'
import StylesView from './Styles'
import Home from './Home'
import EditView from './EditView'

export type View = { kind: 'home' } | { kind: 'edit'; editDir: string; fresh?: boolean } | { kind: 'settings' } | { kind: 'styles' }

export default function App(): React.JSX.Element | null {
  const [view, setView] = useState<View>({ kind: 'home' })
  const [edits, setEdits] = useState<EditSummary[]>([])
  const [s, setS] = useState<Settings | null>(null)
  const [agents, setAgents] = useState<AgentInfo[]>([])
  const [busy, setBusy] = useState<Set<string>>(new Set())

  const refresh = (): void => void window.chapel.edits.list().then(setEdits)
  const refreshAgents = useCallback(async (fresh?: boolean) => setAgents(await window.chapel.agents.detect(fresh)), [])
  useEffect(() => {
    void window.chapel.edits.list().then(setEdits)
    void window.chapel.settings.get().then(setS)
    void window.chapel.agents.detect().then(setAgents)
  }, [])

  useEffect(() => {
    const offLine = window.chapel.edits.onLine((d, l) => {
      if (l.kind !== 'error' && l.kind !== 'done') setBusy((b) => (b.has(d) ? b : new Set(b).add(d)))
    })
    const offDone = window.chapel.edits.onDone((d) => setBusy((b) => { const n = new Set(b); n.delete(d); return n }))
    const onKey = (e: KeyboardEvent): void => {
      if (e.ctrlKey && e.key.toLowerCase() === 'n') { e.preventDefault(); setView({ kind: 'home' }) }
    }
    window.addEventListener('keydown', onKey)
    return () => { offLine(); offDone(); window.removeEventListener('keydown', onKey) }
  }, [])

  useEffect(() => {
    if (!s) return
    document.documentElement.dataset.mode = s.mode
    document.documentElement.dataset.look = s.look
  }, [s])

  const ctx = useMemo(() => s && {
    s, agents, set: setS, refreshAgents,
    update: async (p: Patch) => setS(await window.chapel.settings.update(p))
  }, [s, agents, refreshAgents])
  if (!ctx) return null

  return (
    <SettingsContext.Provider value={ctx}>
      <div className="app">
        <Sidebar view={view} edits={edits} busy={busy} go={setView} />
        <main className="main">
          {view.kind !== 'edit' && <div className="drag" />}
          {view.kind === 'home' && <Home onCreated={(d) => { refresh(); setView({ kind: 'edit', editDir: d, fresh: true }) }} />}
          {view.kind === 'edit' && <EditView key={view.editDir} editDir={view.editDir} fresh={view.fresh} />}
          {view.kind === 'settings' && <SettingsView />}
          {view.kind === 'styles' && <StylesView />}
        </main>
      </div>
    </SettingsContext.Provider>
  )
}
