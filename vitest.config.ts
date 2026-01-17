import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'happy-dom',
    globals: true,
    include: ['packages/**/*.test.ts', 'packages/**/*.test.tsx'],
  },
});
