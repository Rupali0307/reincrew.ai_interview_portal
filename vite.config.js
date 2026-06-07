import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    host: true, // listen on all network interfaces so phone can reach it
    port: 5173,
    strictPort: true
  }
});
