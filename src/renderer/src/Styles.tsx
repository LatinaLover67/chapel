import { useEffect, useState } from 'react'
import type { StyleInfo } from '../../shared/api'
import { Folder, Plus } from './icons'

const toName = (v: string): string => v.toLowerCase().replace(/\.zip$/, '').replace(/[^a-z0-9_-]+/g, '-').replace(/^[-_]+/, '').slice(0, 40)

export default function StylesView(): React.JSX.Element {
  const [styles, setStyles] = useState<StyleInfo[]>([])
  const [adding, setAdding] = useState(false)
  const [source, setSource] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => void window.chapel.styles.list().then(setStyles), [])

  const reset = (): void => { setAdding(false); setSource(null); setName(''); setError('') }
  const pick = async (kind: 'zip' | 'folder'): Promise<void> => {
    const p = await window.chapel.styles.pick(kind)
    if (!p) return
    setSource(p)
    setName(toName(p.split(/[\\/]/).pop() ?? ''))
    setError('')
  }
  const add = async (): Promise<void> => {
    setBusy(true)
    try {
      setStyles(await window.chapel.styles.add(source!, name.replace(/[-_]+$/, '')))
      reset()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }
  const remove = async (n: string): Promise<void> => {
    try { setStyles(await window.chapel.styles.remove(n)) } catch (e) { setError((e as Error).message) }
  }

  const row = (st: StyleInfo): React.JSX.Element => (
    <div key={st.name} className="set-row">
      <div className="set-text">
        <div className="set-title"><span className="mono">{st.name}</span></div>
        <div className="set-desc">{st.description || 'No description in its SKILL.md.'}</div>
      </div>
      {!st.builtIn && <div className="set-control"><button onClick={() => void remove(st.name)}>Remove</button></div>}
    </div>
  )
  const mine = styles.filter((s) => !s.builtIn)

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Styles</h1>
          <p className="lede">A style is the recipe Claude follows when it cuts your edit. Add your own and it shows up on the home screen.</p>
        </div>
        {!adding && <button className="primary" onClick={() => setAdding(true)}><Plus /> Add style</button>}
      </div>

      {adding && (
        <div className="card add-card">
          {!source ? (
            <div className="set-row wide">
              <div className="set-text">
                <div className="set-title">Add a style</div>
                <div className="set-desc">Pick a .zip or a folder with a <span className="mono">SKILL.md</span> (the recipe Claude reads) and a <span className="mono">render.py</span> (the code that makes the video).</div>
              </div>
              <div className="set-control">
                <button onClick={() => void pick('zip')}>Choose a .zip</button>
                <button onClick={() => void pick('folder')}><Folder /> Choose a folder</button>
                <button className="quiet-btn" onClick={reset}>Cancel</button>
              </div>
            </div>
          ) : (
            <div className="set-row wide">
              <div className="set-text">
                <div className="set-title">Name it</div>
                <div className="set-desc mono path">{source}</div>
              </div>
              <div className="set-control">
                <input aria-label="Style name" value={name} onChange={(e) => setName(toName(e.target.value))} onKeyDown={(e) => e.key === 'Enter' && void add()} />
                <button className="primary" disabled={busy || !name} onClick={() => void add()}>{busy ? 'Adding…' : 'Add'}</button>
                <button className="quiet-btn" onClick={reset}>Cancel</button>
              </div>
            </div>
          )}
          <p className="warn">A style runs its own code on your computer. Only add styles from people you trust.</p>
          {error && <p className="error">{error}</p>}
        </div>
      )}

      <h3 className="sec">Built in</h3>
      <div className="card">{styles.filter((s) => s.builtIn).map(row)}</div>

      <h3 className="sec">Yours <button className="link" onClick={() => void window.chapel.app.open('styles')}>Open folder</button></h3>
      <div className="card">{mine.length ? mine.map(row) : <div className="set-row"><div className="set-desc">Styles you add show up here.</div></div>}</div>
      {!adding && error && <p className="error">{error}</p>}
    </div>
  )
}
