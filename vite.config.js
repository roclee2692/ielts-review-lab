import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  test: {
    environment: 'jsdom',
    globals: true,
    testTimeout: 15_000,
    setupFiles: ['src/test/setup.js'],
    include: ['src/**/*.test.{js,jsx}', 'mcp/**/*.test.js'],
    exclude: ['node_modules', 'dist'],
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) return 'vendor-react'
        },
      },
    },
  },
})
