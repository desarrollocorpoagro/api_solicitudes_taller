import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // Puerto del frontend (Vite dev server) - debe coincidir con package.json y server.ts.
      port: Number(process.env.FRONTEND_PORT) || 4100,
      strictPort: true,
      host: '0.0.0.0',
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
      proxy: {
        '/api': {
          target: `http://localhost:${Number(process.env.PORT) || 4000}`,
          changeOrigin: true,
        },
        '/uploads': {
          target: `http://localhost:${Number(process.env.PORT) || 4000}`,
          changeOrigin: true,
        },
      },
    },
  };
});
