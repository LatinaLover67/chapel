import { resolve } from 'path'
import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  main: {
    // set by scripts/release.mjs; plain builds are 'dev' and never update themselves
    define: { __BUILD_ID__: JSON.stringify(process.env.CHAPEL_BUILD_ID ?? 'dev') }
  },
  preload: {},
  renderer: {
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer/src')
      }
    },
    plugins: [react()]
  }
})
