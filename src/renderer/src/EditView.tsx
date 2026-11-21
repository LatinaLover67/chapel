import { useEffect, useRef, useState } from 'react'
import type { ChatLine } from '../../shared/chat'
import { ArrowUp } from './icons'

export default function EditView(p: { editDir: string; fresh?: boolean }): React.JSX.Element {
  const [lines, setLines] = useState<ChatLine[]>([])
  const [running, setRunning] = useState(!!p.fresh)
  const [video, setVideo] = useState<string | null>(null)
  const [text, setText] = useState('')
  const end = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const load = (): void => void window.chapel.edits.videoUrl(p.editDir).then(setVideo)
    load()
    const offLine = window.chapel.edits.onLine((d, l) => d === p.editDir && setLines((cur) => [...cur, l]))
    const offDone = window.chapel.edits.onDone((d, r) => {
      if (d !== p.editDir) return
      setRunning(false)
      if (r.ok) load()
    })
    return () => { offLine(); offDone() }
  }, [p.editDir])
  useEffect(() => end.current?.scrollIntoView({ block: 'end' }), [lines])

  const change = (): void => {
    if (!text.trim()) return
    setRunning(true)
    void window.chapel.edits.change(p.editDir, text.trim())
    setText('')
  }

  return (
    <div className="edit">
      <div className="stage">
        {/* unmounted while rendering so windows doesn't lock final.mp4 */}
        {running ? <div className="empty">Working on your edit…</div> : video ? <video key={video} src={video} controls /> : <div className="empty">Your edit will show up here.</div>}
      </div>
      <aside className="chat">
        <div className="lines">
          {lines.map((l, i) => (
            <div key={i} className={'line ' + l.kind}>
              {l.kind === 'done' ? `Edit ready · $${(l.costUsd ?? 0).toFixed(2)}` : l.text}
            </div>
          ))}
          <div ref={end} />
        </div>
        {running ? (
          <button className="stop" onClick={() => void window.chapel.edits.cancel(p.editDir)}>Stop</button>
        ) : (
          <div className="composer">
            <textarea value={text} rows={2} placeholder="Ask for a change…" onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); change() } }} />
            <button className={'send' + (text.trim() ? ' ready' : '')} aria-label="Send" onClick={change}><ArrowUp /></button>
          </div>
        )}
      </aside>
    </div>
  )
}
