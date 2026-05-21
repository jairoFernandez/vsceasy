#!/usr/bin/env bun
// Scans src/panels, src/commands, and src/menus; writes src/extension/_registry.ts
// and syncs package.json#contributes (commands, viewsContainers, views).

import * as fs from 'fs';
import * as path from 'path';

const ROOT = process.cwd();
const SRC = path.join(ROOT, 'src');
const PANELS_DIR = path.join(SRC, 'panels');
const COMMANDS_DIR = path.join(SRC, 'commands');
const MENUS_DIR = path.join(SRC, 'menus');
const OUT = path.join(SRC, 'extension', '_registry.ts');
const PKG_PATH = path.join(ROOT, 'package.json');

interface Discovered {
  id: string;
  importPath: string;
}

function scan(dir: string, registryDir: string): Discovered[] {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isFile() && /\.(ts|tsx)$/.test(e.name) && !e.name.startsWith('_'))
    .map((e) => {
      const id = e.name.replace(/\.(ts|tsx)$/, '');
      const abs = path.join(dir, e.name);
      const rel = path.relative(registryDir, abs).replace(/\\/g, '/').replace(/\.(ts|tsx)$/, '');
      const importPath = rel.startsWith('.') ? rel : `./${rel}`;
      return { id, importPath };
    });
}

function writeRegistry(
  panels: Discovered[],
  commands: Discovered[],
  menus: Discovered[],
  prefix: string,
) {
  const lines: string[] = [
    '// AUTO-GENERATED — do not edit. Run `bun run gen`.',
    `import type { Registry } from '../shared/vsxf';`,
    ...panels.map((p, i) => `import panel${i} from '${p.importPath}';`),
    ...commands.map((c, i) => `import command${i} from '${c.importPath}';`),
    ...menus.map((m, i) => `import menu${i} from '${m.importPath}';`),
    '',
    'export const registry: Registry = {',
    `  prefix: ${JSON.stringify(prefix)},`,
    '  panels: {',
    ...panels.map((p, i) => `    ${JSON.stringify(p.id)}: panel${i},`),
    '  },',
    '  commands: {',
    ...commands.map((c, i) => `    ${JSON.stringify(c.id)}: command${i},`),
    '  },',
    '  menus: {',
    ...menus.map((m, i) => `    ${JSON.stringify(m.id)}: menu${i},`),
    '  },',
    '};',
    '',
  ];
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, lines.join('\n'));
}

function syncPackageJson(
  panels: Discovered[],
  commands: Discovered[],
  menus: Discovered[],
  prefix: string,
  displayName: string,
) {
  const pkg = JSON.parse(fs.readFileSync(PKG_PATH, 'utf8'));
  const contributes = (pkg.contributes ??= {});
  const cmds: Array<{ command: string; title: string; category?: string }> = [];

  for (const c of commands) {
    const def = loadDef(path.join(COMMANDS_DIR, c.id + '.ts')) ?? loadDef(path.join(COMMANDS_DIR, c.id + '.tsx'));
    cmds.push({
      command: `${prefix}.${def?.id ?? c.id}`,
      title: def?.title ?? c.id,
      category: def?.category ?? displayName,
    });
  }
  for (const p of panels) {
    const def = loadDef(path.join(PANELS_DIR, p.id + '.ts')) ?? loadDef(path.join(PANELS_DIR, p.id + '.tsx'));
    if (def?.command === false) continue;
    const opts = typeof def?.command === 'object' ? def!.command : {};
    cmds.push({
      command: `${prefix}.open${capitalize(def?.id ?? p.id)}`,
      title: (opts as any).title ?? `Open ${def?.title ?? p.id}`,
      category: (opts as any).category ?? displayName,
    });
  }

  contributes.commands = cmds;

  // Menus → viewsContainers.activitybar + views.<containerId>
  const containers: Array<{ id: string; title: string; icon: string }> = [];
  const views: Record<string, Array<{ id: string; name: string }>> = {};
  for (const m of menus) {
    const def = loadMenuDef(path.join(MENUS_DIR, m.id + '.ts')) ?? loadMenuDef(path.join(MENUS_DIR, m.id + '.tsx'));
    // VS Code requires viewsContainer / view ids to match /^[A-Za-z0-9_-]+$/ — no dots.
    const containerId = `${prefix}-${def?.id ?? m.id}`;
    const title = def?.title ?? m.id;
    const icon = resolveIconForPkg(def?.icon);
    containers.push({ id: containerId, title, icon });
    views[containerId] = [{ id: containerId, name: title }];
  }
  if (containers.length) {
    (contributes.viewsContainers ??= {}).activitybar = containers;
    contributes.views = views;
  } else {
    delete contributes.viewsContainers?.activitybar;
    if (contributes.viewsContainers && Object.keys(contributes.viewsContainers).length === 0) {
      delete contributes.viewsContainers;
    }
    delete contributes.views;
  }

  fs.writeFileSync(PKG_PATH, JSON.stringify(pkg, null, 2) + '\n');
}

function loadDef(file: string): { id?: string; title?: string; category?: string; command?: any } | null {
  if (!fs.existsSync(file)) return null;
  const src = fs.readFileSync(file, 'utf8');
  const grab = (key: string) => {
    const m = new RegExp(`\\b${key}\\s*:\\s*(['"\`])((?:\\\\.|(?!\\1).)*)\\1`).exec(src);
    return m?.[2];
  };
  const command =
    /\bcommand\s*:\s*false\b/.test(src) ? false :
    /\bcommand\s*:\s*true\b/.test(src) ? true :
    undefined;
  return { id: grab('id'), title: grab('title'), category: grab('category'), command };
}

interface MenuLoaded {
  id?: string;
  title?: string;
  icon?: string | { path?: string; light?: string; dark?: string };
}

function loadMenuDef(file: string): MenuLoaded | null {
  if (!fs.existsSync(file)) return null;
  const src = fs.readFileSync(file, 'utf8');
  const grab = (key: string) => {
    const m = new RegExp(`\\b${key}\\s*:\\s*(['"\`])((?:\\\\.|(?!\\1).)*)\\1`).exec(src);
    return m?.[2];
  };
  let icon: MenuLoaded['icon'];
  const iconString = grab('icon');
  if (iconString !== undefined) {
    icon = iconString;
  } else {
    // Try object form: icon: { path: '...' } OR { light: '...', dark: '...' }
    const objMatch = /\bicon\s*:\s*\{([^}]+)\}/.exec(src);
    if (objMatch) {
      const body = objMatch[1];
      const p = /\bpath\s*:\s*(['"\`])((?:\\.|(?!\1).)*)\1/.exec(body);
      const l = /\blight\s*:\s*(['"\`])((?:\\.|(?!\1).)*)\1/.exec(body);
      const d = /\bdark\s*:\s*(['"\`])((?:\\.|(?!\1).)*)\1/.exec(body);
      if (p) icon = { path: p[2] };
      else if (l && d) icon = { light: l[2], dark: d[2] };
    }
  }
  return { id: grab('id'), title: grab('title'), icon };
}

function resolveIconForPkg(icon: MenuLoaded['icon']): string {
  // VS Code's viewsContainers.activitybar.icon must be a string (path to SVG or codicon ref via "$(name)").
  if (!icon) return '$(symbol-misc)';
  if (typeof icon === 'string') return `$(${icon})`;
  if ('path' in icon && icon.path) return icon.path;
  if ('light' in icon && icon.light) return icon.light;
  return '$(symbol-misc)';
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function ensurePanelHtml(panels: Discovered[]) {
  const webviewDir = path.join(SRC, 'webview', 'panels');
  for (const p of panels) {
    const dir = path.join(webviewDir, p.id);
    if (!fs.existsSync(dir)) continue;
    const htmlPath = path.join(dir, 'index.html');
    if (fs.existsSync(htmlPath)) continue;
    const mainCandidates = ['main.tsx', 'main.ts', 'index.tsx', 'index.ts'];
    const main = mainCandidates.find((f) => fs.existsSync(path.join(dir, f))) ?? 'main.tsx';
    fs.writeFileSync(
      htmlPath,
      `<!DOCTYPE html>
<html><head><meta charset="UTF-8" /></head>
<body><div id="root"></div><script type="module" src="./${main}"></script></body>
</html>
`,
    );
  }
}

function main() {
  const pkg = JSON.parse(fs.readFileSync(PKG_PATH, 'utf8'));
  const prefix: string =
    pkg.vsxf?.commandPrefix ?? pkg.name.replace(/^@[^/]+\//, '').replace(/[^a-zA-Z0-9]+/g, '');
  const displayName: string = pkg.displayName ?? pkg.name;

  const registryDir = path.dirname(OUT);
  const panels = scan(PANELS_DIR, registryDir);
  const commands = scan(COMMANDS_DIR, registryDir);
  const menus = scan(MENUS_DIR, registryDir);

  writeRegistry(panels, commands, menus, prefix);
  syncPackageJson(panels, commands, menus, prefix, displayName);
  ensurePanelHtml(panels);

  console.log(
    `✓ vsxf gen → ${panels.length} panel(s), ${commands.length} command(s), ${menus.length} menu(s)`,
  );
}

main();
