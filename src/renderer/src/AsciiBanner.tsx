import { useEffect, useRef } from 'react'
import { bannerRows, noiseChar } from './banner'

const COLS = 96, ROWS = 9, CW = 7.2, CH = 16

const kind = (ch: string): number => (/\d/.test(ch) ? 0 : /[a-zA-Z]/.test(ch) ? 1 : /[|/\\]/.test(ch) ? 2 : 3)

export default function AsciiBanner(p: { word: string; colors: string[] }): React.JSX.Element {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const c = ref.current!, ctx = c.getContext('2d')!, dpr = window.devicePixelRatio || 1
    c.width = COLS * CW * dpr
    c.height = ROWS * CH * dpr
    ctx.scale(dpr, dpr)
    const rows = bannerRows(COLS, ROWS, p.word).map((r) => [...r])
    const mid = Math.floor(ROWS / 2), at = Math.floor((COLS - p.word.length) / 2), end = at + p.word.length
    const ink = getComputedStyle(document.documentElement).getPropertyValue('--ink').trim()
    const draw = (): void => {
      ctx.clearRect(0, 0, COLS * CW, ROWS * CH)
      ctx.textBaseline = 'top'
      for (let r = 0; r < ROWS; r++) {
        for (let col = 0; col < COLS; col++) {
          const ch = rows[r][col]
          if (ch === ' ') continue
          const word = r === mid && col >= at && col < end
          ctx.font = `${word ? 600 : 400} 12px "IBM Plex Mono", Consolas, monospace`
          ctx.fillStyle = word ? ink : p.colors[kind(ch)]
          ctx.fillText(ch, col * CW, r * CH + 2)
        }
      }
    }
    void document.fonts.ready.then(draw)
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const t = setInterval(() => {
      for (let i = 0; i < 18; i++) {
        const r = Math.floor(Math.random() * ROWS), col = Math.floor(Math.random() * COLS)
        if (rows[r][col] !== ' ' && !(r === mid && col >= at && col < end)) rows[r][col] = noiseChar()
      }
      draw()
    }, 90)
    return () => clearInterval(t)
  }, [p.word, p.colors])

  return <canvas ref={ref} className="banner" style={{ width: COLS * CW, height: ROWS * CH }} aria-hidden="true" />
}
