import * as fs from 'fs';
import * as path from 'path';

export interface ScaffoldOptions {
  name: string;
  displayName: string;
  description: string;
  publisher: string;
  ui: 'react';
  targetDir: string;
  templatesRoot: string;
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
