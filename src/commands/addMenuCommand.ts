import { Command, ParamType } from '@ideascol/cli-maker';
import * as path from 'path';
import { addMenu } from '../lib/addMenu';
import { findProjectRoot, findTemplatesRoot } from '../lib/findProject';

const addMenuCommand: Command = {
  name: 'addMenu',
  description: 'Add a sidebar menu (activity bar icon + tree view) to an existing vsxf project',
  params: [
    { name: 'name', description: 'Menu id (e.g. main)', required: true, type: ParamType.Text },
    { name: 'title', description: 'Title shown at the top of the sidebar panel', required: false, type: ParamType.Text },
    { name: 'icon', description: 'Codicon name (e.g. rocket, gear) — see https://microsoft.github.io/vscode-codicons/dist/codicon.html', required: false, type: ParamType.Text },
  ],
  action: async (args) => {
    try {
      const projectRoot = findProjectRoot();
      const templatesRoot = findTemplatesRoot(__dirname);
      const result = addMenu({
        name: args.name,
        title: args.title,
        icon: args.icon,
        projectRoot,
        templatesRoot,
      });

      const rel = (p: string) => path.relative(projectRoot, p);
      console.log(`\n✓ Menu "${args.name}" added.\n`);
      console.log('  Created:');
      for (const f of result.created) console.log(`    + ${rel(f)}`);
      console.log(
        result.genRan
          ? '\n  Registry + package.json updated. Edit the menu file to wire up panels/commands, then `bun run launch`.\n'
          : '\n  Run `bun run gen` to register the menu, then `bun run launch`.\n',
      );
    } catch (err: any) {
      console.error(`\n✗ ${err.message}\n`);
      process.exitCode = 1;
    }
  },
};

export default addMenuCommand;
