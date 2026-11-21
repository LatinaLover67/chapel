import { useEffect, useRef, useState } from 'react'
import type { Settings, StyleInfo } from '../../shared/api'
import { MODELS, modelLabel } from '../../shared/constants'
import { canStart, fileName, splitFiles } from './canStart'
import AsciiBanner from './AsciiBanner'
import { ArrowUp, Chevron, Folder, Paperclip } from './icons'

const SUGGESTIONS = ['Keep the intro long and calm', 'Open on my best shot', 'Cut harder after the drop']

export default function Home(p: { onCreated(editDir: string): void }): React.JSX.Element {
  const [notes, setNotes] = useState('')
  const [files, setFiles] = useState<string[]>([])
  const [styles, setStyles] = useState<StyleInfo[]>([])
  const [style, setStyle] = useState<string | null>(null)
  const [s, setS] = useState<Settings | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const picker = useRef<HTMLInputElement>(null)

  useEffect(() => {
    window.chapel.styles.list().then((list) => {
      setStyles(list)
      setStyle((cur) => cur ?? list[0]?.name ?? null)
    })
    window.chapel.settings.get().then(setS)
  }, [])

  const add = (list: FileList | null): void => {
    const paths = [...(list ?? [])].map((f) => window.chapel.pathForFile(f)).filter(Boolean)
    setFiles((cur) => [...cur, ...paths.filter((x) => !cur.includes(x))])
    setError('')
  }

  const ready = !canStart({ hasApiKey: !!s?.hasApiKey, files, style })
  const send = async (): Promise<void> => {
    const problem = canStart({ hasApiKey: !!s?.hasApiKey, files, style })
    if (problem) return setError(problem)
    const { clips, songs } = splitFiles(files)
    setBusy(true)
    try {
      const { editDir } = await window.chapel.edits.create({ notes, clips, song: songs[0], style: style! })
      p.onCreated(editDir)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="home">
      <AsciiBanner word="claude" />
      <h1>What are we editing?</h1>
      <div className="prompt" onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); add(e.dataTransfer.files) }}>
        <textarea value={notes} rows={2} placeholder="Drop your clips and a song, then say what you want. Claude cuts it on the beat."
          onChange={(e) => setNotes(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send() } }} />
        {files.length > 0 && (
          <div className="files">
            {files.map((f) => (
              <span key={f} className="file">
                {fileName(f)}
                <button aria-label={`Remove ${fileName(f)}`} onClick={() => setFiles(files.filter((x) => x !== f))}>×</button>
              </span>
            ))}
          </div>
        )}
        <div className="prompt-bar">
          {s && (
            <label className="model">
              <select aria-label="Model" value={s.model} onChange={async (e) => setS(await window.chapel.settings.update({ model: e.target.value }))}>
                {MODELS.map((m) => <option key={m} value={m}>Claude {modelLabel(m)}</option>)}
              </select>
              <Chevron />
            </label>
          )}
          <span className="spacer" />
          <input ref={picker} type="file" multiple hidden accept="video/*,audio/*" onChange={(e) => { add(e.target.files); e.target.value = '' }} />
          <button className="icon" aria-label="Attach clips or a song" title="Attach clips or a song" onClick={() => picker.current?.click()}><Paperclip /></button>
          <button className={'send' + (ready ? ' ready' : '')} aria-label="Make the edit" title="Make the edit" disabled={busy} onClick={() => void send()}><ArrowUp /></button>
        </div>
      </div>
      {error && <p className="error">{error}</p>}
      <div className="chips">
        {s && (
          <button className="folder" title={`Edits are saved in ${s.editsDir}`} onClick={async () => setS(await window.chapel.settings.pickEditsDir())}>
            <Folder /> {'…\\' + s.editsDir.split(/[\\/]/).slice(-2).join('\\')} <Chevron />
          </button>
        )}
        <span className="divider" />
        {styles.map((st) => (
          <button key={st.name} className={'chip' + (st.name === style ? ' on' : '')} title={st.description} onClick={() => setStyle(st.name)}>{st.name}</button>
        ))}
      </div>
      <div className="chips">
        {SUGGESTIONS.map((t) => <button key={t} className="chip quiet" onClick={() => setNotes(t)}>{t}</button>)}
      </div>
    </div>
  )
}
