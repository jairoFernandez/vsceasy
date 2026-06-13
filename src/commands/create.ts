import { Command, ParamType } from '@ideascol/cli-maker';
import * as path from 'path';
import { scaffold } from '../lib/scaffold';
import { findTemplatesRoot } from '../lib/findProject';

const createCommand: Command = {
  name: 'create',
  description: 'Scaffold a new VS Code extension project',
  params: [
    { name: 'name', description: 'Extension package name (e.g. my-extension or @scope/my-ext)', required: true, type: ParamType.Text },
    { name: 'displayName', description: 'Human-readable extension name', required: false, type: ParamType.Text },
    { name: 'description', description: 'Short description', required: false, type: ParamType.Text },
    { name: 'publisher', description: 'VS Code publisher id', required: false, type: ParamType.Text },
    { name: 'ui', description: 'UI framework', required: false, type: ParamType.List, options: ['react'] },
    { name: 'preset', description: 'Project preset (minimal = empty extension, full = panel + RPC sample)', required: false, type: ParamType.List, options: ['minimal', 'full'] },
    { name: 'dir', description: 'Target directory (defaults to ./<name>)', required: false, type: ParamType.Text },
  ],
  action: async (args) => {
    const name: string = args.name;
    const simpleName = name.replace(/^@[^/]+\//, '');
    const ui = (args.ui ?? 'react') as 'react';
    const preset = (args.preset ?? 'full') as 'minimal' | 'full';
    const targetDir = path.resolve(process.cwd(), args.dir ?? simpleName);

    try {
      await scaffold({
        name,
        displayName: args.displayName ?? toTitle(simpleName),
        description: args.description ?? `${simpleName} VS Code extension`,
        publisher: args.publisher ?? 'your-publisher',
        ui,
        preset,
        targetDir,
        templatesRoot: findTemplatesRoot(),
      });
      const rel = path.relative(process.cwd(), targetDir) || '.';
      console.log(`\n✓ Created ${name} at ${rel}\n`);
      console.log('Next steps:');
      console.log(`  cd ${rel}`);
      console.log('  bun install');
      console.log('  bun run launch        # builds + opens Extension Development Host');
      console.log('  # or `bun run dev` + F5 inside VS Code for watch mode\n');
    } catch (err: any) {
      console.error(`\n✗ Failed to scaffold: ${err.message}\n`);
      process.exitCode = 1;
    }
  },
};

function toTitle(s: string): string {
  return s.replace(/[-_]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export default createCommand;
