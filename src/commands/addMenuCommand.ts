import { Command, ParamType } from '@ideascol/cli-maker';
import * as path from 'path';
import { addMenu } from '../lib/addMenu';
import { findProjectRoot, findTemplatesRoot } from '../lib/findProject';
import { CODICONS, isKnownCodicon } from '../data/codicons';

const addMenuCommand: Command = {
  name: 'add',
  description: 'Add a sidebar menu (activity bar icon + tree view) to an existing vsxf project',
  params: [
    { name: 'name', description: 'Menu id (e.g. main)', required: true, type: ParamType.Text },
    { name: 'title', description: 'Title shown at the top of the sidebar panel', required: false, type: ParamType.Text },
    {
      name: 'icon',
      description: 'Codicon name (e.g. rocket, gear)',
      required: true,
      type: ParamType.List,
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
      if (!name) throw new Error('Menu name is required');

      const title = (args.title ?? '').trim() || defaultTitle(name);

      const icon = String(args.icon).trim();
      if (!isKnownCodicon(icon)) {
        console.warn(`  (note: "${icon}" not in bundled codicon list — assuming valid)`);
      }

      const result = addMenu({ name, title, icon, projectRoot, templatesRoot });

      const rel = (p: string) => path.relative(projectRoot, p);
      console.log(`\n✓ Menu "${name}" added.\n`);
      console.log('  Created:');
      for (const f of result.created) console.log(`    + ${rel(f)}`);
      console.log(
        result.genRan
          ? '\n  Registry + package.json updated. Edit menu file to wire panels/commands, then `bun run launch`.\n'
          : '\n  Run `bun run gen` to register the menu, then `bun run launch`.\n',
      );
    } catch (err: any) {
      console.error(`\n✗ ${err.message}\n`);
      process.exitCode = 1;
    }
  },
};

function defaultTitle(name: string): string {
  if (!name) return '';
  return name.charAt(0).toUpperCase() + name.slice(1);
}

export default addMenuCommand;
