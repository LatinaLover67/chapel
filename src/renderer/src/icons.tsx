const I = (p: { d: string; size?: number }): React.JSX.Element => (
  <svg viewBox="0 0 16 16" width={p.size ?? 14} height={p.size ?? 14} fill="none" stroke="currentColor" strokeWidth="1.4"
    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={p.d} /></svg>
)

export const Plus = (): React.JSX.Element => <I d="M8 3v10M3 8h10" />
export const Layers = (): React.JSX.Element => <I d="M8 2.5 14 5.5 8 8.5 2 5.5ZM2 8.5l6 3 6-3M2 11.2l6 3 6-3" />
export const Sliders = (): React.JSX.Element => <I d="M2.5 4.5h7M12.5 4.5h1M2.5 11.5h1M6.5 11.5h7M11 3v3M5 10v3" />
export const Folder = (): React.JSX.Element => <I d="M2 4.5c0-.6.4-1 1-1h3.2l1.3 1.5H13c.6 0 1 .4 1 1V12c0 .6-.4 1-1 1H3c-.6 0-1-.4-1-1Z" />
export const Chevron = (): React.JSX.Element => <I size={12} d="m4.5 6.5 3.5 3.5 3.5-3.5" />
export const Paperclip = (): React.JSX.Element => <I d="m13 7.5-5 5a3.2 3.2 0 0 1-4.6-4.6l5.2-5.2a2.1 2.1 0 0 1 3 3L6.5 10.8a1 1 0 0 1-1.5-1.5L10 4.5" />
export const ArrowUp = (): React.JSX.Element => <I d="M8 13V3.5M4 7.5l4-4 4 4" />
export const Panel = (): React.JSX.Element => <I d="M2.5 3.5h11v9h-11ZM10 3.5v9" />
export const Check = (): React.JSX.Element => <I size={12} d="m3.5 8.5 3 3 6-7" />
export const Stop = (): React.JSX.Element => (
  <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true"><rect x="3.5" y="3.5" width="9" height="9" rx="1.5" fill="currentColor" /></svg>
)
