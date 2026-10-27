import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  // GitHub Pages serves the site from https://<user>.github.io/dnd-campaign-platform/
  base: '/dnd-campaign-platform/',
  plugins: [react(), tailwindcss()],
})
