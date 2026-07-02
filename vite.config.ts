import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// Pure renderer-only Vite config (no Electron plugin)
export default defineConfig({
  plugins: [react()],
  base: './',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
})
