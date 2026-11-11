import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from 'tailwindcss';
import autoprefixer from 'autoprefixer';

// Run all commands from the project root. The React app lives in /client.
export default defineConfig({
  root: 'client',
  plugins: [react()],
  css: { postcss: { plugins: [tailwindcss({ config: './tailwind.config.js' }), autoprefixer()] } },
  build: { outDir: '../dist', emptyOutDir: true },
  server: { port: 5173, proxy: { '/api': 'http://localhost:3001' } },
});
