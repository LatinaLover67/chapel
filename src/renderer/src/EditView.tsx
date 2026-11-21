import { useEffect, useMemo, useRef, useState } from 'react'
import type { ChatLine } from '../../shared/chat'
import type { EditInfo } from '../../shared/api'
import { modelText, paletteColors, useSettings } from './useSettings'
import AsciiReel from './AsciiReel'
import ModelMenu from './ModelMenu'
import { Logo } from './Sidebar'
import { ArrowUp, Folder, Panel, Stop } from './icons'

const clock = (ms: number): string => `${Math.floor(ms / 60000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')}`

export default function EditView(p: { editDir: string; fresh?: boolean }): React.JSX.Element {
  const { s, agents } = useSettings()
  const [lines, setLines] = useState<ChatLine[]>([])
  const [running, setRunning] = useState(!!p.fresh)
  const [video, setVideo] = useState<string | null>(null)
  const [info, setInfo] = useState<EditInfo | null>(null)
  const [text, setText] = useState('')
  const [panel, setPanel] = useState(true)
  const [since, setSince] = useState(() => Date.now())
  const [now, setNow] = useState(() => Date.now())
  const end = useRef<HTMLDivElement>(null)
  const colors = useMemo(() => paletteColors(s.ascii, s.mode), [s.ascii, s.mode])
  const agent = agents.find((a) => a.id === s.agent)?.name ?? 'Claude'
  const name = p.editDir.split(/[\\/]/).pop() ?? ''

  useEffect(() => {
    const load = (): void => {
      void window.chapel.edits.videoUrl(p.editDir).then(setVideo)
      void window.chapel.edits.info(p.editDir).then(setInfo)
    }
    load()
    const offLine = window.chapel.edits.onLine((d, l) => d === p.editDir && setLines((cur) => [...cur, l]))
    const offDone = window.chapel.edits.onDone((d, r) => {
      if (d !== p.editDir) return
      setRunning(false)
      if (r.ok) load()
    })
    return () => { offLine(); offDone() }
  }, [p.editDir])
  useEffect(() => { end.current?.scrollIntoView({ block: 'end' }) }, [lines, running])
  useEffect(() => {
    if (!running) return
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [running])

  const change = (): void => {
    if (!text.trim() || running) return
    setRunning(true)
    setSince(Date.now())
    setNow(Date.now())
    void window.chapel.edits.change(p.editDir, text.trim())
    setText('')
  }
  const spent = lines.reduce((sum, l) => sum + (l.costUsd ?? 0), 0)

  return (
    <div className={'room' + (panel ? ' with-panel' : '')}>
      <div className="room-main">
        <header className="room-head">
          <h2 title={name}>{name}</h2>
          <span className="spacer" />
          <button className="folder" title={p.editDir} onClick={() => void window.chapel.app.open(p.editDir)}><Folder /> {'…\\' + p.editDir.split(/[\\/]/).slice(-2).join('\\')}</button>
          <button className={'icon' + (panel ? ' on' : '')} aria-label="Side panel" aria-pressed={panel} title="Side panel" onClick={() => setPanel(!panel)}><Panel /></button>
        </header>

        <div className="stage">
          {/* unmounted while rendering so windows doesn't lock final.mp4 */}
          {running ? <div className="empty">Working on your edit…</div> : video ? <video key={video} src={video} controls /> : <div className="empty">Your edit will show up here.</div>}
        </div>

        <div className="lines">
          {lines.map((l, i) => {
            const first = (l.kind === 'agent' || l.kind === 'status') && !['agent', 'status'].includes(lines[i - 1]?.kind ?? '')
            return (
              <div key={i}>
                {first && <div className="who-line"><Logo /> {agent}</div>}
                <div className={'line ' + l.kind}>
                  {l.kind === 'done' ? (l.costUsd != null ? `Edit ready · $${l.costUsd.toFixed(2)}` : 'Edit ready') : l.text}
                </div>
              </div>
            )
          })}
          {running && <div className="line working"><span className="sq" /> {agent} is working <span className="faint">· {clock(now - since)}</span></div>}
          <div ref={end} />
        </div>

        <div className="composer">
          <textarea value={text} rows={2} placeholder={running ? 'Wait for this change to finish…' : 'Ask for a change…'} disabled={running}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); change() } }} />
          <div className="prompt-bar">
            <ModelMenu up />
            <span className="spacer" />
            {running
              ? <button className="send ready" aria-label="Stop" title="Stop" onClick={() => void window.chapel.edits.cancel(p.editDir)}><Stop /></button>
              : <button className={'send' + (text.trim() ? ' ready' : '')} aria-label="Send" title="Send" onClick={change}><ArrowUp /></button>}
          </div>
        </div>
      </div>

      {panel && (
        <aside className="room-panel">
          <div className="panel-status"><span className={'sq' + (running ? ' on' : '')} /> {running ? `${agent} is working` : video ? 'Edit ready' : 'Waiting'}</div>
          <div className="panel-art"><AsciiReel colors={colors} spinning={running} /></div>
          <div className="panel-sec">
            <div className="panel-h">Edit</div>
            <dl>
              <dt>Style</dt><dd className="mono">{info?.style}</dd>
              <dt>AI</dt><dd>{agent} · {modelText(s)}</dd>
              <dt>Song</dt><dd className="mono">{info?.song}</dd>
              <dt>Clips</dt><dd>{info?.clips}</dd>
              <dt>Versions</dt><dd>{info?.versions}</dd>
              <dt>Spent here</dt><dd>${spent.toFixed(2)}</dd>
            </dl>
          </div>
        </aside>
      )}
    </div>
  )
}
