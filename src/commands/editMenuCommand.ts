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
import { CODICONS, isKnownCodicon } from '../data/codicons';

const ROOT_SENTINEL = '(root)';
const KIND_OPTIONS: MenuItemKind[] = ['panel', 'command', 'url', 'group'];

function readMenuSource(projectRoot: string, name: string): string | null {
  const file = path.join(projectRoot, 'src', 'menus', `${name}.ts`);
  return fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null;
}

const editMenuCommand: Command = {
  name: 'editMenu',
  description: 'Add an item (panel, command, URL, or group) to an existing menu',
  params: [
    {
      name: 'name',
      description: 'Menu id (file basename in src/menus/)',
      required: true,
      type: ParamType.List,
      optionsLoader: () => {
        const menus = listMenus(findProjectRoot());
        if (menus.length === 0) throw new Error('No menus found. Run `addMenu` first.');
        return menus;
      },
    },
    {
      name: 'kind',
      description: 'Item kind: panel | command | url | group',
      required: true,
      type: ParamType.List,
      options: KIND_OPTIONS as unknown as any[],
    },
    {
      name: 'group',
      description: 'Parent group label',
      required: false,
      type: ParamType.List,
      optionsLoader: (answers) => {
        const src = readMenuSource(findProjectRoot(), answers.name);
        const groups = src ? listGroups(src) : [];
        return [ROOT_SENTINEL, ...groups];
      },
      defaultValue: ROOT_SENTINEL,
    },
    {
      name: 'panel',
      description: 'Panel id (only when kind=panel)',
      required: true,
      type: ParamType.List,
      when: (a) => a.kind === 'panel',
      optionsLoader: () => {
        const panels = listPanels(findProjectRoot());
        if (panels.length === 0) throw new Error('No panels found. Run `addPanel` first.');
        return panels;
      },
    },
    {
      name: 'command',
      description: 'Command id (only when kind=command)',
      required: true,
      type: ParamType.List,
      when: (a) => a.kind === 'command',
      optionsLoader: () => {
        const cmds = listCommands(findProjectRoot());
        if (cmds.length === 0) throw new Error('No commands found.');
        return cmds;
      },
    },
    {
      name: 'url',
      description: 'External URL (https://...)',
      required: true,
      type: ParamType.Url,
      when: (a) => a.kind === 'url',
    },
    {
      name: 'label',
      description: 'Item label shown in the menu',
      required: true,
      type: ParamType.Text,
      defaultValue: (a: Record<string, any>) => defaultLabel(a.kind, targetOf(a)),
    },
    {
      name: 'icon',
      description: 'Codicon name',
      required: true,
      type: ParamType.List,
      when: (a) => a.kind !== 'group',
      optionsLoader: () => CODICONS.map((c) => c.name),
      optionLabel: (name: string) => {
        const c = CODICONS.find((x) => x.name === name);
        return c ? `${name}  \x1b[90m— ${c.category}\x1b[0m` : name;
      },
      pageSize: 12,
    },
  ],
  action: async (args) => {
    try {
      const projectRoot = findProjectRoot();
      const menuName = String(args.name).trim();
      const menuFile = path.join(projectRoot, 'src', 'menus', `${menuName}.ts`);
      if (!fs.existsSync(menuFile)) throw new Error(`Menu not found: src/menus/${menuName}.ts`);

      const kind = args.kind as MenuItemKind;
      const target = targetOf(args);
      const label = String(args.label).trim();
      if (!label) throw new Error('Label is required');

      const icon = args.icon ? String(args.icon).trim() : undefined;
      if (icon && !isKnownCodicon(icon)) {
        console.warn(`  (note: "${icon}" not in bundled codicon list — assuming valid)`);
      }

      const parentLabel = !args.group || args.group === ROOT_SENTINEL ? undefined : String(args.group);

      const item: NewMenuItem = {
        label,
        kind,
        target: kind === 'group' ? undefined : target,
        icon: icon || undefined,
        parentLabel,
      };

      const result = editMenu({ projectRoot, menuName, item });
      console.log(`\n✓ Added to ${path.relative(projectRoot, result.file)}\n`);
      console.log(indent(result.inserted, '  '));
      console.log(
        result.genRan
          ? '\n  Registry + package.json regenerated.\n'
          : '\n  Run `bun run gen` to regenerate registry.\n',
      );
    } catch (err: any) {
      console.error(`\n✗ ${err.message}\n`);
      process.exitCode = 1;
    }
  },
};

function targetOf(a: Record<string, any>): string | undefined {
  if (a.kind === 'panel') return a.panel;
  if (a.kind === 'command') return a.command;
  if (a.kind === 'url') return a.url;
  return undefined;
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
