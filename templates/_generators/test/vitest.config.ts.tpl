import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    environment: 'node',
    globals: false,
    coverage: {
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/extension/_registry.ts', 'src/webview/**'],
    },
  },
});
