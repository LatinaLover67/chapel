import { useEffect, useRef } from 'react'

const COLS = 44, ROWS = 19, CW = 6.4, CH = 10.5
const RAMP = ' .:-=+*#%@'

// chapel's reel drawn in characters, turning on its axis
export default function AsciiReel(p: { colors: string[]; spinning: boolean }): React.JSX.Element {
  const ref = useRef<HTMLCanvasElement>(null)
  const spin = useRef(p.spinning)
  useEffect(() => { spin.current = p.spinning }, [p.spinning])

  useEffect(() => {
    const W = Math.round(COLS * CW), H = Math.round(ROWS * CH)
    const c = ref.current!, ctx = c.getContext('2d')!, dpr = window.devicePixelRatio || 1
    c.width = W * dpr
    c.height = H * dpr
    ctx.scale(dpr, dpr)
    const off = document.createElement('canvas')
    off.width = W
    off.height = H
    const o = off.getContext('2d', { willReadFrequently: true })!
    const still = matchMedia('(prefers-reduced-motion: reduce)').matches
    let a = 0.6, last = performance.now(), raf = 0

    const frame = (now: number): void => {
      a += ((now - last) / 1000) * (still ? 0 : spin.current ? 1.8 : 0.45)
      last = now
      const k = Math.cos(a), R = H * 0.44, cx = W / 2, cy = H / 2
      o.clearRect(0, 0, W, H)
      o.strokeStyle = o.fillStyle = `rgba(255,255,255,${0.55 + 0.45 * Math.abs(k)})`
      o.lineCap = 'round'
      o.lineWidth = R * 0.2
      o.beginPath()
      o.ellipse(cx, cy, Math.max(1.5, R * Math.abs(k)), R, 0, 0, Math.PI * 2)
      o.stroke()
      o.lineWidth = R * 0.14
      o.beginPath()
      for (let i = 0; i < 6; i++) {
        const t = Math.PI / 2 + (i * Math.PI) / 3
        o.moveTo(cx + Math.cos(t) * R * 0.41 * k, cy + Math.sin(t) * R * 0.41)
        o.lineTo(cx + Math.cos(t) * R * 0.86 * k, cy + Math.sin(t) * R * 0.86)
      }
      o.stroke()
      o.beginPath()
      o.ellipse(cx, cy, Math.max(1.5, R * 0.22 * Math.abs(k)), R * 0.22, 0, 0, Math.PI * 2)
      o.fill()

      const px = o.getImageData(0, 0, W, H).data
      ctx.clearRect(0, 0, W, H)
      ctx.font = '10px "IBM Plex Mono", Consolas, monospace'
      ctx.textBaseline = 'top'
      for (let r = 0; r < ROWS; r++) {
        for (let col = 0; col < COLS; col++) {
          let sum = 0
          const x0 = Math.round(col * CW), y0 = Math.round(r * CH)
          for (let y = y0; y < y0 + CH; y += 2) for (let x = x0; x < x0 + CW; x += 2) sum += px[(y * W + x) * 4 + 3]
          const v = sum / (Math.ceil(CH / 2) * Math.ceil(CW / 2) * 255)
          if (v < 0.04) continue
          const i = Math.min(RAMP.length - 1, Math.round(v * (RAMP.length - 1)))
          ctx.fillStyle = p.colors[Math.min(3, Math.floor((1 - v) * 4))]
          ctx.fillText(RAMP[Math.max(1, i)], x0, y0)
        }
      }
      if (!still) raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [p.colors])

  return <canvas ref={ref} className="reel" style={{ width: Math.round(COLS * CW), height: Math.round(ROWS * CH) }} aria-hidden="true" />
}
