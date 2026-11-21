import { useEffect, useState } from 'react'
import type { EditSummary } from '../../shared/api'
import Sidebar from './Sidebar'
import SettingsView from './Settings'
import StylesView from './Styles'
import Home from './Home'
import EditView from './EditView'

export type View = { kind: 'home' } | { kind: 'edit'; editDir: string; fresh?: boolean } | { kind: 'settings' } | { kind: 'styles' }

export default function App(): React.JSX.Element {
  const [view, setView] = useState<View>({ kind: 'home' })
  const [edits, setEdits] = useState<EditSummary[]>([])
  const refresh = (): void => void window.chapel.edits.list().then(setEdits)
  useEffect(refresh, [])
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.ctrlKey && e.key.toLowerCase() === 'n') { e.preventDefault(); setView({ kind: 'home' }) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div className="app">
      <Sidebar view={view} edits={edits} go={setView} />
      <main className="main">
        <div className="drag" />
        {view.kind === 'home' && <Home onCreated={(d) => { refresh(); setView({ kind: 'edit', editDir: d, fresh: true }) }} />}
        {view.kind === 'edit' && <EditView key={view.editDir} editDir={view.editDir} fresh={view.fresh} />}
        {view.kind === 'settings' && <SettingsView />}
        {view.kind === 'styles' && <StylesView />}
      </main>
    </div>
  )
}
