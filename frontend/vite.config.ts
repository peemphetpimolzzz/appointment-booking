import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// During `npm run dev` (outside Docker) proxy API calls to the locally mapped API port.
// In the container the same /api path is served by nginx, so the app always uses relative URLs.
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8082',
        changeOrigin: true,
      },
    },
  },
});
