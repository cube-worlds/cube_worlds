import { fileURLToPath, URL } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vitejs.dev/config/
export default defineConfig({
  // The game is served under /game (the crawler-friendly landing owns the root).
  // This prefixes every emitted asset URL. The Telegram Mini App URL must point
  // at /game.
  base: '/game/',
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  plugins: [react()],
  build: {
    target: 'esnext',
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: true,
  },
  server: {
    allowedHosts: [
      'cubeworlds.club',
      'dominant-annually-lobster.ngrok-free.app',
    ],
    port: 5173,
    host: true,
  },
})
