import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
    // `server-only` throws outside Next.js server bundles; unit tests import server modules directly.
    alias: { 'server-only': fileURLToPath(new URL('./tests/stubs/empty.ts', import.meta.url)) },
  },
  test: {
    environment: 'node',
    include: ['tests/unit/**/*.test.ts'],
    env: { TZ: 'Asia/Kolkata' },
  },
});
