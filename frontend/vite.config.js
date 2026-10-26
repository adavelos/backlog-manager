import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

const backendPort = process.env.BACKLOG_BACKEND_PORT || '8001'
const apiProxyTarget = `http://localhost:${backendPort}`

// https://vite.dev/config/
export default defineConfig({
  // Relative asset links, so the built app works under any path prefix (the gateway strips it).
  base: './',
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    proxy: {
      '/api': {
        target: apiProxyTarget,
        changeOrigin: true,
      },
    },
  },
})
