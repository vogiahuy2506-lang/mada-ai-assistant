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
    include: ['react', 'react-dom', 'zustand', 'zustand/middleware', 'use-sync-external-store'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      'react': path.resolve(__dirname, 'node_modules/react'),
      'react-dom': path.resolve(__dirname, 'node_modules/react-dom'),
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
    strictPort: true,
    host: '0.0.0.0',
    hmr: {
      overlay: true,
    },
    proxy: {
      '/api': {
        target: 'http://localhost:3008',
        changeOrigin: true,
      },
      '/ws': {
        target: 'ws://localhost:3008',
        ws: true,
      },
    },
  },
  cacheDir: 'node_modules/.vite',
})
