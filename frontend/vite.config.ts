import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig(({ mode }) => ({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: { '/api': 'http://localhost:3000' },
    allowedHosts: ['.monkeycode-ai.live']
  },
  build: {
    // Production: minify, no source maps (not published / reverse-engineer harder)
    sourcemap: false,
    minify: 'esbuild',
    target: 'es2020',
    cssMinify: true,
    reportCompressedSize: false,
    rollupOptions: {
      output: {
        // Avoid readable module names in chunk file list
        manualChunks: undefined
      }
    }
  },
  esbuild: mode === 'production' ? {
    // Strip developer noise from production bundles
    drop: ['debugger'],
    legalComments: 'none'
  } : undefined
}));
