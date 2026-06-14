import * as fs from 'fs';
import * as path from 'path';
import { writeConfig } from './config';

export type ScaffoldPreset = 'minimal' | 'full';
export type ScaffoldType = 'ui' | 'language' | 'empty';

export interface ScaffoldOptions {
  name: string;
  displayName: string;
  description: string;
  publisher: string;
  ui: 'react';
  targetDir: string;
  templatesRoot: string;
  /** Extension shape. Default: 'ui'. */
  type?: ScaffoldType;
  /** UI preset — only used when type === 'ui'. */
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

  const type = opts.type ?? 'ui';
  const vars = buildVars(opts);
  await copyTree(src, opts.targetDir, vars);
  applyType(opts.targetDir, type, opts.preset ?? 'full', opts.templatesRoot, vars);
  writeConfig(opts.targetDir, {
    publisher: opts.publisher,
    commandPrefix: vars.commandPrefix,
    type,
    // 'ui' is the only framework available; omit it for non-ui shapes.
    ...(type === 'ui' ? { ui: opts.ui } : {}),
  });
}

function applyType(
  targetDir: string,
  type: ScaffoldType,
  preset: ScaffoldPreset,
  templatesRoot: string,
  vars: Record<string, string>,
) {
  if (type === 'ui') {
    applyPreset(targetDir, preset);
    return;
  }
  // 'language' and 'empty' both start from a bare (no React/webview) extension.
  stripWebview(targetDir);
  if (type === 'language') applyLanguage(targetDir, templatesRoot, vars);
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

/**
 * Turn the React/webview base template into a bare extension: remove the sample
 * panel + command + webview tree + RPC contract, and drop React/Vite from
 * package.json (deps + UI build scripts). Keeps extension.ts, gen.ts and the
 * esbuild-based ext build intact.
 */
function stripWebview(targetDir: string) {
  const removals = [
    'src/panels',
    'src/webview',
    'src/commands/hello.ts',
    'vite.config.ts',
  ];
  for (const rel of removals) {
    const abs = path.join(targetDir, rel);
    if (fs.existsSync(abs)) fs.rmSync(abs, { recursive: true, force: true });
  }
  // Reset the RPC contract to an empty stub (kept so future panels can be added).
  const apiPath = path.join(targetDir, 'src', 'shared', 'api.ts');
  if (fs.existsSync(apiPath)) {
    fs.writeFileSync(apiPath, `// RPC contracts go here (add a panel with \`vsceasy panel add\`).\n`);
  }
  trimReactFromPackageJson(targetDir);
}

const REACT_DEPS = new Set([
  'react', 'react-dom', '@types/react', '@types/react-dom',
  '@vitejs/plugin-react', 'vite',
]);
// Build scripts that drive the Vite/React UI bundle — dropped for non-ui types.
const UI_SCRIPT_KEYS = new Set(['dev:ui', 'build:ui']);

function trimReactFromPackageJson(targetDir: string) {
  const pkgPath = path.join(targetDir, 'package.json');
  if (!fs.existsSync(pkgPath)) return;
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  for (const section of ['dependencies', 'devDependencies'] as const) {
    if (!pkg[section]) continue;
    for (const dep of Object.keys(pkg[section])) {
      if (REACT_DEPS.has(dep)) delete pkg[section][dep];
    }
    if (Object.keys(pkg[section]).length === 0) delete pkg[section];
  }
  if (pkg.scripts) {
    for (const key of Object.keys(pkg.scripts)) {
      if (UI_SCRIPT_KEYS.has(key)) delete pkg.scripts[key];
    }
    // Rewrite composite scripts that reference the (now removed) UI bundle.
    // `dev` ran ext+ui concurrently → just watch the extension build.
    if (pkg.scripts.dev) {
      pkg.scripts.dev = 'bun run gen:scan && bun run dev:ext';
    }
    // Strip any `&& bun run build:ui` tail from build/build:prod etc.
    for (const [k, v] of Object.entries(pkg.scripts) as [string, string][]) {
      pkg.scripts[k] = v.replace(/\s*&&\s*bun run build:ui/g, '');
    }
  }
  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
}

/**
 * Materialize the language-support skeleton from templates/_assets/language/
 * into the project root: grammar, language-configuration, snippets, opt-in
 * icon theme, and a contributes.extra.json wiring them up. Filenames and file
 * contents are both {{var}}-substituted.
 */
function applyLanguage(targetDir: string, templatesRoot: string, vars: Record<string, string>) {
  const assetsDir = path.join(templatesRoot, '_assets', 'language');
  if (!fs.existsSync(assetsDir)) {
    throw new Error(`Language assets not found: ${assetsDir}`);
  }
  copyAssetsTree(assetsDir, targetDir, vars);
  // The language README replaces the React template README.
  const langReadme = path.join(targetDir, 'README.language.md');
  if (fs.existsSync(langReadme)) {
    fs.renameSync(langReadme, path.join(targetDir, 'README.md'));
  }
  // Activate on the language so the auto-colorize onActivate hook runs.
  const pkgPath = path.join(targetDir, 'package.json');
  if (fs.existsSync(pkgPath)) {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    pkg.activationEvents = [`onLanguage:${vars.langId}`];
    fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
  }
}

/** Like copyTree but substitutes {{vars}} in BOTH filenames and content. */
function copyAssetsTree(srcDir: string, destDir: string, vars: Record<string, string>) {
  for (const entry of fs.readdirSync(srcDir, { withFileTypes: true })) {
    if (SKIP_NAMES.has(entry.name)) continue;
    const srcPath = path.join(srcDir, entry.name);
    const destName = substitute(entry.name, vars);
    const destPath = path.join(destDir, destName);
    if (entry.isDirectory()) {
      fs.mkdirSync(destPath, { recursive: true });
      copyAssetsTree(srcPath, destPath, vars);
    } else if (entry.isFile()) {
      fs.mkdirSync(path.dirname(destPath), { recursive: true });
      fs.writeFileSync(destPath, substitute(fs.readFileSync(srcPath, 'utf8'), vars));
    }
  }
}

function buildVars(opts: ScaffoldOptions): Record<string, string> {
  const simpleName = opts.name.replace(/^@[^/]+\//, '');
  const commandPrefix = simpleName.replace(/[^a-zA-Z0-9]+/g, '');
  // Language identity, derived from the package name; refined by the user after.
  const langId = simpleName.toLowerCase().replace(/[^a-z0-9]+/g, '');
  const scopeName = `source.${langId}`;
  const langExt = langId.slice(0, 4).toUpperCase();
  return {
    name: opts.name,
    displayName: opts.displayName,
    description: opts.description,
    publisher: opts.publisher,
    commandPrefix,
    langId,
    scopeName,
    langExt,
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
