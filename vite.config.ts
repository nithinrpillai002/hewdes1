
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
        // Pointing to 8080 (node server.js) instead of 8888 (netlify dev) 
        // to ensure it works when running "node server.js" directly.
        target: 'http://localhost:8080/api', 
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
      '/webhook': {
        target: 'http://localhost:8080/webhook',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/webhook/, ''),
      },
      '/health': {
        target: 'http://localhost:8080/health',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/health/, ''),
      }
    }
  }
});
