const THREE_URL = 'https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.min.js'
let three = null
export const loadThree = () => (three ??= import(THREE_URL))

function buildMark(THREE, material) {
  const mark = new THREE.Group()
  mark.add(new THREE.Mesh(new THREE.TorusGeometry(2.2, 0.25, 32, 160), material))
  for (let k = 0; k < 6; k++) {
    const a = Math.PI / 2 + (k * Math.PI) / 3
    const spoke = new THREE.Mesh(new THREE.CapsuleGeometry(0.175, 1.0, 8, 20), material)
    spoke.position.set(Math.cos(a) * 1.4, Math.sin(a) * 1.4, 0)
    spoke.rotation.z = a - Math.PI / 2
    mark.add(spoke)
  }
  const hub = new THREE.Mesh(new THREE.SphereGeometry(0.45, 40, 24), material)
  hub.scale.z = 0.6
  mark.add(hub)
  return mark
}

export function makeStage(THREE, canvas, { fit = 7.6, preserve = false } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, preserveDrawingBuffer: preserve })
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1))
  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(26, 1, 0.1, 100)
  scene.add(new THREE.AmbientLight(0xffffff, 0.55))
  const key = new THREE.DirectionalLight(0xffffff, 2.6)
  key.position.set(3, 5, 6)
  scene.add(key)
  const rim = new THREE.DirectionalLight(0xffffff, 1.4)
  rim.position.set(-5, -2, -4)
  scene.add(rim)
  const mark = buildMark(THREE, new THREE.MeshStandardMaterial({ color: 0xf2f0ea, roughness: 0.32, metalness: 0.18 }))
  scene.add(mark)
  const size = (w, h) => {
    renderer.setSize(w, h, false)
    camera.aspect = w / h
    camera.position.z = fit / (2 * Math.tan((13 * Math.PI) / 180) * camera.aspect)
    camera.updateProjectionMatrix()
  }
  return { mark, size, render: () => renderer.render(scene, camera) }
}
