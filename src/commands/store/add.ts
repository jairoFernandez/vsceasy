import { Command, ParamType } from '@ideascol/cli-maker';
import * as path from 'path';
import { addStore, StoreType } from '../../lib/store/add';
import { findProjectRoot, findTemplatesRoot } from '../../lib/findProject';

const addStoreCommand: Command = {
  name: 'add',
  description:
    'Add a reactive store (an observable value) under src/stores/. Watch it on the host and listen in a webview to keep UI in sync.',
  params: [
    { name: 'name', description: 'Store name (camelCase, e.g. badgeCount)', required: true, type: ParamType.Text },
    {
      name: 'type',
      description: 'Value type',
      required: false,
      type: ParamType.List,
      options: ['number', 'string', 'boolean', 'json'],
    },
    {
      name: 'initial',
      description: 'Initial value expression (default per type: 0 / \'\' / false / null)',
      required: false,
      type: ParamType.Text,
    },
  ],
  action: async (args) => {
    try {
      const projectRoot = findProjectRoot();
      const templatesRoot = findTemplatesRoot();

      const result = addStore({
        name: String(args.name).trim(),
        type: args.type ? (String(args.type) as StoreType) : undefined,
        initial: args.initial ? String(args.initial) : undefined,
        projectRoot,
        templatesRoot,
      });

      const rel = (p: string) => path.relative(projectRoot, p);
      const name = String(args.name).trim();
      console.log(`\n✓ Store "${name}" created.\n`);
      for (const f of result.created) console.log(`  + ${rel(f)}`);
      console.log(`\n  Use it:\n    import { ${name} } from '../stores/${name}';\n    ${name}.set(...);  ${name}.update((v) => v);\n`);
      console.log(`  Push changes to a webview — host side, in a panel rpc():\n    watch(${name}, () => server.emit('${name}:changed', ${name}.get()));\n`);
      console.log(`  React in the webview:\n    listen(api, '${name}:changed', (v) => render(v));\n`);
    } catch (err: any) {
      console.error(`\n✗ ${err.message}\n`);
      process.exitCode = 1;
    }
  },
};

export default addStoreCommand;
