import { useEffect, useState } from 'react'
import { bannerRows, noiseChar } from './banner'

const COLS = 96, ROWS = 9

export default function AsciiBanner(p: { word: string }): React.JSX.Element {
  const [rows, setRows] = useState(() => bannerRows(COLS, ROWS, p.word))
  const mid = Math.floor(ROWS / 2), at = Math.floor((COLS - p.word.length) / 2), end = at + p.word.length

  useEffect(() => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const t = setInterval(() => setRows((cur) => {
      const next = [...cur]
      for (let i = 0; i < 16; i++) {
        const r = Math.floor(Math.random() * ROWS), c = Math.floor(Math.random() * COLS)
        if (next[r][c] === ' ' || (r === mid && c >= at && c < end)) continue
        next[r] = next[r].slice(0, c) + noiseChar() + next[r].slice(c + 1)
      }
      return next
    }), 90)
    return () => clearInterval(t)
  }, [p.word, mid, at, end])

  return (
    <pre className="banner" aria-hidden="true">
      {rows.map((row, r) => (
        <div key={r}>{r === mid ? <>{row.slice(0, at)}<b>{row.slice(at, end)}</b>{row.slice(end)}</> : row}</div>
      ))}
    </pre>
  )
}
