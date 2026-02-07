import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: '/audio_visualizer/',
  server: {
    host: true
  }
});
