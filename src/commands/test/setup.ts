import { Command, ParamType } from '@ideascol/cli-maker';
import * as path from 'path';
import { setupTests } from '../../lib/testSetup';
import { findProjectRoot, findTemplatesRoot } from '../../lib/findProject';

const testSetupCommand: Command = {
  name: 'setup',
  description: 'Add Vitest config + a sample test to this project',
  params: [
    { name: 'force', description: 'Overwrite existing test files', required: false, type: ParamType.Boolean },
  ],
  action: async (args) => {
    try {
      const projectRoot = findProjectRoot();
      const templatesRoot = findTemplatesRoot(__dirname);
      const result = setupTests({ projectRoot, templatesRoot, force: !!args.force });
      const rel = (p: string) => path.relative(projectRoot, p);
      console.log('\n✓ Test setup complete.\n');
      for (const f of result.created) console.log(`  + ${rel(f)}`);
      if (result.pkgUpdated) console.log('  ~ package.json scripts updated');
      console.log('\n  Next: `bun install && bun run test`\n');
    } catch (err: any) {
      console.error(`\n✗ ${err.message}\n`);
      process.exitCode = 1;
    }
  },
};

export default testSetupCommand;
