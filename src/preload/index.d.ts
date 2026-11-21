import type { ChapelApi } from '../shared/api'

declare global {
  interface Window {
    chapel: ChapelApi
  }
}
