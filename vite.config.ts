/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// CamHeart is a 100% client-side app — no backend, no SSR.
// Served from a GitHub Pages project path (/CamHeart/) in production, but at the
// root during local dev so `npm run dev` stays simple.
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/CamHeart/' : '/',
  plugins: [react()],
  server: {
    // getUserMedia needs a secure context; localhost counts as secure.
    host: true,
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    globals: false,
  },
}));
