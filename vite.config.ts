import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    include: ['react', 'react-dom', 'react-router-dom', 'zustand'],
    // Exclude libraries that bundle their own React - causes "Cannot read properties of null" errors
    exclude: ['mammoth', 'pdfjs-dist'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    strictPort: false,
    proxy: {
      '/api': {
        target: 'http://localhost:4567',
        changeOrigin: true,
      },
      '/ws': {
        target: 'ws://localhost:4567',
        ws: true,
      },
    },
  },
  build: {
    outDir: 'dist/client',
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-lucide': ['lucide-react'],
          'vendor-utils': ['clsx', 'date-fns'],
        },
      },
    },
    reportCompressedSize: true,
    chunkSizeWarningLimit: 500,
  },
})
