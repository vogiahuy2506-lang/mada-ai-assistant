import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    include: ['react', 'react-dom'],
    // Exclude libraries that bundle their own React
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
        target: 'http://localhost:3007',
        changeOrigin: true,
      },
      '/ws': {
        target: 'ws://localhost:3007',
        ws: true,
      },
    },
  },
  build: {
    outDir: 'dist/client',
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          // Put all React-related modules in the same chunk
          if (id.includes('node_modules/react') || id.includes('node_modules/react-dom') || id.includes('node_modules/react-router-dom')) {
            return 'vendor-react';
          }
          if (id.includes('node_modules/zustand')) {
            return 'vendor-zustand';
          }
          if (id.includes('node_modules/lucide-react')) {
            return 'vendor-lucide';
          }
          if (id.includes('node_modules/clsx') || id.includes('node_modules/date-fns')) {
            return 'vendor-utils';
          }
        },
      },
    },
    reportCompressedSize: true,
    chunkSizeWarningLimit: 500,
  },
})
