import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  // Served from https://<user>.github.io/taeg/ on GitHub Pages.
  base: '/taeg/',
  plugins: [react()],
})
