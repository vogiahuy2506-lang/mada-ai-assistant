import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [
    react({
      jsxImportSource: 'react',
    }),
  ],
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
        // PORT của server thật — xem log: "MADA AI Server running on http://0.0.0.0:PORT"
        target: process.env.VITE_PROXY_TARGET || 'http://localhost:3008',
        changeOrigin: true,
      },
    },
  },
  cacheDir: 'node_modules/.vite',
})
