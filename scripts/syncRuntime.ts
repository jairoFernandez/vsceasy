#!/usr/bin/env bun
/**
 * Single source of truth for the runtime is `packages/vsceasy-runtime/src/`.
 * This script copies it into `templates/react/src/shared/vsceasy/` so the
 * bundled template stays consistent. Run from package.json `build` before tsc.
 */
import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'packages', 'vsceasy-runtime', 'src');
const DEST = path.join(ROOT, 'templates', 'react', 'src', 'shared', 'vsceasy');

if (!fs.existsSync(SRC)) {
  console.error(`✗ runtime source missing at ${SRC}`);
  process.exit(1);
}

fs.mkdirSync(DEST, { recursive: true });

// Wipe any stale files (don't touch unrelated dirs)
for (const f of fs.readdirSync(DEST)) {
  if (f.endsWith('.ts') || f.endsWith('.js')) {
    fs.rmSync(path.join(DEST, f));
  }
}

let n = 0;
for (const f of fs.readdirSync(SRC)) {
  if (!f.endsWith('.ts')) continue;
  fs.copyFileSync(path.join(SRC, f), path.join(DEST, f));
  n++;
}

console.log(`✓ synced ${n} runtime file(s) → templates/react/src/shared/vsceasy/`);
