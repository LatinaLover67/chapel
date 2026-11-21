import { useEffect, useRef, useState } from 'react'
import { CODEX_MODEL_CHOICES, EFFORTS, MODEL_CHOICES } from '../../shared/constants'
import { modelText, useSettings } from './useSettings'
import { Check, Chevron } from './icons'

export default function ModelMenu(p: { up?: boolean }): React.JSX.Element {
  const { s, agents, update } = useSettings()
  const [open, setOpen] = useState(false)
  const [custom, setCustom] = useState('')
  const [error, setError] = useState('')
  const [up, setUp] = useState(!!p.up)
  const box = useRef<HTMLDivElement>(null)
  const agent = agents.find((a) => a.id === s.agent) ?? agents[0]
  const codex = s.agent === 'codex'
  const choices = codex ? CODEX_MODEL_CHOICES : MODEL_CHOICES
  const current = codex ? s.codexModel : s.model

  useEffect(() => {
    if (!open) return
    const out = (e: MouseEvent): void => { if (!box.current?.contains(e.target as Node)) setOpen(false) }
    const esc = (e: KeyboardEvent): void => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', out)
    document.addEventListener('keydown', esc)
    return () => { document.removeEventListener('mousedown', out); document.removeEventListener('keydown', esc) }
  }, [open])

  const pick = async (model: string): Promise<void> => {
    try {
      await update(codex ? { codexModel: model } : { model })
      setError('')
      setCustom('')
      setOpen(false)
    } catch (e) {
      setError((e as Error).message === 'Unknown model.' ? (codex ? 'Codex model names look like gpt-6.2-sol.' : 'Claude model names look like claude-opus-5-5 or opus.') : (e as Error).message)
    }
  }
  const level = s.effort ? EFFORTS.indexOf(s.effort) : -1

  return (
    <div className="menu-wrap" ref={box}>
      <button className="agent-chip" aria-haspopup="menu" aria-expanded={open} onClick={() => {
        // open upward when there isn't room for the menu below
        const r = box.current!.getBoundingClientRect()
        setUp(!!p.up || window.innerHeight - r.bottom < 480)
        setOpen(!open)
      }}>
        <span className={'dot' + (agent?.ready ? ' on' : '')} />
        <span>{agent?.name ?? 'Claude'}</span>
        <span className="faint">{modelText(s)}</span>
        <Chevron />
      </button>
      {open && (
        <div className={'menu' + (up ? ' up' : '')} role="menu">
          <div className="menu-head">
            <span>Model</span>
            <div className="agent-pills">
              {agents.map((a) => (
                <button key={a.id} className={'agent-pill' + (a.id === s.agent ? ' on' : '')} title={a.detail} disabled={!a.ready && a.id !== s.agent} onClick={() => void update({ agent: a.id })}>
                  <span className={'dot' + (a.ready ? ' on' : '')} />{a.name}
                </button>
              ))}
            </div>
          </div>
          {choices.map((m) => (
            <button key={m.id} role="menuitemradio" aria-checked={current === m.id} className={'menu-item' + (current === m.id ? ' on' : '')} onClick={() => void pick(m.id)}>
              <span className="menu-label">{current === m.id && <Check />}{m.label}</span>
              <code>{m.id === 'default' ? 'as set up in Codex' : m.id}</code>
            </button>
          ))}
          {!choices.some((m) => m.id === current) && (
            <div className="menu-item on"><span className="menu-label"><Check />{modelText(s)}</span><code>{current}</code></div>
          )}
          <form className="menu-custom" onSubmit={(e) => { e.preventDefault(); if (custom.trim()) void pick(custom.trim()) }}>
            <input value={custom} placeholder="Another model by name" aria-label="Another model by name" onChange={(e) => { setCustom(e.target.value); setError('') }} />
          </form>
          {error && <p className="menu-error">{error}</p>}
          <div className="menu-effort">
            <div className="effort-head">
              <span className="faint">Effort</span>
              <span>{s.effort ? s.effort[0].toUpperCase() + s.effort.slice(1) : 'Default'}</span>
              {s.effort && <button className="link" onClick={() => void update({ effort: null })}>Reset</button>}
            </div>
            <div className="effort-bar">
              {EFFORTS.map((e, i) => (
                <button key={e} aria-label={`Effort ${e}`} title={e} className={i <= level ? 'on' : ''} onClick={() => void update({ effort: e })} />
              ))}
            </div>
            <p className="faint small">{agent?.ready ? `${agent.detail}. MCP servers are off.` : agent?.detail}</p>
          </div>
        </div>
      )}
    </div>
  )
}
