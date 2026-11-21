export function Toggle(p: { on: boolean; label: string; onChange(v: boolean): void }): React.JSX.Element {
  return (
    <button role="switch" aria-checked={p.on} aria-label={p.label} className={'toggle' + (p.on ? ' on' : '')} onClick={() => p.onChange(!p.on)}>
      <span />
    </button>
  )
}

export function Segmented<T extends string>(p: { value: T; options: [T, string][]; label: string; onChange(v: T): void }): React.JSX.Element {
  return (
    <div className="segmented" role="radiogroup" aria-label={p.label}>
      {p.options.map(([v, l]) => (
        <button key={v} role="radio" aria-checked={p.value === v} className={p.value === v ? 'on' : ''} onClick={() => p.onChange(v)}>{l}</button>
      ))}
    </div>
  )
}

export function Row(p: { title: React.ReactNode; desc?: React.ReactNode; children?: React.ReactNode; wide?: boolean }): React.JSX.Element {
  return (
    <div className={'set-row' + (p.wide ? ' wide' : '')}>
      <div className="set-text">
        <div className="set-title">{p.title}</div>
        {p.desc && <div className="set-desc">{p.desc}</div>}
      </div>
      {p.children && <div className="set-control">{p.children}</div>}
    </div>
  )
}

export function MadeBy(): React.JSX.Element {
  return (
    <div className="madeby-row">
      <span>Made by</span>
      <a className="madeby-pill" href="https://x.com/ohbabyilvlatina" target="_blank" rel="noreferrer">
        <svg viewBox="0 0 40 40" width="20" height="20" aria-hidden="true"><circle cx="20" cy="20" r="20" fill="#f2f0ea" /><circle cx="20" cy="15.5" r="7" fill="#0f2350" /><path d="M6.5 34.5C9 28 14 24.5 20 24.5s11 3.5 13.5 10a20 20 0 0 1-27 0z" fill="#0f2350" /></svg>
        <b>✝</b>
        <svg viewBox="-1 -1 18 18" width="13" height="13" aria-hidden="true"><path fill="#1d9bf0" stroke="#1d9bf0" strokeWidth="1.6" strokeLinejoin="round" d="M16 8 14.1 10.53 13.66 13.66 10.53 14.1 8 16 5.47 14.1 2.34 13.66 1.9 10.53 0 8 1.9 5.47 2.34 2.34 5.47 1.9 8 0 10.53 1.9 13.66 2.34 14.1 5.47Z" /><path d="m4.7 8.2 2.2 2.2 4.5-4.7" fill="none" stroke="#fff" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>
        <span>@ohbabyilvlatina</span>
      </a>
      <a className="gh" href="https://github.com/LatinaLover67/chapel" target="_blank" rel="noreferrer" aria-label="Chapel on GitHub">
        <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path fill="currentColor" d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.06-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0 0 16 8c0-4.42-3.58-8-8-8z" /></svg>
      </a>
    </div>
  )
}
