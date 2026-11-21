import { loadImage, mountAscii } from './ascii.js'
import { loadThree, makeStage } from './logo3d.js'

const still = matchMedia('(prefers-reduced-motion: reduce)').matches

const GX = 472, GY = 120 // fingertip gap in hands.png
const PY = 0.56
const handsCanvas = document.querySelector('canvas.hands')
const gapOf = (w) => Math.max(80, w * 0.1)

loadImage('assets/hands.png').then((img) => mountAscii(handsCanvas, (s, w, h, t) => {
  const S = Math.max(w * 2.6, 1500) / img.width
  const gap = gapOf(w)
  const lean = still ? 0 : gap * 0.07 * Math.sin(t * 0.6)
  const arms = () => {
    s.save()
    s.translate(w / 2 - gap / 2 + lean, h * PY)
    s.rotate(0.04)
    s.drawImage(img, 0, 0, GX, img.height, -GX * S, -GY * S, GX * S, img.height * S)
    s.restore()
    s.save()
    s.translate(w / 2 + gap / 2 - lean, h * PY)
    s.rotate(-0.04)
    s.drawImage(img, GX, 0, img.width - GX, img.height, 0, -GY * S, (img.width - GX) * S, img.height * S)
    s.restore()
  }
  arms()
  const x = (((t * 0.05) % 1.5) - 0.25) * w
  s.save()
  s.globalCompositeOperation = 'lighter'
  for (const [bw, a] of [[0.24, 0.12], [0.13, 0.14], [0.05, 0.16]]) {
    s.save()
    s.beginPath()
    s.rect(x - (bw * w) / 2, 0, bw * w, h)
    s.clip()
    s.globalAlpha = a
    arms()
    s.restore()
  }
  s.restore()
}, { cell: [5, 7], font: 7.5 }))

const logoBox = document.querySelector('.logo3d')
const placeLogo = () => {
  const w = handsCanvas.clientWidth
  logoBox.style.left = `${handsCanvas.offsetLeft + w / 2}px`
  logoBox.style.top = `${handsCanvas.offsetTop + handsCanvas.clientHeight * PY}px`
  logoBox.style.width = logoBox.style.height = `${gapOf(w) * 1.15}px`
}
placeLogo()
new ResizeObserver(placeLogo).observe(handsCanvas)

loadThree().then((THREE) => {
  const canvas = logoBox.querySelector('canvas')
  const stage = makeStage(THREE, canvas, { fit: 6.2 })
  const size = () => stage.size(canvas.clientWidth, canvas.clientHeight)
  size()
  new ResizeObserver(size).observe(canvas)
  let on = true
  new IntersectionObserver(([e]) => (on = e.isIntersecting)).observe(canvas)
  const spin = (ms) => {
    const t = ms / 1000
    stage.mark.rotation.y = still ? 0.5 : t * 0.9
    stage.mark.rotation.x = still ? 0.15 : Math.sin(t * 0.7) * 0.2
    if (on) stage.render()
    if (!still) requestAnimationFrame(spin)
  }
  requestAnimationFrame(spin)
}).catch(() => logoBox.classList.add('flat'))

const markCanvas = document.querySelector('canvas.mark')
const drawFlatMark = (s, w, h) => {
  const size = Math.min(w, h) * 0.95
  s.save()
  s.translate(w / 2, h / 2)
  s.scale(size / 64, size / 64)
  s.translate(-32, -32)
  s.strokeStyle = s.fillStyle = '#fff'
  s.lineCap = 'round'
  s.lineWidth = 5
  s.beginPath()
  s.arc(32, 32, 22, 0, Math.PI * 2)
  s.stroke()
  s.lineWidth = 3.5
  s.beginPath()
  for (let k = 0; k < 6; k++) {
    const a = Math.PI / 2 + (k * Math.PI) / 3
    s.moveTo(32 + Math.cos(a) * 9, 32 + Math.sin(a) * 9)
    s.lineTo(32 + Math.cos(a) * 19, 32 + Math.sin(a) * 19)
  }
  s.stroke()
  s.beginPath()
  s.arc(32, 32, 4.5, 0, Math.PI * 2)
  s.fill()
  s.restore()
}
loadThree().then((THREE) => {
  const gl = document.createElement('canvas')
  const stage = makeStage(THREE, gl, { fit: 5.6, preserve: true })
  stage.size(480, 480)
  mountAscii(markCanvas, (s, w, h, t) => {
    stage.mark.rotation.y = still ? 0.35 : Math.sin(t * 0.45) * 0.55
    stage.mark.rotation.x = still ? 0.2 : 0.2 + Math.sin(t * 0.3) * 0.15
    stage.mark.rotation.z = still ? 0 : t * 0.25
    stage.render()
    const side = Math.min(w, h)
    s.drawImage(gl, (w - side) / 2, (h - side) / 2, side, side)
  }, { cell: [4, 6], font: 6.5, reach: 90 })
}).catch(() => mountAscii(markCanvas, drawFlatMark, { cell: [4, 6], font: 6.5, reach: 90 }))
