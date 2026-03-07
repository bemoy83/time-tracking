import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    environmentMatchGlobs: [['**/hooks/*.test.ts', 'jsdom']],
  },
});
