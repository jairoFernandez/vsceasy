/**
 * Lightweight parser for menu source -> tree of items.
 * Reads label, icon, kind/target, and nested children from a single .ts menu file.
 *
 * Heuristic, not a full TS parser: matches the shape emitted by
 * defineMenu({ items: [...] }) in the framework templates.
 */

export type MenuNodeKind = 'panel' | 'command' | 'url' | 'group' | 'item';

export interface MenuNode {
  label: string;
  kind: MenuNodeKind;
  target?: string;
  icon?: string;
  children?: MenuNode[];
}

export interface MenuTree {
  title?: string;
  icon?: string;
  items: MenuNode[];
}

export function parseMenu(src: string): MenuTree {
  const title = matchString(src, /\btitle\s*:\s*(['"`])([^'"`]+)\1/);
  const icon = matchString(src, /\bicon\s*:\s*(['"`])([^'"`]+)\1/);
  const items = parseItemsArray(src);
  return { title, icon, items };
}

function parseItemsArray(src: string): MenuNode[] {
  const start = findItemsStart(src);
  if (start < 0) return [];
  const end = findMatching(src, start);
  if (end < 0) return [];
  return parseArrayItems(src.slice(start + 1, end));
}

function parseArrayItems(inner: string): MenuNode[] {
  const out: MenuNode[] = [];
  let i = 0;
  while (i < inner.length) {
    skipTrivia(inner, { idx: i });
    while (i < inner.length && /[\s,]/.test(inner[i])) i++;
    if (i >= inner.length) break;
    if (inner[i] === '/' && (inner[i + 1] === '/' || inner[i + 1] === '*')) {
      i = skipComment(inner, i);
      continue;
    }
    if (inner[i] !== '{') { i++; continue; }
    const end = findMatching(inner, i);
    if (end < 0) break;
    const obj = inner.slice(i, end + 1);
    out.push(parseObject(obj));
    i = end + 1;
  }
  return out;
}

function parseObject(obj: string): MenuNode {
  const label = matchString(obj, /\blabel\s*:\s*(['"`])([^'"`]+)\1/) ?? '(unnamed)';
  const icon = matchString(obj, /\bicon\s*:\s*(['"`])([^'"`]+)\1/);
  const panel = matchString(obj, /\bpanel\s*:\s*(['"`])([^'"`]+)\1/);
  const command = matchString(obj, /\bcommand\s*:\s*(['"`])([^'"`]+)\1/);
  const url = matchString(obj, /\burl\s*:\s*(['"`])([^'"`]+)\1/);

  const childrenIdx = obj.search(/\bchildren\s*:\s*\[/);
  let children: MenuNode[] | undefined;
  if (childrenIdx >= 0) {
    const arrOpen = obj.indexOf('[', childrenIdx);
    if (arrOpen >= 0) {
      const arrClose = findMatching(obj, arrOpen);
      if (arrClose >= 0) {
        children = parseArrayItems(obj.slice(arrOpen + 1, arrClose));
      }
    }
  }

  let kind: MenuNodeKind = 'item';
  let target: string | undefined;
  if (children !== undefined) { kind = 'group'; }
  else if (panel) { kind = 'panel'; target = panel; }
  else if (command) { kind = 'command'; target = command; }
  else if (url) { kind = 'url'; target = url; }

  return { label, kind, target, icon, children };
}

function matchString(s: string, re: RegExp): string | undefined {
  const m = s.match(re);
  return m?.[2];
}

function findItemsStart(src: string): number {
  const re = /\bitems\s*:\s*\[/g;
  const m = re.exec(src);
  if (!m) return -1;
  return m.index + m[0].length - 1;
}

function findMatching(src: string, openIdx: number): number {
  const open = src[openIdx];
  const close = open === '[' ? ']' : open === '{' ? '}' : open === '(' ? ')' : '';
  if (!close) return -1;
  let depth = 0;
  let i = openIdx;
  const n = src.length;
  while (i < n) {
    const ch = src[i];
    if (ch === '"' || ch === "'" || ch === '`') {
      const q = ch;
      i++;
      while (i < n && src[i] !== q) {
        if (src[i] === '\\') i += 2;
        else i++;
      }
      i++;
      continue;
    }
    if (ch === '/' && src[i + 1] === '/') { while (i < n && src[i] !== '\n') i++; continue; }
    if (ch === '/' && src[i + 1] === '*') { i += 2; while (i < n && !(src[i] === '*' && src[i + 1] === '/')) i++; i += 2; continue; }
    if (ch === open) depth++;
    else if (ch === close) { depth--; if (depth === 0) return i; }
    i++;
  }
  return -1;
}

function skipTrivia(_s: string, _ref: { idx: number }) {}
function skipComment(s: string, i: number): number {
  if (s[i + 1] === '/') { while (i < s.length && s[i] !== '\n') i++; return i; }
  if (s[i + 1] === '*') { i += 2; while (i < s.length && !(s[i] === '*' && s[i + 1] === '/')) i++; return i + 2; }
  return i + 1;
}

// ─── Rendering ─────────────────────────────────────────────────────────────

const ESC = '\x1b';
const DIM = `${ESC}[2m`;
const BOLD = `${ESC}[1m`;
const CYAN = `${ESC}[36m`;
const GREEN = `${ESC}[32m`;
const YELLOW = `${ESC}[33m`;
const MAGENTA = `${ESC}[35m`;
const RST = `${ESC}[0m`;

const KIND_BADGE: Record<MenuNodeKind, string> = {
  panel: `${MAGENTA}■${RST}`,
  command: `${GREEN}▶${RST}`,
  url: `${CYAN}↗${RST}`,
  group: `${YELLOW}▾${RST}`,
  item: `${DIM}·${RST}`,
};

export interface RenderOptions {
  /** Highlight insertion point: parent group label, or 'root' for top-level. */
  insertUnder?: string | 'root';
  /** Optional "ghost" item shown at the insertion point (preview). */
  ghost?: { label: string; kind: MenuNodeKind; target?: string; icon?: string };
}

export function renderMenuTree(tree: MenuTree, opts: RenderOptions = {}): string {
  const lines: string[] = [];
  const headerIcon = tree.icon ? ` ${DIM}(${tree.icon})${RST}` : '';
  lines.push(`${BOLD}${CYAN}▣ ${tree.title ?? '(menu)'}${RST}${headerIcon}`);
  renderItems(tree.items, '', lines, opts, true);
  if (opts.insertUnder === 'root' && opts.ghost) {
    lines.push(formatGhost('└─ ', opts.ghost));
  }
  return lines.join('\n');
}

function renderItems(items: MenuNode[], prefix: string, out: string[], opts: RenderOptions, atRoot: boolean) {
  items.forEach((node, i) => {
    const isLast = i === items.length - 1 && !(opts.insertUnder === (atRoot ? 'root' : undefined) && opts.ghost);
    const branch = isLast ? '└─ ' : '├─ ';
    const nextPrefix = prefix + (isLast ? '   ' : '│  ');
    out.push(`${prefix}${branch}${formatNode(node)}`);
    const insertHere = node.kind === 'group' && opts.insertUnder === node.label;
    if (node.children) {
      renderItems(node.children, nextPrefix, out, opts, false);
      if (insertHere && opts.ghost) {
        out.push(`${nextPrefix}└─ ${formatGhostNode(opts.ghost)}`);
      }
    } else if (insertHere && opts.ghost) {
      // group with no children
      out.push(`${nextPrefix}└─ ${formatGhostNode(opts.ghost)}`);
    }
  });
}

function formatNode(n: MenuNode): string {
  const badge = KIND_BADGE[n.kind];
  const iconPart = n.icon ? ` ${DIM}$(${n.icon})${RST}` : '';
  const targetPart = n.target ? ` ${DIM}→ ${n.target}${RST}` : '';
  return `${badge} ${n.label}${iconPart}${targetPart}`;
}

function formatGhost(branch: string, ghost: NonNullable<RenderOptions['ghost']>): string {
  return `${GREEN}${branch}${formatGhostNode(ghost)}${RST}`;
}

function formatGhostNode(ghost: NonNullable<RenderOptions['ghost']>): string {
  const kind = ghost.kind as MenuNodeKind;
  const badge = KIND_BADGE[kind];
  const iconPart = ghost.icon ? ` ${DIM}$(${ghost.icon})${RST}` : '';
  const targetPart = ghost.target ? ` ${DIM}→ ${ghost.target}${RST}` : '';
  return `${badge} ${GREEN}${BOLD}${ghost.label || '(new)'}${RST}${iconPart}${targetPart} ${GREEN}← new${RST}`;
}
