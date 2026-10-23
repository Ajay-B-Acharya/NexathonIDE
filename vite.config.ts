import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/ws': {
        target: 'ws://localhost:3001',
        ws: true,
      },
    },
  },
  build: {
    target: 'esnext',
    minify: 'esbuild',
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: (id: string) => {
          if (id.includes('node_modules')) {
            if (id.includes('react') || id.includes('react-dom')) return 'vendor';
            if (id.includes('@monaco-editor')) return 'monaco';
            if (id.includes('yjs') || id.includes('y-monaco') || id.includes('y-websocket') || id.includes('y-protocols')) return 'yjs';
            if (id.includes('@xterm')) return 'xterm';
            if (id.includes('pyodide') || id.includes('quickjs')) return 'execution';
            return 'vendor';
          }
        },
      },
      external: ['monaco-editor/esm/vs/editor/editor.api.js'],
    },
  },
  optimizeDeps: {
    include: ['yjs', 'y-monaco', 'y-websocket', 'y-protocols'],
    exclude: ['@xterm/xterm', 'monaco-editor/esm/vs/editor/editor.api.js'],
  },
  worker: {
    format: 'es',
  },
});