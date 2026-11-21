import { useEffect, useMemo, useRef, useState } from 'react'
import type { StyleInfo } from '../../shared/api'
import { canStart, fileName, splitFiles } from './canStart'
import { paletteColors, useSettings } from './useSettings'
import AsciiBanner from './AsciiBanner'
import ModelMenu from './ModelMenu'
import { ArrowUp, Chevron, Folder, Paperclip } from './icons'

const SUGGESTIONS = ['Keep the intro long and calm', 'Open on my best shot', 'Cut harder after the drop']

export default function Home(p: { onCreated(editDir: string): void }): React.JSX.Element {
  const { s, agents, set } = useSettings()
  const [notes, setNotes] = useState('')
  const [files, setFiles] = useState<string[]>([])
  const [styles, setStyles] = useState<StyleInfo[]>([])
  const [style, setStyle] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const picker = useRef<HTMLInputElement>(null)
  const colors = useMemo(() => paletteColors(s.ascii, s.mode), [s.ascii, s.mode])
  const ready = !!agents.find((a) => a.id === s.agent)?.ready

  useEffect(() => {
    void window.chapel.styles.list().then((list) => {
      setStyles(list)
      setStyle((cur) => cur ?? list[0]?.name ?? null)
    })
  }, [])

  const add = (list: FileList | null): void => {
    const paths = [...(list ?? [])].map((f) => window.chapel.pathForFile(f)).filter(Boolean)
    setFiles((cur) => [...cur, ...paths.filter((x) => !cur.includes(x))])
    setError('')
  }

  const canGo = !canStart({ hasApiKey: ready, files, style })
  const send = async (): Promise<void> => {
    const picked = agents.find((x) => x.id === s.agent)
    if (picked && !picked.ready && picked.id !== 'claude') return setError(`${picked.name} isn't set up: ${picked.detail}. See Settings.`)
    const problem = canStart({ hasApiKey: ready, files, style })
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
      <AsciiBanner word={(agents.find((a) => a.id === s.agent)?.name ?? 'claude').toLowerCase()} colors={colors} />
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
          <ModelMenu />
          <span className="spacer" />
          <input ref={picker} type="file" multiple hidden accept="video/*,audio/*" onChange={(e) => { add(e.target.files); e.target.value = '' }} />
          <button className="icon" aria-label="Attach clips or a song" title="Attach clips or a song" onClick={() => picker.current?.click()}><Paperclip /></button>
          <button className={'send' + (canGo ? ' ready' : '')} aria-label="Make the edit" title="Make the edit" disabled={busy} onClick={() => void send()}><ArrowUp /></button>
        </div>
      </div>
      {error && <p className="error">{error}</p>}
      <div className="chips">
        <button className="folder" title={`Edits are saved in ${s.editsDir}`} onClick={async () => set(await window.chapel.settings.pickEditsDir())}>
          <Folder /> {'…\\' + s.editsDir.split(/[\\/]/).slice(-2).join('\\')} <Chevron />
        </button>
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
