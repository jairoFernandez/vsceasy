import * as fs from 'fs';
import * as path from 'path';
import { writeConfig } from './config';

export type ScaffoldPreset = 'minimal' | 'full';

export interface ScaffoldOptions {
  name: string;
  displayName: string;
  description: string;
  publisher: string;
  ui: 'react';
  targetDir: string;
  templatesRoot: string;
  preset?: ScaffoldPreset;
}

const PLACEHOLDER_EXTS = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.json', '.md', '.html', '.css', '.cjs', '.mjs',
  '.yml', '.yaml',
]);

const SKIP_NAMES = new Set(['node_modules', 'dist', '.DS_Store']);

export async function scaffold(opts: ScaffoldOptions): Promise<void> {
  const src = path.join(opts.templatesRoot, opts.ui);
  if (!fs.existsSync(src)) {
    throw new Error(`Template not found: ${src}`);
  }
  if (fs.existsSync(opts.targetDir) && fs.readdirSync(opts.targetDir).length > 0) {
    throw new Error(`Target directory not empty: ${opts.targetDir}`);
  }
  fs.mkdirSync(opts.targetDir, { recursive: true });

  const vars = buildVars(opts);
  await copyTree(src, opts.targetDir, vars);
  applyPreset(opts.targetDir, opts.preset ?? 'full');
  writeConfig(opts.targetDir, {
    publisher: opts.publisher,
    commandPrefix: vars.commandPrefix,
    ui: opts.ui,
  });
}

function applyPreset(targetDir: string, preset: ScaffoldPreset) {
  if (preset === 'full') return;
  // minimal: strip the sample panel + its webview bundle + RPC contract.
  const removals = [
    'src/panels/dashboard.ts',
    'src/webview/panels/dashboard',
  ];
  for (const rel of removals) {
    const abs = path.join(targetDir, rel);
    if (fs.existsSync(abs)) fs.rmSync(abs, { recursive: true, force: true });
  }
  // Reset src/shared/api.ts to an empty contract.
  const apiPath = path.join(targetDir, 'src', 'shared', 'api.ts');
  if (fs.existsSync(apiPath)) {
    fs.writeFileSync(
      apiPath,
      `// RPC contracts go here. One interface per panel/subpanel.\n// Example:\n// export interface DashboardApi {\n//   ping(): Promise<string>;\n// }\n`,
    );
  }
}

function buildVars(opts: ScaffoldOptions): Record<string, string> {
  const simpleName = opts.name.replace(/^@[^/]+\//, '');
  const commandPrefix = simpleName.replace(/[^a-zA-Z0-9]+/g, '');
  return {
    name: opts.name,
    displayName: opts.displayName,
    description: opts.description,
    publisher: opts.publisher,
    commandPrefix,
  };
}

async function copyTree(srcDir: string, destDir: string, vars: Record<string, string>) {
  for (const entry of fs.readdirSync(srcDir, { withFileTypes: true })) {
    if (SKIP_NAMES.has(entry.name)) continue;
    const srcPath = path.join(srcDir, entry.name);
    const destPath = path.join(destDir, entry.name);
    if (entry.isDirectory()) {
      fs.mkdirSync(destPath, { recursive: true });
      await copyTree(srcPath, destPath, vars);
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name);
      if (PLACEHOLDER_EXTS.has(ext) || entry.name.startsWith('.')) {
        const content = fs.readFileSync(srcPath, 'utf8');
        fs.writeFileSync(destPath, substitute(content, vars));
      } else {
        fs.copyFileSync(srcPath, destPath);
      }
    }
  }
}

export function substitute(input: string, vars: Record<string, string>): string {
  return input.replace(/\{\{(\w+)\}\}/g, (_m, key) => vars[key] ?? `{{${key}}}`);
}
