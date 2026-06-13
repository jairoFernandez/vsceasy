import { Command, ParamType } from '@ideascol/cli-maker';
import * as path from 'path';
import { addPanel, PANEL_TEMPLATES, PanelTemplate } from '../../lib/panel/add';
import { findProjectRoot, findTemplatesRoot } from '../../lib/findProject';

const addPanelCommand: Command = {
  name: 'add',
  description: 'Add a new panel to an existing vsceasy extension project',
  params: [
    { name: 'name', description: 'Panel id (e.g. settings)', required: true, type: ParamType.Text },
    { name: 'title', description: 'Tab title shown in VS Code', required: false, type: ParamType.Text },
    {
      name: 'template',
      description: 'Starter UI (blank | form | list | dashboard)',
      required: false,
      type: ParamType.List,
      options: PANEL_TEMPLATES as unknown as any[],
    },
    {
      name: 'withApi',
      description: 'Generate typed RPC API interface (forced on for non-blank templates)',
      required: false,
      type: ParamType.List,
      options: ['yes', 'no'],
    },
  ],
  action: async (args) => {
    try {
      const projectRoot = findProjectRoot();
      const templatesRoot = findTemplatesRoot();
      const result = addPanel({
        name: args.name,
        title: args.title,
        template: (args.template as PanelTemplate) || undefined,
        withApi: args.withApi ? args.withApi !== 'no' : true,
        projectRoot,
        templatesRoot,
      });

      const rel = (p: string) => path.relative(projectRoot, p);
      console.log(`\n✓ Panel "${args.name}" added.\n`);
      if (result.created.length) {
        console.log('  Created:');
        for (const f of result.created) console.log(`    + ${rel(f)}`);
      }
      if (result.modified.length) {
        console.log('  Modified:');
        for (const f of result.modified) console.log(`    ~ ${rel(f)}`);
      }
      if (result.skipped.length) {
        console.log('  Skipped:');
        for (const f of result.skipped) console.log(`    · ${rel(f)}`);
      }
      console.log(
        result.genRan
          ? '\n  Registry + package.json updated. Run `bun run launch` to try it.\n'
          : '\n  Run `bun run gen` to wire up the new panel, then `bun run launch`.\n',
      );
    } catch (err: any) {
      console.error(`\n✗ ${err.message}\n`);
      process.exitCode = 1;
    }
  },
};

export default addPanelCommand;
