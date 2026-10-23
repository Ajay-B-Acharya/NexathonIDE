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
      'monaco-editor/esm/vs/editor/editor.api.js': 'monaco-editor',
      'monaco-editor/esm/vs/editor/editor.api': 'monaco-editor',
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
      external: [],
    },
  },
  optimizeDeps: {
    include: ['yjs', 'y-monaco', 'y-websocket', 'y-protocols/awareness', 'y-protocols/sync'],
    exclude: ['@xterm/xterm'],
  },
  worker: {
    format: 'es',
  },
});
