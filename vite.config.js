import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': { target: 'http://localhost:3001', changeOrigin: true },
    },
  },
  preview: { port: 4173 },
  build: {
    // Target modern browsers — smaller, faster output
    target: 'es2020',
    // Disable the inline modulepreload polyfill so Content-Security-Policy
    // script-src 'self' works without needing 'unsafe-inline'.
    // All browsers that can run es2020 natively support modulepreload.
    modulePreload: { polyfill: false },
    // Keep CSS in separate files so it can be cached independently
    cssCodeSplit: true,
    // Don't inline assets > 4 KB (default) so large images stay as files
    assetsInlineLimit: 4096,
    rollupOptions: {
      output: {
        manualChunks(id) {
          // ── Heavy deps — each cached independently ───────────────────
          if (id.includes('node_modules/xlsx')) return 'xlsx'
          if (id.includes('node_modules/jspdf')) return 'jspdf'
          if (id.includes('node_modules/html2canvas')) return 'html2canvas'
          if (id.includes('node_modules/three') || id.includes('@react-three')) return 'three'

          // ── React core — cached across all pages ─────────────────────
          if (id.includes('node_modules/react-dom')) return 'react-dom'
          if (id.includes('node_modules/react-router')) return 'react-router'
          if (id.includes('node_modules/react/')) return 'react'

          // ── Admin dashboard — lazy-loaded when admin logs in ─────────
          if (id.includes('src/pages/admin')) return 'admin'

          // ── Heavy page bundles — split so main stays light ───────────
          if (id.includes('src/pages/ClubGallery')) return 'gallery'
          if (id.includes('src/pages/Competitions') ||
            id.includes('src/components/Competition')) return 'competitions'
          if (id.includes('src/pages/Activities') ||
            id.includes('src/components/Activity')) return 'activities'
          if (id.includes('src/components/magazine') ||
            id.includes('src/pages/Magazine')) return 'magazine'
        },
      },
    },
    chunkSizeWarningLimit: 600,
  },
})
