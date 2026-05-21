import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import * as fs from 'fs';
import * as path from 'path';

const PANELS_UI_DIR = path.resolve(__dirname, 'src/webview/panels');

function discoverPanelHtmlEntries(): Record<string, string> {
  if (!fs.existsSync(PANELS_UI_DIR)) return {};
  const out: Record<string, string> = {};
  for (const entry of fs.readdirSync(PANELS_UI_DIR, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const html = path.join(PANELS_UI_DIR, entry.name, 'index.html');
    if (fs.existsSync(html)) out[entry.name] = html;
  }
  return out;
}

const entries = discoverPanelHtmlEntries();

export default defineConfig({
  plugins: [react()],
  root: PANELS_UI_DIR,
  build: {
    outDir: path.resolve(__dirname, 'dist/webview'),
    emptyOutDir: true,
    rollupOptions: {
      input: entries,
      output: {
        // Each panel's main JS lands at <id>/index.js, CSS at <id>/index.css.
        entryFileNames: '[name]/index.js',
        chunkFileNames: 'chunks/[name]-[hash].js',
        assetFileNames: (info) => {
          if (info.name?.endsWith('.css')) return '[name]/index.css';
          return 'assets/[name]-[hash].[ext]';
        },
      },
    },
  },
});
