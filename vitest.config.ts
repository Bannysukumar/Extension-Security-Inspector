import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    include: ['test/**/*.test.ts'],
    exclude: ['src/test/**', 'out/**', 'dist/**', 'node_modules/**'],
    environment: 'node',
    reporters: ['default'],
  },
});
