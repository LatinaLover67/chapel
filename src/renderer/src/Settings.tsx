import { useEffect, useState } from 'react'
import type { Settings } from '../../shared/api'
import { MODELS, modelLabel } from '../../shared/constants'

export default function SettingsView(): React.JSX.Element | null {
  const [s, setS] = useState<Settings | null>(null)
  const [key, setKey] = useState('')
  const [keyNote, setKeyNote] = useState('')
  useEffect(() => void window.chapel.settings.get().then(setS), [])
  if (!s) return null

  const update = async (p: Partial<Omit<Settings, 'hasApiKey'>>): Promise<void> => setS(await window.chapel.settings.update(p))
  const saveKey = async (): Promise<void> => {
    try {
      await window.chapel.settings.setApiKey(key)
      setKey('')
      setKeyNote('Key saved')
      setS(await window.chapel.settings.get())
    } catch (e) {
      setKeyNote((e as Error).message)
    }
  }

  return (
    <div className="page settings">
      <h1>Settings</h1>
      <section>
        <label htmlFor="key">Anthropic API key</label>
        <div className="row">
          <input id="key" type="password" value={key} autoComplete="off" placeholder={s.hasApiKey ? 'Paste a new key to replace yours' : 'sk-ant-…'}
            onChange={(e) => setKey(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && saveKey()} />
          <button className="primary" onClick={saveKey}>Save key</button>
        </div>
        <p className="note">{keyNote || (s.hasApiKey ? 'Key saved' : 'No key yet.')}</p>
      </section>
      <section>
        <label htmlFor="model">Model</label>
        <select id="model" value={s.model} onChange={(e) => update({ model: e.target.value })}>
          {MODELS.map((m) => <option key={m} value={m}>Claude {modelLabel(m)}</option>)}
        </select>
      </section>
      <section>
        <label>Edits folder</label>
        <div className="row">
          <code className="path">{s.editsDir}</code>
          <button onClick={async () => setS(await window.chapel.settings.pickEditsDir())}>Change</button>
        </div>
      </section>
      <section>
        <label>Watermark</label>
        <label className="check">
          <input type="checkbox" checked={s.watermark.chapel} onChange={(e) => update({ watermark: { ...s.watermark, chapel: e.target.checked } })} />
          made with chapel
        </label>
        <input aria-label="Your handle" value={s.watermark.text ?? ''} placeholder="@yourname (optional)"
          onChange={(e) => setS({ ...s, watermark: { ...s.watermark, text: e.target.value || null } })}
          onBlur={() => update({ watermark: s.watermark })} />
      </section>
      <p className="footer">Powered by Claude. You pay Anthropic for what you use.</p>
    </div>
  )
}
