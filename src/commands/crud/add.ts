import { Command, ParamType, prompt } from '@ideascol/cli-maker';
import * as path from 'path';
import * as fs from 'fs';
import { addCrud } from '../../lib/crud/add';
import { listMenus } from '../../lib/menu/edit';
import { findProjectRoot, findTemplatesRoot } from '../../lib/findProject';

const NONE_SENTINEL = '(no menu)';
const NEW_SENTINEL = '(create new menu)';

const addCrudCommand: Command = {
  name: 'add',
  description:
    'Generate full CRUD (service + list panel + form panel + RPC + optional menu) for an existing model. Rails-style scaffolding.',
  params: [
    {
      name: 'model',
      description: 'Model name (file basename in src/models/, e.g. `User`)',
      required: true,
      type: ParamType.List,
      optionsLoader: () => {
        const dir = path.join(findProjectRoot(), 'src', 'models');
        if (!fs.existsSync(dir)) {
          throw new Error('No models found. Run `vsceasy db init && vsceasy model add --name User` first.');
        }
        const names = fs
          .readdirSync(dir)
          .filter((f) => f.endsWith('.ts') && !f.endsWith('.crud.ts'))
          .map((f) => f.replace(/\.ts$/, ''))
          .sort();
        if (names.length === 0) {
          throw new Error('No models found in src/models/. Run `vsceasy model add --name User` first.');
        }
        return names;
      },
    },
    {
      name: 'menu',
      description: 'Menu wiring policy',
      required: false,
      type: ParamType.List,
      optionsLoader: () => {
        const menus = listMenus(findProjectRoot());
        return [NONE_SENTINEL, NEW_SENTINEL, ...menus];
      },
      defaultValue: NONE_SENTINEL,
    },
    {
      name: 'newMenuId',
      description: 'New menu id (only when menu = create new)',
      required: false,
      type: ParamType.Text,
      when: (a: any) => a.menu === NEW_SENTINEL,
    },
  ],
  action: async (args) => {
    try {
      const projectRoot = findProjectRoot();
      const templatesRoot = findTemplatesRoot();

      let menuSpec: string | undefined;
      const choice = String(args.menu ?? NONE_SENTINEL).trim();
      // Accept raw policy strings from flags (e.g. --menu none, --menu new:todos,
      // --menu existing:settings) as well as the interactive sentinels.
      if (choice === NONE_SENTINEL || choice === 'none') {
        menuSpec = 'none';
      } else if (choice === NEW_SENTINEL) {
        const id = args.newMenuId ? String(args.newMenuId).trim() : await prompt('  new menu id: ');
        if (!id) throw new Error('New menu id required.');
        menuSpec = `new:${id}`;
      } else if (choice.startsWith('new:') || choice.startsWith('existing:')) {
        menuSpec = choice;
      } else {
        menuSpec = `existing:${choice}`;
      }

      const result = addCrud({
        model: String(args.model).trim(),
        menu: menuSpec,
        projectRoot,
        templatesRoot,
      });

      const rel = (p: string) => path.relative(projectRoot, p);
      console.log(`\n✓ CRUD scaffolded for ${args.model}.\n`);
      for (const f of result.created) console.log(`  + ${rel(f)}`);
      for (const f of result.modified) console.log(`  ~ ${rel(f)}`);
      if (result.menu) {
        console.log(
          `  ${result.menu.created ? '+ menu' : '~ menu'} "${result.menu.id}" wired with List + New entries`,
        );
      }
      console.log(
        result.genRan
          ? '\n  Registry + package.json updated. Reload extension to try it.\n'
          : '\n  Run `bun run gen` to register, then reload.\n',
      );
    } catch (err: any) {
      console.error(`\n✗ ${err.message}\n`);
      process.exitCode = 1;
    }
  },
};

export default addCrudCommand;
