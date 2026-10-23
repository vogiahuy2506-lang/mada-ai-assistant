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
    alias: [
      { find: /^@\//, replacement: path.resolve(__dirname, './src') + '/' },
      // ⭐ Gom MỌI biến thể của react về đúng một entry duy nhất. Nếu để Vite
      // tự optimize từng subpath, react và react-dom có thể nhận 2 instance
      // riêng → 2 ReactCurrentDispatcher → hook đọc dispatcher null.
      { find: /^react\/jsx-dev-runtime$/, replacement: path.resolve(__dirname, './node_modules/react/jsx-dev-runtime.js') },
      { find: /^react\/jsx-runtime$/, replacement: path.resolve(__dirname, './node_modules/react/jsx-runtime.js') },
      { find: /^react-dom\/client$/, replacement: path.resolve(__dirname, './node_modules/react-dom/client.js') },
      { find: /^react-dom$/, replacement: path.resolve(__dirname, './node_modules/react-dom/index.js') },
      { find: /^react$/, replacement: path.resolve(__dirname, './node_modules/react/index.js') },
    ],
    dedupe: ['react', 'react-dom', 'react-router-dom', 'zustand', 'use-sync-external-store'],
  },
  // Ép toàn bộ import react/react-dom (kể cả deep import như
  // 'react/jsx-dev-runtime') về đúng một instance trong node_modules.
  // Nếu không, Vite có thể sinh 2 pre-bundle riêng cho react (mỗi cái một
  // browserHash khác nhau) → 2 ReactCurrentDispatcher độc lập →
  // "Cannot read properties of null (reading 'useRef')" ở mọi trang.
  optimizeDeps: {
    include: ['react', 'react-dom', 'react-dom/client', 'react/jsx-runtime', 'react/jsx-dev-runtime', 'scheduler'],
    // ⭐ Dừng Vite re-optimize giữa chừng (giữa lúc trình duyệt đang nạp).
    // Mỗi lần re-optimize sinh browserHash mới; nếu trình duyệt đã nạp module
    // của hash cũ, react và react-dom sẽ chạy trên HAI instance khác nhau →
    // "Cannot read properties of null (reading 'useEffect')" trong mọi component.
    holdUntilCrawlEnd: true,
    force: true,
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
        target: process.env.VITE_PROXY_TARGET || 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
  cacheDir: 'node_modules/.vite',
})
