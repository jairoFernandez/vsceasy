import * as fs from 'fs';
import * as path from 'path';
import { listMenus, listPanels, listCommands } from './editMenu';
import { parseMenu, MenuNode } from './menuTree';
import { isKnownCodicon } from '../data/codicons';

export type CheckLevel = 'ok' | 'warn' | 'error';

export interface CheckResult {
  id: string;
  level: CheckLevel;
  message: string;
  /** Optional details printed indented under the line. */
  details?: string[];
}

export interface DoctorReport {
  projectRoot: string;
  displayName: string;
  results: CheckResult[];
  counts: { ok: number; warn: number; error: number };
}

export interface DoctorOptions {
  projectRoot: string;
}

export function runDoctor(opts: DoctorOptions): DoctorReport {
  const root = opts.projectRoot;
  const pkg = readPkg(root);
  const results: CheckResult[] = [];

  results.push(checkEngine(pkg));
  results.push(checkScripts(pkg));
  results.push(...checkPanels(root));
  results.push(...checkRpcContracts(root));
  results.push(...checkMenus(root));
  results.push(...checkStatusBars(root));
  results.push(checkContributesSync(root, pkg));
  results.push(checkGitignore(root));

  const counts = { ok: 0, warn: 0, error: 0 };
  for (const r of results) counts[r.level]++;

  return {
    projectRoot: root,
    displayName: pkg?.displayName ?? pkg?.name ?? path.basename(root),
    results,
    counts,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// individual checks

function checkEngine(pkg: any): CheckResult {
  const engine: string | undefined = pkg?.engines?.vscode;
  if (!engine) {
    return { id: 'engine', level: 'error', message: 'package.json missing engines.vscode' };
  }
  if (!/^[\^~>=]?\d+\.\d+/.test(engine)) {
    return { id: 'engine', level: 'warn', message: `engines.vscode looks malformed: ${engine}` };
  }
  return { id: 'engine', level: 'ok', message: `engines.vscode  ${engine}` };
}

function checkScripts(pkg: any): CheckResult {
  const scripts = pkg?.scripts ?? {};
  const required = ['gen', 'dev', 'launch', 'build'];
  const missing = required.filter((s) => typeof scripts[s] !== 'string');
  if (missing.length === 0) {
    return { id: 'scripts', level: 'ok', message: `scripts          ${required.join(', ')}` };
  }
  return {
    id: 'scripts',
    level: 'error',
    message: `missing scripts: ${missing.join(', ')}`,
  };
}

function checkPanels(root: string): CheckResult[] {
  const panels = listPanels(root);
  if (panels.length === 0) {
    return [{ id: 'panels', level: 'ok', message: 'panels           none' }];
  }
  const out: CheckResult[] = [];
  for (const id of panels) {
    const file = path.join(root, 'src', 'panels', `${id}.ts`);
    const src = fs.readFileSync(file, 'utf8');
    if (!/\bdefinePanel\b/.test(src)) {
      out.push({ id: `panel.${id}`, level: 'error', message: `panel ${id}: missing definePanel export` });
      continue;
    }
    const webviewDir = path.join(root, 'src', 'webview', 'panels', id);
    if (!fs.existsSync(webviewDir)) {
      out.push({
        id: `panel.${id}.webview`,
        level: 'warn',
        message: `panel ${id}: webview dir missing (src/webview/panels/${id}/)`,
      });
    }
  }
  if (out.length === 0) {
    out.push({ id: 'panels', level: 'ok', message: `panels           ${panels.length} valid` });
  }
  return out;
}

function checkRpcContracts(root: string): CheckResult[] {
  const apiFile = path.join(root, 'src', 'shared', 'api.ts');
  if (!fs.existsSync(apiFile)) return [];
  const apiSrc = fs.readFileSync(apiFile, 'utf8');
  const interfaces = parseInterfaces(apiSrc);
  const out: CheckResult[] = [];

  const panels = listPanels(root);
  for (const id of panels) {
    const Pascal = id.charAt(0).toUpperCase() + id.slice(1);
    const apiName = `${Pascal}Api`;
    if (!interfaces[apiName]) continue;
    const file = path.join(root, 'src', 'panels', `${id}.ts`);
    const src = fs.readFileSync(file, 'utf8');
    const handlers = parseRpcHandlers(src);
    if (handlers === null) {
      out.push({
        id: `rpc.${id}`,
        level: 'warn',
        message: `panel ${id}: ${apiName} interface declared but no rpc block`,
      });
      continue;
    }
    const declared = interfaces[apiName];
    const missing = declared.filter((m) => !handlers.includes(m));
    const extra = handlers.filter((m) => !declared.includes(m));
    if (missing.length === 0 && extra.length === 0) {
      out.push({ id: `rpc.${id}`, level: 'ok', message: `rpc ${id}        ${declared.length} method(s) in sync` });
    } else {
      out.push({
        id: `rpc.${id}`,
        level: 'error',
        message: `rpc ${id}: contract drift`,
        details: [
          ...missing.map((m) => `missing handler: ${m}`),
          ...extra.map((m) => `extra handler (not in api): ${m}`),
        ],
      });
    }
  }
  return out;
}

function checkMenus(root: string): CheckResult[] {
  const menus = listMenus(root);
  if (menus.length === 0) return [];
  const panels = new Set(listPanels(root));
  const commands = new Set(listCommands(root));
  const out: CheckResult[] = [];

  for (const id of menus) {
    const file = path.join(root, 'src', 'menus', `${id}.ts`);
    const tree = parseMenu(fs.readFileSync(file, 'utf8'));
    const orphans: string[] = [];
    const badIcons: string[] = [];
    walk(tree.items, (n) => {
      if (n.kind === 'panel' && n.target && !panels.has(n.target)) {
        orphans.push(`panel "${n.target}" (in "${n.label}")`);
      }
      if (n.kind === 'command' && n.target && !commands.has(n.target)) {
        orphans.push(`command "${n.target}" (in "${n.label}")`);
      }
      if (n.icon && !isKnownCodicon(n.icon)) {
        badIcons.push(`${n.icon} (in "${n.label}")`);
      }
    });
    if (tree.icon && !isKnownCodicon(tree.icon)) {
      badIcons.push(`${tree.icon} (menu icon)`);
    }
    if (orphans.length === 0 && badIcons.length === 0) {
      out.push({ id: `menu.${id}`, level: 'ok', message: `menu ${id}       refs OK` });
    } else {
      if (orphans.length) {
        out.push({
          id: `menu.${id}.refs`,
          level: 'error',
          message: `menu ${id}: ${orphans.length} orphan ref(s)`,
          details: orphans,
        });
      }
      if (badIcons.length) {
        out.push({
          id: `menu.${id}.icons`,
          level: 'warn',
          message: `menu ${id}: ${badIcons.length} unknown codicon(s)`,
          details: badIcons,
        });
      }
    }
  }
  return out;
}

function checkStatusBars(root: string): CheckResult[] {
  const dir = path.join(root, 'src', 'statusBars');
  if (!fs.existsSync(dir)) return [];
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.ts'));
  if (files.length === 0) return [];
  const commands = new Set(listCommands(root));
  const out: CheckResult[] = [];
  for (const f of files) {
    const id = f.replace(/\.ts$/, '');
    const src = fs.readFileSync(path.join(dir, f), 'utf8');
    const cmdMatch = /\bcommand\s*:\s*(['"`])([^'"`]+)\1/.exec(src);
    if (cmdMatch) {
      const target = cmdMatch[2];
      // Skip check if it looks like a full vscode command id (contains a dot)
      if (!target.includes('.') && !commands.has(target)) {
        out.push({
          id: `statusBar.${id}`,
          level: 'error',
          message: `statusBar ${id}: command "${target}" not found in src/commands/`,
        });
        continue;
      }
    }
    out.push({ id: `statusBar.${id}`, level: 'ok', message: `statusBar ${id}  OK` });
  }
  return out;
}

function checkContributesSync(root: string, pkg: any): CheckResult {
  const contributes = pkg?.contributes;
  if (!contributes) {
    return { id: 'contributes', level: 'warn', message: 'package.json has no contributes — run `bun run gen`' };
  }
  const commands = new Set(listCommands(root));
  const panels = new Set(listPanels(root));
  const stale: string[] = [];
  const prefix: string = pkg?.vsxf?.commandPrefix
    ?? pkg.name?.replace(/^@[^/]+\//, '').replace(/[^a-zA-Z0-9]+/g, '')
    ?? '';
  for (const c of contributes.commands ?? []) {
    const id: string = c.command ?? '';
    if (!id.startsWith(`${prefix}.`)) continue;
    const suffix = id.slice(prefix.length + 1);
    if (suffix.startsWith('open')) {
      const panelId = suffix.slice(4).charAt(0).toLowerCase() + suffix.slice(5);
      if (!panels.has(panelId)) stale.push(id);
    } else if (!commands.has(suffix)) {
      stale.push(id);
    }
  }
  if (stale.length === 0) {
    return { id: 'contributes', level: 'ok', message: 'contributes       in sync with src/' };
  }
  return {
    id: 'contributes',
    level: 'warn',
    message: `contributes: ${stale.length} stale entry(ies) — run \`bun run gen\``,
    details: stale,
  };
}

function checkGitignore(root: string): CheckResult {
  const file = path.join(root, '.gitignore');
  const required = ['dist', 'node_modules'];
  if (!fs.existsSync(file)) {
    return { id: 'gitignore', level: 'warn', message: '.gitignore missing' };
  }
  const lines = fs.readFileSync(file, 'utf8').split('\n').map((l) => l.trim());
  const missing = required.filter((p) => !lines.some((l) => l === p || l === `/${p}` || l === `${p}/`));
  if (missing.length === 0) return { id: 'gitignore', level: 'ok', message: '.gitignore       OK' };
  return {
    id: 'gitignore',
    level: 'warn',
    message: `.gitignore missing entries: ${missing.join(', ')}`,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// helpers

function readPkg(root: string): any {
  const p = path.join(root, 'package.json');
  if (!fs.existsSync(p)) throw new Error(`package.json not found at ${p}`);
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

/** Parse exported interfaces with their method names. Uses balanced-brace matching. */
function parseInterfaces(src: string): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  const re = /export\s+interface\s+(\w+)\s*\{/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    const name = m[1];
    const bodyStart = m.index + m[0].length;
    const bodyEnd = matchBrace(src, bodyStart);
    if (bodyEnd === -1) continue;
    const body = src.slice(bodyStart, bodyEnd);
    const methods: string[] = [];
    const methRe = /(?:^|\n)\s*(\w+)\s*\(/g;
    let mm: RegExpExecArray | null;
    while ((mm = methRe.exec(body))) {
      const key = mm[1];
      if (!methods.includes(key)) methods.push(key);
    }
    out[name] = methods;
  }
  return out;
}

function matchBrace(src: string, start: number): number {
  let depth = 1;
  for (let i = start; i < src.length; i++) {
    const c = src[i];
    if (c === '{') depth++;
    else if (c === '}') {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

/** Parse handler names inside `rpc: (vscode) => ({ ... })`. Returns null if no rpc block. */
function parseRpcHandlers(src: string): string[] | null {
  const re = /\brpc\s*:\s*\([^)]*\)\s*=>\s*\(\s*\{/m;
  const m = re.exec(src);
  if (!m) return null;
  const start = m.index + m[0].length;
  let depth = 1;
  let end = -1;
  for (let i = start; i < src.length; i++) {
    const c = src[i];
    if (c === '{') depth++;
    else if (c === '}') {
      depth--;
      if (depth === 0) { end = i; break; }
    }
  }
  if (end === -1) return [];
  const body = src.slice(start, end);
  const handlers: string[] = [];
  const handRe = /(?:^|\n|,)\s*(?:async\s+)?(\w+)\s*\(/g;
  let mm: RegExpExecArray | null;
  while ((mm = handRe.exec(body))) {
    handlers.push(mm[1]);
  }
  return handlers;
}

function walk(items: MenuNode[], fn: (n: MenuNode) => void) {
  for (const n of items) {
    fn(n);
    if (n.children) walk(n.children, fn);
  }
}
