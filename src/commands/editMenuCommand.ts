import * as fs from 'fs';
import * as path from 'path';
import { Command, ParamType } from '@ideascol/cli-maker';
import { findProjectRoot } from '../lib/findProject';
import {
  editMenu,
  listMenus,
  listPanels,
  listCommands,
  listGroups,
  MenuItemKind,
  NewMenuItem,
} from '../lib/editMenu';
import { select, askText, style, confirm } from '../lib/interactive';
import { parseMenu, renderMenuTree, RenderOptions } from '../lib/menuTree';
import { CODICONS, CODICON_CATEGORIES, CodiconCategory, isKnownCodicon } from '../data/codicons';

const editMenuCommand: Command = {
  name: 'editMenu',
  description: 'Edit an existing menu: add an item that opens a panel, runs a command, opens a URL, or groups items',
  params: [
    { name: 'name', description: 'Menu id (file basename in src/menus/). Prompted if omitted', required: false, type: ParamType.Text },
    { name: 'label', description: 'Item label. Prompted if omitted', required: false, type: ParamType.Text },
    { name: 'kind', description: 'Item kind: panel | command | url | group', required: false, type: ParamType.List, options: ['panel', 'command', 'url', 'group'] },
    { name: 'target', description: 'Panel/command id or URL', required: false, type: ParamType.Text },
    { name: 'icon', description: 'Codicon name', required: false, type: ParamType.Text },
    { name: 'group', description: 'Parent group label (empty = root)', required: false, type: ParamType.Text },
  ],
  action: async (args) => {
    try {
      const projectRoot = findProjectRoot();

      // ── Step 1: menu
      const menuName = args.name || await pickMenu(projectRoot);
      const menuFile = path.join(projectRoot, 'src', 'menus', `${menuName}.ts`);
      if (!fs.existsSync(menuFile)) throw new Error(`Menu not found: src/menus/${menuName}.ts`);
      const src = fs.readFileSync(menuFile, 'utf8');
      const tree = parseMenu(src);

      const previewOpts: RenderOptions = {};

      // ── Step 2: parent group
      const parentLabel = args.group !== undefined
        ? (args.group || undefined)
        : await pickGroup(src, tree, previewOpts);
      previewOpts.insertUnder = parentLabel ?? 'root';

      // ── Step 3: kind
      const kind: MenuItemKind = (args.kind as MenuItemKind) || await pickKind(tree, previewOpts);
      previewOpts.ghost = { label: '(new)', kind: kind === 'group' ? 'group' : kind, target: '', icon: '' };

      // ── Step 4: target
      const target = args.target || await pickTarget(projectRoot, kind, tree, previewOpts);
      if (previewOpts.ghost) previewOpts.ghost.target = target;

      // ── Step 5: label
      const labelDefault = defaultLabel(kind, target);
      const label = args.label || await askLabel(tree, previewOpts, labelDefault);
      if (!label) throw new Error('Label is required');
      if (previewOpts.ghost) previewOpts.ghost.label = label;

      // ── Step 6: icon
      const icon = kind === 'group'
        ? (args.icon || '')
        : (args.icon || await pickIcon(tree, previewOpts));
      if (previewOpts.ghost) previewOpts.ghost.icon = icon;

      // ── Final confirm
      renderHeader(tree, previewOpts, 'Ready to insert');
      const ok = await confirm('Confirm insert?', true);
      if (!ok) { console.log(`${style.YELLOW}Cancelled.${style.RST}`); return; }

      const item: NewMenuItem = {
        label,
        kind,
        target: kind === 'group' ? undefined : target,
        icon: icon || undefined,
        parentLabel,
      };

      const result = editMenu({ projectRoot, menuName, item });
      console.log(`\n${style.GREEN}✓${style.RST} Added to ${path.relative(projectRoot, result.file)}\n`);
      console.log(indent(result.inserted, '  '));
      console.log(
        result.genRan
          ? `\n  ${style.DIM}Registry + package.json regenerated.${style.RST}\n`
          : `\n  ${style.DIM}Run \`bun run gen\` to regenerate registry.${style.RST}\n`,
      );
    } catch (err: any) {
      if (err?.message === 'Cancelled') {
        console.log(`\n${style.YELLOW}Cancelled.${style.RST}`);
        return;
      }
      console.error(`\n${style.YELLOW}✗${style.RST} ${err.message}\n`);
      process.exitCode = 1;
    }
  },
};

function clearScreen() {
  if (process.stdout.isTTY) {
    process.stdout.write('\x1b[2J\x1b[H');
  }
}

function renderHeader(tree: ReturnType<typeof parseMenu>, opts: RenderOptions, breadcrumb?: string) {
  clearScreen();
  console.log(`${style.BOLD}${style.CYAN}vsxf editMenu${style.RST}${breadcrumb ? `  ${style.DIM}— ${breadcrumb}${style.RST}` : ''}`);
  console.log();
  console.log(renderMenuTree(tree, opts));
  console.log();
}

async function pickMenu(projectRoot: string): Promise<string> {
  const menus = listMenus(projectRoot);
  if (menus.length === 0) throw new Error('No menus found. Run `addMenu` first.');
  if (menus.length === 1) return menus[0];
  clearScreen();
  console.log(`${style.BOLD}${style.CYAN}vsxf editMenu${style.RST}\n`);
  return select<string>('Which menu?', menus.map((m) => ({ label: m, value: m })));
}

async function pickGroup(src: string, tree: ReturnType<typeof parseMenu>, opts: RenderOptions): Promise<string | undefined> {
  const groups = listGroups(src);
  renderHeader(tree, opts, 'Choose location');
  return select<string | undefined>('Add under which group?', [
    { label: '(root)', value: undefined, hint: 'top-level item' },
    ...groups.map((g) => ({ label: g, value: g as string | undefined, badge: `${style.YELLOW}▾${style.RST}` })),
  ]);
}

async function pickKind(tree: ReturnType<typeof parseMenu>, opts: RenderOptions): Promise<MenuItemKind> {
  renderHeader(tree, opts, 'Choose item kind');
  return select<MenuItemKind>('Item kind?', [
    { label: 'Panel', value: 'panel', hint: 'opens a webview panel', badge: `${style.CYAN}■${style.RST}` },
    { label: 'Command', value: 'command', hint: 'runs a registered command', badge: `${style.GREEN}▶${style.RST}` },
    { label: 'URL', value: 'url', hint: 'opens an external link', badge: `${style.CYAN}↗${style.RST}` },
    { label: 'Group', value: 'group', hint: 'collapsible group with children', badge: `${style.YELLOW}▾${style.RST}` },
  ]);
}

async function pickTarget(projectRoot: string, kind: MenuItemKind, tree: ReturnType<typeof parseMenu>, opts: RenderOptions): Promise<string | undefined> {
  if (kind === 'group') return undefined;
  if (kind === 'panel') {
    const panels = listPanels(projectRoot);
    if (panels.length === 0) throw new Error('No panels found. Run `addPanel` first.');
    renderHeader(tree, opts, 'Choose panel');
    return select<string>('Which panel?', panels.map((p) => ({ label: p, value: p, badge: `${style.CYAN}■${style.RST}` })));
  }
  if (kind === 'command') {
    const cmds = listCommands(projectRoot);
    if (cmds.length === 0) {
      renderHeader(tree, opts, 'Enter command id');
      return askText('Command id');
    }
    renderHeader(tree, opts, 'Choose command');
    return select<string>('Which command?', cmds.map((c) => ({ label: c, value: c, badge: `${style.GREEN}▶${style.RST}` })));
  }
  renderHeader(tree, opts, 'Enter URL');
  const url = await askText('URL (https://...)');
  if (!/^https?:\/\//i.test(url)) throw new Error('URL must start with http:// or https://');
  return url;
}

async function askLabel(tree: ReturnType<typeof parseMenu>, opts: RenderOptions, defaultValue: string): Promise<string> {
  renderHeader(tree, opts, 'Set label');
  return askText('Label', defaultValue);
}

async function pickIcon(tree: ReturnType<typeof parseMenu>, opts: RenderOptions): Promise<string> {
  renderHeader(tree, opts, 'Choose icon');
  const mode = await select<'category' | 'all' | 'custom' | 'none'>('Icon?', [
    { label: 'Browse by category', value: 'category', hint: '10 groups' },
    { label: 'Search all icons', value: 'all', hint: `${CODICONS.length}+ codicons, type to filter` },
    { label: 'Type custom codicon name', value: 'custom' },
    { label: 'No icon', value: 'none' },
  ]);
  if (mode === 'none') return '';
  if (mode === 'custom') {
    renderHeader(tree, opts, 'Type custom codicon');
    const name = await askText('Codicon name');
    if (name && !isKnownCodicon(name)) {
      console.log(`  ${style.DIM}(note: "${name}" not in bundled list — assuming valid)${style.RST}`);
    }
    return name;
  }
  let pool = CODICONS;
  if (mode === 'category') {
    renderHeader(tree, opts, 'Pick icon category');
    const cat = await select<CodiconCategory>('Category?', CODICON_CATEGORIES.map((c) => ({
      label: c, value: c, hint: `${CODICONS.filter((x) => x.category === c).length} icons`,
    })));
    pool = CODICONS.filter((c) => c.category === cat);
  }
  renderHeader(tree, opts, mode === 'all' ? 'Search icon' : 'Pick icon');
  return select<string>('Icon (type to filter)', pool.map((c) => ({
    label: c.name,
    value: c.name,
    hint: c.category,
  })), { filter: true, pageSize: 12 });
}

function defaultLabel(kind: MenuItemKind, target?: string): string {
  if (kind === 'group') return 'New Group';
  if (!target) return '';
  if (kind === 'url') return target;
  return target.charAt(0).toUpperCase() + target.slice(1);
}

function indent(s: string, pad: string): string {
  return s.split('\n').map((l) => pad + l).join('\n');
}

export default editMenuCommand;
