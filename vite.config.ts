import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:8888/.netlify/functions/api',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
      '/webhook': {
        target: 'http://localhost:8888/.netlify/functions/api/webhook',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/webhook/, ''),
      },
      '/health': {
        target: 'http://localhost:8888/.netlify/functions/api/health',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/health/, ''),
      }
    }
  }
});