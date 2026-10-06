import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: 3000,
    open: true,
    host: true
  },
  optimizeDeps: {
    include: ['@mediapipe/tasks-vision']
  }
});
