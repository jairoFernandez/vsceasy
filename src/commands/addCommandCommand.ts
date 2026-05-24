import { Command, ParamType } from '@ideascol/cli-maker';
import * as path from 'path';
import { addCommand } from '../lib/addCommand';
import { findProjectRoot, findTemplatesRoot } from '../lib/findProject';
import { listMenus, listGroups } from '../lib/editMenu';
import * as fs from 'fs';
import { CODICONS, isKnownCodicon } from '../data/codicons';

const NONE_SENTINEL = '(none)';
const ROOT_SENTINEL = '(root)';

function readMenuSource(projectRoot: string, name: string): string | null {
  const file = path.join(projectRoot, 'src', 'menus', `${name}.ts`);
  return fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null;
}

const addCommandCommand: Command = {
  name: 'addCommand',
  description: 'Add a command (registered in command palette) to an existing vsxf project',
  params: [
    { name: 'name', description: 'Command id (camelCase, e.g. doStuff)', required: true, type: ParamType.Text },
    {
      name: 'title',
      description: 'Title shown in the command palette',
      required: true,
      type: ParamType.Text,
      defaultValue: (a: Record<string, any>) => pascal(String(a.name || '')),
    },
    { name: 'category', description: 'Category prefix (defaults to extension displayName)', required: false, type: ParamType.Text },
    {
      name: 'keybinding',
      description: 'Keyboard shortcut (e.g. ctrl+shift+h or cmd+shift+h)',
      required: false,
      type: ParamType.Text,
    },
    {
      name: 'menuEntry',
      description: 'Insert a menu entry that runs this command',
      required: true,
      type: ParamType.List,
      optionsLoader: () => {
        const menus = listMenus(findProjectRoot());
        return [NONE_SENTINEL, ...menus];
      },
      defaultValue: NONE_SENTINEL,
    },
    {
      name: 'group',
      description: 'Parent group inside the menu',
      required: false,
      type: ParamType.List,
      when: (a) => a.menuEntry && a.menuEntry !== NONE_SENTINEL,
      optionsLoader: (a) => {
        const src = readMenuSource(findProjectRoot(), a.menuEntry);
        const groups = src ? listGroups(src) : [];
        return [ROOT_SENTINEL, ...groups];
      },
      defaultValue: ROOT_SENTINEL,
    },
    {
      name: 'icon',
      description: 'Codicon for the menu entry',
      required: true,
      type: ParamType.List,
      when: (a) => a.menuEntry && a.menuEntry !== NONE_SENTINEL,
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
      const templatesRoot = findTemplatesRoot(__dirname);

      const name = String(args.name).trim();
      if (!name) throw new Error('Command name is required');

      const menuEntry = args.menuEntry && args.menuEntry !== NONE_SENTINEL ? String(args.menuEntry) : undefined;
      const group = args.group && args.group !== ROOT_SENTINEL ? String(args.group) : undefined;
      const icon = menuEntry && args.icon ? String(args.icon).trim() : undefined;
      if (icon && !isKnownCodicon(icon)) {
        console.warn(`  (note: "${icon}" not in bundled codicon list — assuming valid)`);
      }

      const result = addCommand({
        name,
        title: args.title,
        category: args.category,
        keybinding: args.keybinding ? String(args.keybinding).trim() : undefined,
        menuEntry,
        group,
        icon,
        projectRoot,
        templatesRoot,
      });

      const rel = (p: string) => path.relative(projectRoot, p);
      console.log(`\n✓ Command "${name}" added.\n`);
      console.log('  Created:');
      for (const f of result.created) console.log(`    + ${rel(f)}`);
      if (result.modified.length) {
        console.log('  Modified:');
        for (const f of result.modified) console.log(`    ~ ${rel(f)}`);
      }
      console.log(
        result.genRan
          ? '\n  Registry + package.json updated. Run `bun run launch` to try it.\n'
          : '\n  Run `bun run gen` to register the command, then `bun run launch`.\n',
      );
    } catch (err: any) {
      console.error(`\n✗ ${err.message}\n`);
      process.exitCode = 1;
    }
  },
};

function pascal(s: string): string {
  const cleaned = s.replace(/[^a-zA-Z0-9]+(.)/g, (_m, c) => c.toUpperCase()).replace(/[^a-zA-Z0-9]/g, '');
  if (!cleaned) return '';
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

export default addCommandCommand;
