import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  // deployed to GitHub Pages under /automattic-spaces-map/ — assets resolve from this base
  base: '/automattic-spaces-map/',
  plugins: [react()],
})
