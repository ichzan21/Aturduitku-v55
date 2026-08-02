import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const appVersion = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 12)
  || process.env.GITHUB_SHA?.slice(0, 12)
  || 'local'

export default defineConfig({
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify(appVersion),
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          if (id.includes('firebase')) return 'firebase-vendor';
          if (id.includes('recharts') || id.includes('d3-')) return 'charts-vendor';
          if (id.includes('pdfjs-dist')) return 'pdf-vendor';
          return 'vendor';
        },
      },
    },
    chunkSizeWarningLimit: 600,
  },
})
