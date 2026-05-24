import { Command, ParamType } from '@ideascol/cli-maker';
import * as path from 'path';
import { addRpcMethod } from '../lib/addRpcMethod';
import { findProjectRoot } from '../lib/findProject';
import { listPanels } from '../lib/editMenu';

const addRpcMethodCommand: Command = {
  name: 'add',
  description: 'Add a typed RPC method to a panel — extends shared/api.ts + handler stub in the panel',
  params: [
    {
      name: 'panel',
      description: 'Panel id (file basename in src/panels/)',
      required: true,
      type: ParamType.List,
      optionsLoader: () => {
        const panels = listPanels(findProjectRoot());
        if (panels.length === 0) throw new Error('No panels found. Run `addPanel` first.');
        return panels;
      },
    },
    {
      name: 'method',
      description: 'Method name (camelCase, e.g. getCount)',
      required: true,
      type: ParamType.Text,
    },
    {
      name: 'params',
      description: 'Method parameters as TS signature (e.g. "pattern: string, limit?: number"). Empty for none.',
      required: false,
      type: ParamType.Text,
    },
    {
      name: 'returns',
      description: 'Return type (auto-wrapped in Promise<>). Default: void',
      required: false,
      type: ParamType.Text,
      defaultValue: 'void',
    },
  ],
  action: async (args) => {
    try {
      const projectRoot = findProjectRoot();
      const result = addRpcMethod({
        panel: String(args.panel),
        method: String(args.method),
        paramSig: args.params ? String(args.params) : '',
        returns: args.returns ? String(args.returns) : 'void',
        projectRoot,
      });

      const rel = (p: string) => path.relative(projectRoot, p);
      console.log(`\n✓ RPC method "${args.method}" added.\n`);
      console.log('  Modified:');
      console.log(`    ~ ${rel(result.apiFile)}${result.interfaceCreated ? '  (interface created)' : ''}`);
      console.log(`    ~ ${rel(result.panelFile)}${result.rpcBlockCreated ? '  (rpc block created)' : ''}`);
      console.log('\n  Call from webview:');
      console.log(`    ${result.webviewSnippet}\n`);
    } catch (err: any) {
      console.error(`\n✗ ${err.message}\n`);
      process.exitCode = 1;
    }
  },
};

export default addRpcMethodCommand;
