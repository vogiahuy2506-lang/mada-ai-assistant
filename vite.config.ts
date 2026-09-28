import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [
    react({
      // Ensure consistent JSX runtime
      jsxImportSource: 'react',
    }),
  ],
  optimizeDeps: {
    include: ['react', 'react-dom', 'react-dom/client'],
    exclude: ['mammoth', 'pdfjs-dist'],
    // Force re-bundle React to avoid multiple instances
    esbuildOptions: {
      define: {
        'process.env.NODE_ENV': '"development"',
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      // Ensure single React instance
      'react': path.resolve(__dirname, 'node_modules/react'),
      'react-dom': path.resolve(__dirname, 'node_modules/react-dom'),
    },
  },
  server: {
    port: 5173,
    strictPort: false,
    // Force full reload on certain file changes to avoid HMR issues
    watch: {
      ignored: ['**/node_modules/**', '**/.git/**'],
    },
    hmr: {
      // Overlay to show errors
      overlay: true,
      // Force connection through WebSocket
      overlayLimit: 5,
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
  build: {
    outDir: 'dist/client',
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          // Put all React-related modules in the same chunk to avoid multiple React instances
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
    // Minimize runtime errors
    minify: 'esbuild',
    target: 'esnext',
  },
  // Clear cache on rebuild
  cacheDir: 'node_modules/.vite',
})
