import { Command, ParamType } from '@ideascol/cli-maker';
import * as path from 'path';
import { initDb } from '../../lib/db/init';
import { wireInitDb } from '../../lib/db/wire';
import { findProjectRoot, findTemplatesRoot } from '../../lib/findProject';

const dbInitCommand: Command = {
  name: 'init',
  description: 'Initialize the project database (mini-ORM) at src/helpers/db.ts. Idempotent.',
  params: [
    {
      name: 'provider',
      description: 'Storage provider (filesystem JSON under storageUri or globalStorageUri)',
      required: false,
      type: ParamType.List,
      options: ['storage', 'global'],
      defaultValue: 'storage',
    },
    {
      name: 'force',
      description: 'Overwrite existing src/helpers/db.ts',
      required: false,
      type: ParamType.Boolean,
    },
  ],
  action: async (args) => {
    try {
      const projectRoot = findProjectRoot();
      const templatesRoot = findTemplatesRoot();
      const result = initDb({
        projectRoot,
        templatesRoot,
        provider: (args.provider ?? 'storage') as 'storage' | 'global',
        force: !!args.force,
      });
      const rel = (p: string) => path.relative(projectRoot, p);
      if (result.created.length) {
        console.log(`\n✓ Database initialized (provider: ${result.provider}).\n`);
        for (const f of result.created) console.log(`  + ${rel(f)}`);
      } else {
        console.log(`\n· src/helpers/db.ts already exists — nothing to do.`);
        console.log(`  Use --force=true to overwrite.`);
      }

      // Auto-wire into extension entry
      const wire = wireInitDb(projectRoot);
      if (wire.status === 'wired') {
        console.log(`  ~ wired initDb(context) into ${rel(wire.path)}`);
      } else if (wire.status === 'already-wired') {
        console.log(`  · ${rel(wire.path)} already wires initDb`);
      } else if (wire.status === 'unrecognized') {
        console.log(`\n  ! Could not auto-wire — patch ${rel(wire.path)} manually:`);
        console.log(`      import { initDb } from '../helpers/db';`);
        console.log(`      bootstrap(registry, { onActivate: [initDb] })`);
      } else if (wire.status === 'no-entry') {
        console.log(`\n  ! ${rel(wire.path)} not found — wire on activate manually.`);
      }

      console.log(`\n  Add your first model:\n    vsceasy model add --name User\n`);
    } catch (err: any) {
      console.error(`\n✗ ${err.message}\n`);
      process.exitCode = 1;
    }
  },
};

export default dbInitCommand;
