import * as fs from 'fs';
import * as path from 'path';
import { spawnSync } from 'child_process';

/**
 * Files owned by the framework. Always synced from the bundled templates
 * because users are not expected to edit them.
 */
const SYNC_PATHS: string[] = [
  'src/shared/vsxf/define.ts',
  'src/shared/vsxf/bootstrap.ts',
  'src/shared/vsxf/rpc.ts',
  'src/shared/vsxf/client.ts',
  'src/shared/vsxf/index.ts',
  'src/shared/vsxf/codiconNames.ts',
  'scripts/gen.ts',
  'vite.config.ts',
];

export type UpgradeStatus = 'in-sync' | 'would-create' | 'would-update' | 'created' | 'updated' | 'missing-source';

export interface FileChange {
  path: string;
  status: UpgradeStatus;
}

export interface UpgradeOptions {
  projectRoot: string;
  /** Bundled templates root (output of findTemplatesRoot). */
  templatesRoot: string;
  /** UI variant subfolder. Default 'react'. */
  ui?: string;
  /** Apply changes. Default false (dry-run). */
  apply?: boolean;
  /** Run `bun run gen` after apply. Default true when apply, ignored on dry-run. */
  runGen?: boolean;
}

export interface UpgradeResult {
  changes: FileChange[];
  applied: boolean;
  genRan: boolean;
}

export function upgrade(opts: UpgradeOptions): UpgradeResult {
  const ui = opts.ui ?? 'react';
  const sourceRoot = path.join(opts.templatesRoot, ui);
  if (!fs.existsSync(sourceRoot)) {
    throw new Error(`Templates UI not found: ${sourceRoot}`);
  }

  const changes: FileChange[] = [];
  for (const rel of SYNC_PATHS) {
    const src = path.join(sourceRoot, rel);
    const dest = path.join(opts.projectRoot, rel);

    if (!fs.existsSync(src)) {
      changes.push({ path: rel, status: 'missing-source' });
      continue;
    }

    if (!fs.existsSync(dest)) {
      if (opts.apply) {
        fs.mkdirSync(path.dirname(dest), { recursive: true });
        fs.copyFileSync(src, dest);
        changes.push({ path: rel, status: 'created' });
      } else {
        changes.push({ path: rel, status: 'would-create' });
      }
      continue;
    }

    const same = filesEqual(src, dest);
    if (same) {
      changes.push({ path: rel, status: 'in-sync' });
    } else if (opts.apply) {
      fs.copyFileSync(src, dest);
      changes.push({ path: rel, status: 'updated' });
    } else {
      changes.push({ path: rel, status: 'would-update' });
    }
  }

  let genRan = false;
  if (opts.apply && opts.runGen !== false) {
    if (changes.some((c) => c.status === 'updated' || c.status === 'created')) {
      genRan = runGen(opts.projectRoot);
    }
  }

  return { changes, applied: !!opts.apply, genRan };
}

function filesEqual(a: string, b: string): boolean {
  const sa = fs.statSync(a);
  const sb = fs.statSync(b);
  if (sa.size !== sb.size) return false;
  return fs.readFileSync(a).equals(fs.readFileSync(b));
}

function runGen(cwd: string): boolean {
  const tryRun = (cmd: string, args: string[]) => {
    const r = spawnSync(cmd, args, { cwd, stdio: 'inherit' });
    return r.status === 0;
  };
  if (which('bun') && tryRun('bun', ['run', 'gen'])) return true;
  if (which('npm') && tryRun('npm', ['run', 'gen'])) return true;
  return false;
}

function which(cmd: string): boolean {
  const r = spawnSync(process.platform === 'win32' ? 'where' : 'which', [cmd], { stdio: 'ignore' });
  return r.status === 0;
}
