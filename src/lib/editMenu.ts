import * as fs from 'fs';
import * as path from 'path';
import { spawnSync } from 'child_process';

export type MenuItemKind = 'panel' | 'command' | 'url' | 'group';

export interface NewMenuItem {
  label: string;
  kind: MenuItemKind;
  /** target id for panel/command, URL string for url, undefined for group */
  target?: string;
  icon?: string;
  description?: string;
  /** Parent group label. undefined = root items array */
  parentLabel?: string;
}

export interface EditMenuOptions {
  projectRoot: string;
  /** Menu name (file basename without .ts). */
  menuName: string;
  item: NewMenuItem;
  /** Run `bun run gen` after writing. Default true. */
  runGen?: boolean;
}

export interface EditMenuResult {
  file: string;
  inserted: string;
  genRan: boolean;
}

/** List menu files in src/menus/. */
export function listMenus(projectRoot: string): string[] {
  const dir = path.join(projectRoot, 'src', 'menus');
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter((f) => f.endsWith('.ts'))
    .map((f) => f.replace(/\.ts$/, ''))
    .sort();
}

/** List panels in src/panels/. */
export function listPanels(projectRoot: string): string[] {
  const dir = path.join(projectRoot, 'src', 'panels');
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter((f) => f.endsWith('.ts'))
    .map((f) => f.replace(/\.ts$/, ''))
    .sort();
}

/** List commands in src/commands/. */
export function listCommands(projectRoot: string): string[] {
  const dir = path.join(projectRoot, 'src', 'commands');
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter((f) => f.endsWith('.ts'))
    .map((f) => f.replace(/\.ts$/, ''))
    .sort();
}

/** Extract top-level group labels from a menu file source. */
export function listGroups(src: string): string[] {
  const root = findArrayContents(src, findItemsArrayStart(src));
  if (!root) return [];
  const inner = src.slice(root.openIdx + 1, root.closeIdx);
  const groups: string[] = [];
  const re = /\blabel\s*:\s*(['"`])([^'"`]+)\1[^{}]*?\bchildren\s*:\s*\[/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(inner)) !== null) {
    groups.push(m[2]);
  }
  return groups;
}

export function editMenu(opts: EditMenuOptions): EditMenuResult {
  const file = path.join(opts.projectRoot, 'src', 'menus', `${opts.menuName}.ts`);
  if (!fs.existsSync(file)) {
    throw new Error(`Menu not found: ${path.relative(opts.projectRoot, file)}`);
  }
  const src = fs.readFileSync(file, 'utf8');
  const updated = insertItem(src, opts.item);
  fs.writeFileSync(file, updated.source);
  const genRan = opts.runGen === false ? false : runGen(opts.projectRoot);
  return { file, inserted: updated.inserted, genRan };
}

function runGen(cwd: string): boolean {
  const tryRun = (cmd: string, args: string[]) => {
    const r = spawnSync(cmd, args, { cwd, stdio: 'inherit' });
    return r.status === 0;
  };
  if (which('bun') && tryRun('bun', ['run', 'gen'])) return true;
  if (which('npm') && tryRun('npm', ['run', 'gen'])) return true;
  console.warn('\n! Could not run "gen" automatically. Run `bun run gen` manually.\n');
  return false;
}

function which(cmd: string): boolean {
  const r = spawnSync(process.platform === 'win32' ? 'where' : 'which', [cmd], { stdio: 'ignore' });
  return r.status === 0;
}

interface InsertResult { source: string; inserted: string; }

export function insertItem(src: string, item: NewMenuItem): InsertResult {
  const target = item.parentLabel
    ? findGroupChildrenArray(src, item.parentLabel)
    : findArrayContents(src, findItemsArrayStart(src));
  if (!target) {
    throw new Error(
      item.parentLabel
        ? `Group "${item.parentLabel}" not found in menu`
        : 'Could not locate items: [...] array in menu file',
    );
  }
  const indent = detectArrayItemIndent(src, target);
  const rendered = renderItem(item, indent);
  // Find a good insertion point: right before the closing ].
  // Preserve trailing comma on previous element by inserting a newline+rendered
  // before close, and ensure rendered ends with comma.
  const before = src.slice(0, target.closeIdx);
  const after = src.slice(target.closeIdx);
  // Trim trailing whitespace right before ] so we control spacing.
  const trimmedBefore = before.replace(/[ \t]*$/, '');
  const insertion = (trimmedBefore.endsWith('\n') ? '' : '\n') + rendered + '\n' + ' '.repeat(closeIndent(src, target.closeIdx));
  return { source: trimmedBefore + insertion + after, inserted: rendered };
}

function renderItem(item: NewMenuItem, indent: string): string {
  const parts: string[] = [];
  parts.push(`${indent}{`);
  parts.push(`${indent}  label: ${quote(item.label)},`);
  if (item.icon) parts.push(`${indent}  icon: ${quote(item.icon)},`);
  if (item.description) parts.push(`${indent}  description: ${quote(item.description)},`);
  switch (item.kind) {
    case 'panel':
      if (!item.target) throw new Error('panel kind requires target');
      parts.push(`${indent}  panel: ${quote(item.target)},`);
      break;
    case 'command':
      if (!item.target) throw new Error('command kind requires target');
      parts.push(`${indent}  command: ${quote(item.target)},`);
      break;
    case 'url':
      if (!item.target) throw new Error('url kind requires target');
      parts.push(`${indent}  url: ${quote(item.target)},`);
      break;
    case 'group':
      parts.push(`${indent}  children: [],`);
      break;
  }
  parts.push(`${indent}},`);
  return parts.join('\n');
}

function quote(s: string): string {
  return `'${s.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
}

function detectArrayItemIndent(src: string, arr: { openIdx: number; closeIdx: number }): string {
  // Look for an existing `{` inside the array to copy its indentation.
  const inner = src.slice(arr.openIdx + 1, arr.closeIdx);
  const m = inner.match(/\n([ \t]+)\{/);
  if (m) return m[1];
  // Fallback: closing-bracket indent + 2 spaces.
  return ' '.repeat(closeIndent(src, arr.closeIdx) + 2);
}

function closeIndent(src: string, closeIdx: number): number {
  // Count whitespace at start of line containing closeIdx.
  let i = closeIdx - 1;
  while (i >= 0 && src[i] !== '\n') i--;
  let n = 0;
  let j = i + 1;
  while (j < closeIdx && (src[j] === ' ' || src[j] === '\t')) { n++; j++; }
  return n;
}

/** Returns index of the `[` for the top-level items: [...] array. */
function findItemsArrayStart(src: string): number {
  // Look for "items:" then next "[".
  const re = /\bitems\s*:\s*\[/g;
  const m = re.exec(src);
  if (!m) throw new Error('Menu file missing items: [...] array');
  return m.index + m[0].length - 1; // index of '['
}

/** Given start index of '[', find matching ']' index. Returns { openIdx, closeIdx } */
function findArrayContents(src: string, openIdx: number): { openIdx: number; closeIdx: number } | null {
  if (src[openIdx] !== '[') return null;
  const closeIdx = findMatching(src, openIdx);
  if (closeIdx < 0) return null;
  return { openIdx, closeIdx };
}

/** Find children: [ array for a group by label. */
function findGroupChildrenArray(src: string, label: string): { openIdx: number; closeIdx: number } | null {
  const root = findArrayContents(src, findItemsArrayStart(src));
  if (!root) return null;
  // Walk siblings inside root: find each object literal that has the matching label.
  let i = root.openIdx + 1;
  while (i < root.closeIdx) {
    const ch = src[i];
    if (ch === '{') {
      const objEnd = findMatching(src, i);
      if (objEnd < 0) break;
      const obj = src.slice(i, objEnd + 1);
      const labelMatch = obj.match(/\blabel\s*:\s*(['"`])([^'"`]+)\1/);
      if (labelMatch && labelMatch[2] === label) {
        // find children: [ inside this object
        const childRe = /\bchildren\s*:\s*\[/;
        const cm = childRe.exec(obj);
        if (!cm) return null;
        const openInObj = cm.index + cm[0].length - 1;
        const openIdx = i + openInObj;
        const closeIdx = findMatching(src, openIdx);
        if (closeIdx < 0) return null;
        return { openIdx, closeIdx };
      }
      i = objEnd + 1;
    } else {
      i++;
    }
  }
  return null;
}

/** Find matching closing bracket for a `(`, `[`, or `{`. Respects strings + line/block comments. */
function findMatching(src: string, openIdx: number): number {
  const open = src[openIdx];
  const close = open === '[' ? ']' : open === '{' ? '}' : open === '(' ? ')' : '';
  if (!close) return -1;
  let depth = 0;
  let i = openIdx;
  const n = src.length;
  while (i < n) {
    const ch = src[i];
    // strings
    if (ch === '"' || ch === "'" || ch === '`') {
      const quote = ch;
      i++;
      while (i < n && src[i] !== quote) {
        if (src[i] === '\\') i += 2;
        else if (quote === '`' && src[i] === '$' && src[i + 1] === '{') {
          // template literal interpolation — skip balanced ${ ... }
          const end = findMatching(src, i + 1);
          if (end < 0) return -1;
          i = end + 1;
        } else i++;
      }
      i++;
      continue;
    }
    // line comment
    if (ch === '/' && src[i + 1] === '/') {
      while (i < n && src[i] !== '\n') i++;
      continue;
    }
    // block comment
    if (ch === '/' && src[i + 1] === '*') {
      i += 2;
      while (i < n && !(src[i] === '*' && src[i + 1] === '/')) i++;
      i += 2;
      continue;
    }
    if (ch === open) depth++;
    else if (ch === close) {
      depth--;
      if (depth === 0) return i;
    }
    i++;
  }
  return -1;
}
