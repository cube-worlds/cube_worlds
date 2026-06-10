import { fileURLToPath, URL } from 'node:url'
import vue from '@vitejs/plugin-vue'
import AutoImport from 'unplugin-auto-import/vite'
import { ElementPlusResolver } from 'unplugin-vue-components/resolvers'
import Components from 'unplugin-vue-components/vite'
import { defineConfig } from 'vite'

// https://vitejs.dev/config/
export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  plugins: [
    vue(),
    AutoImport({
      resolvers: [ElementPlusResolver()],
    }),
    Components({
      resolvers: [ElementPlusResolver()],
    }),
  ],
  // Node.js global to browser globalThis (@ton/core expects a Node-like env;
  // Buffer itself is polyfilled in src/polyfills.ts)
  define: {
    global: 'globalThis',
  },
  optimizeDeps: {
    include: ['vue', 'vue-router', 'pinia'],
  },
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
