import { Command, ParamType } from '@ideascol/cli-maker';
import * as path from 'path';
import * as fs from 'fs';
import { scaffold } from '../lib/scaffold';

function findTemplatesRoot(): string {
  // Walk up from compiled file looking for `templates/` sibling.
  const candidates = [
    path.resolve(__dirname, '..', 'templates'),       // dist/commands -> dist/../templates
    path.resolve(__dirname, '..', '..', 'templates'), // src/commands -> src/../../templates
  ];
  for (const c of candidates) if (fs.existsSync(c)) return c;
  throw new Error('templates/ directory not found near ' + __dirname);
}

const createCommand: Command = {
  name: 'create',
  description: 'Scaffold a new VS Code extension project',
  params: [
    { name: 'name', description: 'Extension package name (e.g. my-extension or @scope/my-ext)', required: true, type: ParamType.Text },
    { name: 'displayName', description: 'Human-readable extension name', required: false, type: ParamType.Text },
    { name: 'description', description: 'Short description', required: false, type: ParamType.Text },
    { name: 'publisher', description: 'VS Code publisher id', required: false, type: ParamType.Text },
    { name: 'ui', description: 'UI framework', required: false, type: ParamType.List, options: ['react'] },
    { name: 'dir', description: 'Target directory (defaults to ./<name>)', required: false, type: ParamType.Text },
  ],
  action: async (args) => {
    const name: string = args.name;
    const simpleName = name.replace(/^@[^/]+\//, '');
    const ui = (args.ui ?? 'react') as 'react';
    const targetDir = path.resolve(process.cwd(), args.dir ?? simpleName);

    try {
      await scaffold({
        name,
        displayName: args.displayName ?? toTitle(simpleName),
        description: args.description ?? `${simpleName} VS Code extension`,
        publisher: args.publisher ?? 'your-publisher',
        ui,
        targetDir,
        templatesRoot: findTemplatesRoot(),
      });
      const rel = path.relative(process.cwd(), targetDir) || '.';
      console.log(`\n✓ Created ${name} at ${rel}\n`);
      console.log('Next steps:');
      console.log(`  cd ${rel}`);
      console.log('  bun install');
      console.log('  bun run dev');
      console.log('  # then press F5 in VS Code to launch the extension host\n');
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
