import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [
    react({
      jsxImportSource: 'react',
    }),
  ],
  optimizeDeps: {
    include: ['react', 'react-dom', 'zustand', 'zustand/shallow', 'zustand/middleware', 'zustand/context', 'use-sync-external-store', 'use-sync-external-store/shim', 'use-sync-external-store/shim/with-selector'],
    exclude: ['chunk-DRWLMN53', 'chunk-PJEEZAML'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
    dedupe: ['react', 'react-dom', 'react-router-dom', 'zustand', 'use-sync-external-store'],
  },
  css: {
    modules: {
      localsConvention: 'camelCase',
    },
  },
  build: {
    commonjsOptions: {
      transformMixedEsModules: true,
    },
    outDir: 'dist/client',
    emptyOutDir: true,
    chunkSizeWarningLimit: 500,
    minify: 'esbuild',
    target: 'esnext',
  },
  server: {
    port: 5181,
    strictPort: false,
    host: '0.0.0.0',
    hmr: {
      overlay: true,
    },
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
  cacheDir: 'node_modules/.vite',
})
