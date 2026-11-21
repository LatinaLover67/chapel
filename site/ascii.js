const RAMP = ['.,:\'`', ';:=+~-', 'il1t!|/\\', 'fjrxz7?{}<>', 'S53Y2Z9eac', '#%8&$0@B']
const LEVELS = 16
const ALPHA = Array.from({ length: LEVELS }, (_, i) => `rgba(242,240,234,${(0.22 + 0.78 * (i / (LEVELS - 1)) ** 0.8).toFixed(3)})`)

export function mountAscii(canvas, paint, { cell = [5.5, 8.5], font = 8.5, reach = 150 } = {}) {
  const ctx = canvas.getContext('2d')
  const src = document.createElement('canvas')
  const sctx = src.getContext('2d', { willReadFrequently: true })
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches
  const pointer = { x: -1e4, y: -1e4 }
  let cols = 0, rows = 0, w = 0, h = 0, dpr = 1, seed = new Float32Array(0), visible = true, raf = 0

  function resize() {
    dpr = Math.min(2, window.devicePixelRatio || 1)
    w = canvas.clientWidth
    h = canvas.clientHeight
    canvas.width = Math.round(w * dpr)
    canvas.height = Math.round(h * dpr)
    cols = Math.ceil(w / cell[0])
    rows = Math.ceil(h / cell[1])
    src.width = cols
    src.height = rows
    seed = Float32Array.from({ length: cols * rows }, Math.random)
  }

  function draw(t) {
    sctx.setTransform(1, 0, 0, 1, 0, 0)
    sctx.clearRect(0, 0, cols, rows)
    sctx.imageSmoothingQuality = 'high'
    sctx.setTransform(1 / cell[0], 0, 0, 1 / cell[1], 0, 0)
    paint(sctx, w, h, t / 1000)
    const px = sctx.getImageData(0, 0, cols, rows).data

    const byLevel = Array.from({ length: LEVELS }, () => [])
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const i = r * cols + c
        let v = (px[i * 4] / 255) * (px[i * 4 + 3] / 255)
        if (v < 0.05) continue
        const near = Math.max(0, 1 - Math.hypot(c * cell[0] - pointer.x, r * cell[1] - pointer.y) / reach)
        v = Math.min(1, v + near * 0.45)
        if (!still && Math.random() < 0.015 + near * 0.35) seed[i] = Math.random()
        byLevel[Math.min(LEVELS - 1, Math.floor(v * LEVELS))].push(i)
      }
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, w, h)
    ctx.font = `${font}px "IBM Plex Mono", ui-monospace, monospace`
    ctx.textBaseline = 'top'
    for (let l = 0; l < LEVELS; l++) {
      if (!byLevel[l].length) continue
      ctx.fillStyle = ALPHA[l]
      const set = RAMP[Math.min(RAMP.length - 1, Math.floor((l / LEVELS) * RAMP.length))]
      for (const i of byLevel[l]) ctx.fillText(set[Math.floor(seed[i] * set.length)], (i % cols) * cell[0], Math.floor(i / cols) * cell[1])
    }
  }

  let last = 0
  function loop(t) {
    raf = 0
    if (!visible) return
    if (t - last > 30) {
      last = t
      draw(t)
    }
    raf = requestAnimationFrame(loop)
  }

  resize()
  draw(0)
  new ResizeObserver(() => { resize(); draw(performance.now()) }).observe(canvas)
  window.addEventListener('pointermove', (e) => {
    const b = canvas.getBoundingClientRect()
    pointer.x = e.clientX - b.left
    pointer.y = e.clientY - b.top
  }, { passive: true })
  document.addEventListener('pointerleave', () => { pointer.x = pointer.y = -1e4 })
  if (still) return draw(0)
  new IntersectionObserver(([e]) => {
    visible = e.isIntersecting
    if (visible && !raf) raf = requestAnimationFrame(loop)
  }).observe(canvas)
}

export function loadImage(url) {
  const img = new Image()
  img.src = url
  return img.decode().then(() => img)
}
