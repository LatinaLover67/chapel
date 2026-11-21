import type { EditSummary } from '../../shared/api'
import type { View } from './App'
import { Layers, Plus, Sliders } from './icons'

export function Logo(): React.JSX.Element {
  return (
    <svg viewBox="0 0 64 64" width="18" height="18" aria-hidden="true">
      <g fill="none" stroke="currentColor" strokeLinecap="round">
        <circle cx="32" cy="32" r="22" strokeWidth="5" />
        <path strokeWidth="3.5" d="M32 23V13M32 41v10M24.2 27.5l-8.7-5M39.8 36.5l8.7 5M24.2 36.5l-8.7 5M39.8 27.5l8.7-5" />
      </g>
      <circle cx="32" cy="32" r="4.5" fill="currentColor" />
    </svg>
  )
}

export default function Sidebar(p: { view: View; edits: EditSummary[]; go(v: View): void }): React.JSX.Element {
  const active = (v: View): string => (v.kind === p.view.kind && (v.kind !== 'edit' || (p.view.kind === 'edit' && v.editDir === p.view.editDir)) ? ' active' : '')
  return (
    <nav className="sidebar">
      <div className="brand"><Logo /> <span>Chapel</span> <span className="pill">Beta</span></div>
      <button className={'new' + active({ kind: 'home' })} onClick={() => p.go({ kind: 'home' })}>
        <Plus /> New edit <kbd>Ctrl+N</kbd>
      </button>
      <button className={'nav' + active({ kind: 'styles' })} onClick={() => p.go({ kind: 'styles' })}><Layers /> Styles</button>
      <div className="section-label">Edits</div>
      <div className="recent">
        {p.edits.length === 0 && <div className="hint">Edits you make show up here.</div>}
        {p.edits.map((e) => (
          <button key={e.dir} className={'nav' + active({ kind: 'edit', editDir: e.dir })} title={e.name} onClick={() => p.go({ kind: 'edit', editDir: e.dir })}>
            {e.name}
          </button>
        ))}
      </div>
      <button className={'nav' + active({ kind: 'settings' })} onClick={() => p.go({ kind: 'settings' })}><Sliders /> Settings</button>
    </nav>
  )
}
