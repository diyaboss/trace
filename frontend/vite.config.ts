import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fixtureApi } from './dev/fixtureApi.ts';

// Default: every /api request goes to the real Java API on loopback.
// `--mode fixtures` (npm run dev:fixtures) instead answers /api from an
// in-memory, contract-shaped dataset. It is never active unless that mode
// is chosen explicitly, and it is never part of the production build.
export default defineConfig(({ mode, command }) => {
  const fixtures = command === 'serve' && mode === 'fixtures';
  return {
    plugins: [react(), ...(fixtures ? [fixtureApi()] : [])],
    server: {
      port: 5173,
      strictPort: true,
      proxy: fixtures ? undefined : { '/api': { target: 'http://127.0.0.1:7000', changeOrigin: false } },
    },
  };
});
