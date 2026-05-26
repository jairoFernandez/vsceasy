import { Command, ParamType } from '@ideascol/cli-maker';
import * as path from 'path';
import { addTreeView } from '../../lib/treeView/add';
import { findProjectRoot, findTemplatesRoot } from '../../lib/findProject';

const addTreeViewCommand: Command = {
  name: 'add',
  description: 'Add a data-driven tree view to an existing menu',
  params: [
    { name: 'name', description: 'Tree view id (e.g. explorer)', required: true, type: ParamType.Text },
    { name: 'menu', description: 'Menu container id (basename in src/menus)', required: true, type: ParamType.Text },
    { name: 'title', description: 'Section title (default: derived from name)', required: false, type: ParamType.Text },
  ],
  action: async (args) => {
    try {
      const projectRoot = findProjectRoot();
      const templatesRoot = findTemplatesRoot(__dirname);

      const result = addTreeView({
        name: String(args.name).trim(),
        menu: String(args.menu).trim(),
        title: args.title ? String(args.title).trim() : undefined,
        projectRoot,
        templatesRoot,
      });

      const rel = (p: string) => path.relative(projectRoot, p);
      console.log(`\n✓ Tree view "${args.name}" added under menu "${args.menu}".\n`);
      for (const f of result.created) console.log(`  + ${rel(f)}`);
      console.log(
        result.genRan
          ? '\n  Registry + package.json updated. Edit getChildren() to plug in real data.\n'
          : '\n  Run `bun run gen` to register, then `bun run launch`.\n',
      );
    } catch (err: any) {
      console.error(`\n✗ ${err.message}\n`);
      process.exitCode = 1;
    }
  },
};

export default addTreeViewCommand;
