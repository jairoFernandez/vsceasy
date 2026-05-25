import { Command, ParamType } from '@ideascol/cli-maker';
import * as path from 'path';
import { addSubpanel } from '../../lib/subpanel/add';
import { findProjectRoot, findTemplatesRoot } from '../../lib/findProject';
import { listMenus } from '../../lib/menu/edit';

const addSubpanelCommand: Command = {
  name: 'add',
  description: 'Add a webview view (inline sidebar section) to an existing menu container',
  params: [
    { name: 'name', description: 'Subpanel id (camelCase, e.g. welcome)', required: true, type: ParamType.Text },
    {
      name: 'menu',
      description: 'Menu container this view lives in',
      required: true,
      type: ParamType.List,
      optionsLoader: () => {
        const menus = listMenus(findProjectRoot());
        if (menus.length === 0) throw new Error('No menus found. Run `vsceasy menu add` first.');
        return menus;
      },
    },
    {
      name: 'title',
      description: 'Section header shown in the sidebar',
      required: false,
      type: ParamType.Text,
      defaultValue: (a: Record<string, any>) => pascal(String(a.name || '')),
    },
    {
      name: 'withApi',
      description: 'Generate typed RPC API interface',
      required: false,
      type: ParamType.List,
      options: ['yes', 'no'],
      defaultValue: 'yes',
    },
  ],
  action: async (args) => {
    try {
      const projectRoot = findProjectRoot();
      const templatesRoot = findTemplatesRoot(__dirname);
      const result = addSubpanel({
        name: String(args.name),
        title: args.title ? String(args.title) : undefined,
        menu: String(args.menu),
        withApi: args.withApi ? args.withApi !== 'no' : true,
        projectRoot,
        templatesRoot,
      });
      const rel = (p: string) => path.relative(projectRoot, p);
      console.log(`\n✓ Webview view "${args.name}" added.\n`);
      if (result.created.length) {
        console.log('  Created:');
        for (const f of result.created) console.log(`    + ${rel(f)}`);
      }
      if (result.modified.length) {
        console.log('  Modified:');
        for (const f of result.modified) console.log(`    ~ ${rel(f)}`);
      }
      console.log(
        result.genRan
          ? '\n  Registry + package.json updated. Run `bun run launch` to try it.\n'
          : '\n  Run `bun run gen` to register, then `bun run launch`.\n',
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

export default addSubpanelCommand;
