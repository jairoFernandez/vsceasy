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
const STATUS_BARS_DIR = path.join(SRC, 'statusBars');
const SUBPANELS_DIR = path.join(SRC, 'subpanels');
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
  statusBars: Discovered[],
  subpanels: Discovered[],
  prefix: string,
) {
  const lines: string[] = [
    '// AUTO-GENERATED — do not edit. Run `bun run gen`.',
    `import type { Registry } from '../shared/vsceasy';`,
    ...panels.map((p, i) => `import panel${i} from '${p.importPath}';`),
    ...commands.map((c, i) => `import command${i} from '${c.importPath}';`),
    ...menus.map((m, i) => `import menu${i} from '${m.importPath}';`),
    ...statusBars.map((s, i) => `import statusBar${i} from '${s.importPath}';`),
    ...subpanels.map((w, i) => `import subpanel${i} from '${w.importPath}';`),
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
    '  statusBars: {',
    ...statusBars.map((s, i) => `    ${JSON.stringify(s.id)}: statusBar${i},`),
    '  },',
    '  subpanels: {',
    ...subpanels.map((w, i) => `    ${JSON.stringify(w.id)}: subpanel${i},`),
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
  subpanels: Discovered[],
  prefix: string,
  displayName: string,
) {
  const pkg = JSON.parse(fs.readFileSync(PKG_PATH, 'utf8'));
  const contributes = (pkg.contributes ??= {});
  const cmds: Array<{ command: string; title: string; category?: string }> = [];
  const keybindings: Array<{ command: string; key: string; mac?: string; when?: string }> = [];

  for (const c of commands) {
    const def = loadDef(path.join(COMMANDS_DIR, c.id + '.ts')) ?? loadDef(path.join(COMMANDS_DIR, c.id + '.tsx'));
    const fullId = `${prefix}.${def?.id ?? c.id}`;
    cmds.push({
      command: fullId,
      title: def?.title ?? c.id,
      category: def?.category ?? displayName,
    });
    if (def?.keybindings) {
      for (const kb of def.keybindings) {
        keybindings.push({
          command: fullId,
          key: kb.key,
          ...(kb.mac ? { mac: kb.mac } : {}),
          ...(kb.when ? { when: kb.when } : {}),
        });
      }
    }
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
  if (keybindings.length) {
    contributes.keybindings = keybindings;
  } else {
    delete contributes.keybindings;
  }

  // Menus → viewsContainers.activitybar + views.<containerId>
  const containers: Array<{ id: string; title: string; icon: string }> = [];
  const views: Record<string, Array<{ id: string; name: string; type?: 'webview' }>> = {};

  // Index subpanels by menu they belong to
  const wvByMenu: Record<string, Array<{ id: string; name: string }>> = {};
  for (const w of subpanels) {
    const def = loadSubpanelDef(path.join(SUBPANELS_DIR, w.id + '.ts'))
      ?? loadSubpanelDef(path.join(SUBPANELS_DIR, w.id + '.tsx'));
    if (!def?.menu) continue;
    const viewId = `${prefix}-${def.menu}-${def.id ?? w.id}`;
    const name = def.title ?? w.id;
    (wvByMenu[def.menu] ??= []).push({ id: viewId, name });
  }

  for (const m of menus) {
    const def = loadMenuDef(path.join(MENUS_DIR, m.id + '.ts')) ?? loadMenuDef(path.join(MENUS_DIR, m.id + '.tsx'));
    // VS Code requires viewsContainer / view ids to match /^[A-Za-z0-9_-]+$/ — no dots.
    const menuId = def?.id ?? m.id;
    const containerId = `${prefix}-${menuId}`;
    const title = def?.title ?? m.id;
    const icon = resolveIconForPkg(def?.icon);
    containers.push({ id: containerId, title, icon });
    const containerViews: Array<{ id: string; name: string; type?: 'webview' }> = [
      { id: containerId, name: title }, // primary tree view
    ];
    for (const v of wvByMenu[menuId] ?? []) {
      containerViews.push({ id: v.id, name: v.name, type: 'webview' });
    }
    views[containerId] = containerViews;
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

function loadDef(file: string): {
  id?: string;
  title?: string;
  category?: string;
  command?: any;
  keybindings?: Array<{ key: string; mac?: string; when?: string }>;
} | null {
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
  return {
    id: grab('id'),
    title: grab('title'),
    category: grab('category'),
    command,
    keybindings: parseKeybindings(src),
  };
}

/** Extract keybinding(s) declared on a defineCommand call. Supports string, object, or array shorthand. */
function parseKeybindings(src: string): Array<{ key: string; mac?: string; when?: string }> {
  // 1) Plain string:  keybinding: 'ctrl+shift+h'
  const stringMatch = /\bkeybinding\s*:\s*(['"`])([^'"`]+)\1\s*,?/.exec(src);
  if (stringMatch) return [{ key: stringMatch[2] }];

  // 2) Single object:  keybinding: { key: '...', mac?: '...', when?: '...' }
  const objMatch = /\bkeybinding\s*:\s*\{([^}]+)\}/.exec(src);
  if (objMatch) {
    const obj = parseKbObject(objMatch[1]);
    return obj ? [obj] : [];
  }

  // 3) Array shorthand: keybinding: [ 'ctrl+a', { key: 'ctrl+b', mac: 'cmd+b' } ]
  const arrMatch = /\bkeybinding\s*:\s*\[([\s\S]*?)\]/.exec(src);
  if (arrMatch) {
    const inner = arrMatch[1];
    const out: Array<{ key: string; mac?: string; when?: string }> = [];
    const strRe = /(['"`])([^'"`]+)\1/g;
    const objRe = /\{([^}]+)\}/g;
    let sm: RegExpExecArray | null;
    while ((sm = strRe.exec(inner))) out.push({ key: sm[2] });
    let om: RegExpExecArray | null;
    while ((om = objRe.exec(inner))) {
      const o = parseKbObject(om[1]);
      if (o) out.push(o);
    }
    return out;
  }
  return [];
}

function parseKbObject(body: string): { key: string; mac?: string; when?: string } | null {
  const grab = (key: string) => {
    const m = new RegExp(`\\b${key}\\s*:\\s*(['"\`])((?:\\\\.|(?!\\1).)*)\\1`).exec(body);
    return m?.[2];
  };
  const key = grab('key');
  if (!key) return null;
  const mac = grab('mac');
  const when = grab('when');
  return { key, ...(mac ? { mac } : {}), ...(when ? { when } : {}) };
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

interface SubpanelLoaded {
  id?: string;
  title?: string;
  menu?: string;
}

function loadSubpanelDef(file: string): SubpanelLoaded | null {
  if (!fs.existsSync(file)) return null;
  const src = fs.readFileSync(file, 'utf8');
  const grab = (key: string) => {
    const m = new RegExp(`\\b${key}\\s*:\\s*(['"\`])((?:\\\\.|(?!\\1).)*)\\1`).exec(src);
    return m?.[2];
  };
  return { id: grab('id'), title: grab('title'), menu: grab('menu') };
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
  ensureBundleHtml(path.join(SRC, 'webview', 'panels'), panels);
}

function ensureSubpanelHtml(views: Discovered[]) {
  ensureBundleHtml(path.join(SRC, 'webview', 'subpanels'), views);
}

function ensureBundleHtml(baseDir: string, entries: Discovered[]) {
  for (const e of entries) {
    const dir = path.join(baseDir, e.id);
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
    pkg.vsceasy?.commandPrefix ?? pkg.name.replace(/^@[^/]+\//, '').replace(/[^a-zA-Z0-9]+/g, '');
  const displayName: string = pkg.displayName ?? pkg.name;

  const registryDir = path.dirname(OUT);
  const panels = scan(PANELS_DIR, registryDir);
  const commands = scan(COMMANDS_DIR, registryDir);
  const menus = scan(MENUS_DIR, registryDir);
  const statusBars = scan(STATUS_BARS_DIR, registryDir);
  const subpanels = scan(SUBPANELS_DIR, registryDir);

  writeRegistry(panels, commands, menus, statusBars, subpanels, prefix);
  syncPackageJson(panels, commands, menus, subpanels, prefix, displayName);
  ensurePanelHtml(panels);
  ensureSubpanelHtml(subpanels);

  console.log(
    `✓ vsceasy gen → ${panels.length} panel(s), ${commands.length} command(s), ${menus.length} menu(s), ${statusBars.length} statusBar(s), ${subpanels.length} subpanel(s)`,
  );
}

main();
