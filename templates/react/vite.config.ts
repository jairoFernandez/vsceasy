import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import * as fs from 'fs';
import * as path from 'path';

const WEBVIEW_ROOT = path.resolve(__dirname, 'src/webview');

function discoverHtmlEntries(subdir: string): Record<string, string> {
  const dir = path.join(WEBVIEW_ROOT, subdir);
  if (!fs.existsSync(dir)) return {};
  const out: Record<string, string> = {};
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const html = path.join(dir, entry.name, 'index.html');
    // Key includes subdir so panel `dashboard` and subpanel `dashboard` never collide.
    if (fs.existsSync(html)) out[`${subdir}/${entry.name}`] = html;
  }
  return out;
}

const entries = {
  ...discoverHtmlEntries('panels'),
  ...discoverHtmlEntries('subpanels'),
};

export default defineConfig({
  plugins: [react()],
  root: WEBVIEW_ROOT,
  build: {
    outDir: path.resolve(__dirname, 'dist/webview'),
    emptyOutDir: true,
    manifest: 'manifest.json',
    rollupOptions: {
      input: entries,
      output: {
        entryFileNames: '[name]/index.js',
        chunkFileNames: 'chunks/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]',
      },
    },
  },
});
