import { useEffect, useState } from 'react'
import type { AppInfo } from '../../shared/api'
import { ASCII_PALETTES } from '../../shared/constants'
import { paletteColors, useSettings } from './useSettings'
import ModelMenu from './ModelMenu'
import { Logo } from './Sidebar'
import { MadeBy, Row, Segmented, Toggle } from './ui'
import { updateText, useUpdate } from './useUpdate'

const SAMPLE = [['0', 0], ['1', 0], ['|', 2], ['*', 3], ['/', 2], ['~', 3]] as const

export default function SettingsView(): React.JSX.Element {
  const { s, agents, set, update, refreshAgents } = useSettings()
  const [key, setKey] = useState('')
  const [okey, setOkey] = useState('')
  const [okeyNote, setOkeyNote] = useState('')
  const [checking, setChecking] = useState(false)
  const u = useUpdate()
  const [keyNote, setKeyNote] = useState('')
  const [handle, setHandle] = useState(s.watermark.text ?? '')
  const [info, setInfo] = useState<AppInfo | null>(null)
  useEffect(() => void window.chapel.app.info().then(setInfo), [])

  const saveKey = async (): Promise<void> => {
    try {
      await window.chapel.settings.setApiKey(key)
      setKey('')
      setKeyNote('Key saved.')
      set(await window.chapel.settings.get())
      await refreshAgents()
    } catch (e) {
      setKeyNote((e as Error).message)
    }
  }
  const saveOpenAiKey = async (): Promise<void> => {
    try {
      await window.chapel.settings.setOpenAiKey(okey)
      setOkey('')
      setOkeyNote('Key saved.')
      set(await window.chapel.settings.get())
      await refreshAgents()
    } catch (e) {
      setOkeyNote((e as Error).message)
    }
  }
  const removeOpenAiKey = async (): Promise<void> => {
    await window.chapel.settings.clearOpenAiKey()
    setOkeyNote('Key removed.')
    set(await window.chapel.settings.get())
    await refreshAgents()
  }
  const checkAgain = async (): Promise<void> => {
    setChecking(true)
    await refreshAgents(true)
    setChecking(false)
  }
  const removeKey = async (): Promise<void> => {
    await window.chapel.settings.clearApiKey()
    setKeyNote('Key removed.')
    set(await window.chapel.settings.get())
    await refreshAgents()
  }

  return (
    <div className="page settings">
      <h1>Settings</h1>

      <h3 className="sec">AI</h3>
      <div className="card">
        {agents.map((a) => (
          <Row key={a.id} title={a.name} desc={a.detail}>
            <span className={'status' + (a.ready ? ' ok' : '')}><span className={'dot' + (a.ready ? ' on' : '')} />{a.ready ? 'Ready' : 'Not set up'}</span>
            {agents.length > 1 && <button className={s.agent === a.id ? 'primary' : ''} disabled={!a.ready && s.agent !== a.id} onClick={() => void update({ agent: a.id })}>{s.agent === a.id ? 'In use' : 'Use'}</button>}
          </Row>
        ))}
        <Row title="Anthropic API key" desc={keyNote || 'Encrypted on this computer and only ever sent to Anthropic. Chapel also picks up ANTHROPIC_API_KEY from your environment.'} wide>
          <input type="password" aria-label="Anthropic API key" value={key} autoComplete="off" placeholder={s.hasApiKey ? 'Paste a new key to replace yours' : 'sk-ant-…'}
            onChange={(e) => setKey(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && void saveKey()} />
          <button className="primary" disabled={!key.trim()} onClick={() => void saveKey()}>Save</button>
          {s.hasApiKey && <button onClick={() => void removeKey()}>Remove</button>}
        </Row>
        <Row title="OpenAI API key" desc={okeyNote || 'For Codex. Optional if you are signed in to the Codex CLI. Encrypted on this computer and only ever sent to OpenAI.'} wide>
          <input type="password" aria-label="OpenAI API key" value={okey} autoComplete="off" placeholder={s.hasOpenAiKey ? 'Paste a new key to replace yours' : 'sk-…'}
            onChange={(e) => setOkey(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && void saveOpenAiKey()} />
          <button className="primary" disabled={!okey.trim()} onClick={() => void saveOpenAiKey()}>Save</button>
          {s.hasOpenAiKey && <button onClick={() => void removeOpenAiKey()}>Remove</button>}
        </Row>
        <Row title="Find AIs again" desc="After you install the Codex CLI or sign in to it.">
          <button disabled={checking} onClick={() => void checkAgain()}>{checking ? 'Checking…' : 'Check again'}</button>
        </Row>
        <Row title="Model" desc="Used for new edits and every change after. Effort is in the same menu.">
          <ModelMenu />
        </Row>
        <Row title="Tools" desc="Claude only gets what it needs to cut your edit: its style, ffmpeg and Python. Codex runs in its own sandbox: it can only change files in the edit's folder and has no internet, but Chapel can't check each of its commands the way it does for Claude. Neither gets MCP servers or the web." >
          <span className="mono faint">MCP off</span>
        </Row>
      </div>

      <h3 className="sec">Appearance</h3>
      <div className="card">
        <Row title="Mode" desc="Every colour has a night and a day.">
          <Segmented label="Mode" value={s.mode} options={[['night', 'Night'], ['day', 'Day']]} onChange={(mode) => void update({ mode })} />
        </Row>
        <Row title="ASCII colour" desc="The characters on the home screen and the reel in an edit's side panel." wide />
        <div className="palettes" role="radiogroup" aria-label="ASCII colour">
          {ASCII_PALETTES.map((pal) => {
            const c = paletteColors(pal.id, s.mode)
            return (
              <button key={pal.id} role="radio" aria-checked={s.ascii === pal.id} className={'pal' + (s.ascii === pal.id ? ' on' : '')} onClick={() => void update({ ascii: pal.id })}>
                <span className="pal-chars">{SAMPLE.map(([ch, i], k) => <span key={k} style={{ color: c[i] }}>{ch}</span>)}</span>
                <span>{pal.name}</span>
              </button>
            )
          })}
        </div>
        <Row title="Look" desc="Soft floats the work on a sheet. Square is flat panes, hairlines and square corners.">
          <Segmented label="Look" value={s.look} options={[['soft', 'Soft'], ['square', 'Square']]} onChange={(look) => void update({ look })} />
        </Row>
      </div>

      <h3 className="sec">Edits</h3>
      <div className="card">
        <Row title="Edits folder" desc={<span className="mono path">{s.editsDir}</span>}>
          <button onClick={() => void window.chapel.app.open('edits')}>Open</button>
          <button onClick={async () => set(await window.chapel.settings.pickEditsDir())}>Change</button>
        </Row>
        <Row title="Watermark" desc={'A small "made with chapel" in the corner of every video.'}>
          <Toggle label="Watermark" on={s.watermark.chapel} onChange={(chapel) => void update({ watermark: { ...s.watermark, chapel } })} />
        </Row>
        <Row title="Your handle" desc="Shown under the watermark. Leave it empty for none.">
          <input aria-label="Your handle" value={handle} placeholder="@yourname" maxLength={40}
            onChange={(e) => setHandle(e.target.value)} onBlur={() => void update({ watermark: { ...s.watermark, text: handle.trim() || null } })} />
        </Row>
        <Row title="Notifications" desc="When an edit finishes while Chapel is in the background.">
          <Toggle label="Notifications" on={s.notify} onChange={(notify) => void update({ notify })} />
        </Row>
      </div>

      <h3 className="sec">Limits <span>Claude works until the edit is done unless you set one</span></h3>
      <div className="card">
        <Row title="Turns per request" desc="Stops Claude after this many steps on one request. Claude only.">
          <input className="num" type="number" min={1} max={500} aria-label="Turns per request" value={s.maxTurns ?? 80}
            onChange={(e) => { const n = Number(e.target.value); if (n >= 1 && n <= 500) void update({ maxTurns: n }) }} />
        </Row>
        <Row title="Budget per request" desc="Stops a request once it has cost this much on your key. Claude only.">
          {s.budgetUsd !== null && (
            <span className="money">$<input className="num" type="number" min={0.1} max={1000} step={0.5} aria-label="Budget in dollars" value={s.budgetUsd}
              onChange={(e) => { const n = Number(e.target.value); if (n >= 0.1 && n <= 1000) void update({ budgetUsd: n }) }} /></span>
          )}
          <Toggle label="Budget per request" on={s.budgetUsd !== null} onChange={(on) => void update({ budgetUsd: on ? 2 : null })} />
        </Row>
      </div>

      <h3 className="sec">Updates</h3>
      <div className="card">
        <Row title="Install updates automatically" desc="New builds download in the background and install when you close Chapel. Off, Chapel still tells you when one is out.">
          <Toggle label="Install updates automatically" on={s.autoUpdate} onChange={(autoUpdate) => void update({ autoUpdate })} />
        </Row>
        <Row title="This build" desc={<span className="mono">{info ? `${info.version} · ${info.build}` : ''}</span>}>
          <span className="faint small">{updateText(u)}</span>
          {u.kind === 'ready'
            ? <button className="primary" onClick={() => void window.chapel.update.install()}>Restart to update</button>
            : u.kind === 'available'
              ? <button onClick={() => void window.chapel.update.download()}>Download</button>
              : <button disabled={u.kind === 'checking' || u.kind === 'downloading'} onClick={() => void window.chapel.update.check()}>Check now</button>}
        </Row>
      </div>

      <h3 className="sec">Data</h3>
      <div className="card">
        <Row title="Stored on this computer" desc={<span className="mono path">{info?.dataDir}</span>}>
          <button onClick={() => void window.chapel.app.open('data')}>Open</button>
        </Row>
        <Row title="Your styles" desc="Styles you add are kept here.">
          <button onClick={() => void window.chapel.app.open('styles')}>Open</button>
        </Row>
      </div>

      <div className="about"><Logo /> <b>Chapel</b> <span className="mono faint">{info?.version}</span> <span className="faint">Powered by Claude</span></div>
      <MadeBy />
    </div>
  )
}
