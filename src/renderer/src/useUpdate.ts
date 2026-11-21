import { useEffect, useState } from 'react'
import type { UpdateState } from '../../shared/api'

export function useUpdate(): UpdateState {
  const [u, setU] = useState<UpdateState>({ kind: 'idle' })
  useEffect(() => {
    void window.chapel.update.get().then(setU)
    return window.chapel.update.onState(setU)
  }, [])
  return u
}

export function updateText(u: UpdateState): string {
  switch (u.kind) {
    case 'checking': return 'Checking…'
    case 'none': return u.detail ?? 'Up to date'
    case 'available': return 'A new build is out'
    case 'downloading': return `Downloading ${Math.round((u.progress ?? 0) * 100)}%`
    case 'ready': return 'Ready to install'
    case 'error': return u.detail ?? "Couldn't check for updates"
    default: return ''
  }
}
