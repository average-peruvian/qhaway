import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_')

  return {
    plugins: [react({ include: '**/*.{jsx,js}' })],
    server: {
      proxy: {
        '/api': {
          target: 'http://localhost:8001',
          changeOrigin: true,
        },
      },
    },
    define: {
      'import.meta.env.VITE_MAPTILER_KEY': JSON.stringify(env.VITE_MAPTILER_KEY),
    },
  }
})