import { defineConfig } from 'vitest/config';
import * as path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      // `vscode` is only available inside the extension host. Tests stub it
      // with an empty module so importing any file that does `import * as vscode`
      // doesn't crash. Use `mockVscode()` from `_helpers.ts` for the surface
      // you actually need to assert against.
      vscode: path.resolve(__dirname, 'src/__tests__/__mocks__/vscode.ts'),
    },
  },
  test: {
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    environment: 'node',
    globals: false,
    coverage: {
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/extension/_registry.ts', 'src/webview/**', 'src/__tests__/**'],
    },
  },
});
