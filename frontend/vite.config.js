import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react({ include: '**/*.{jsx,js}' })],
  server: {
    proxy: {
      '/api': {
        target:       'http://localhost:8001',
        changeOrigin: true,
      },
    },
  },
})