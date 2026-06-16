/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// CamHeart is a 100% client-side app — no backend, no SSR.
export default defineConfig({
  plugins: [react()],
  server: {
    // getUserMedia requires a secure context; localhost counts as secure.
    host: true,
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    globals: false,
  },
});
