import { Command, ParamType } from '@ideascol/cli-maker';
import * as path from 'path';
import { addHelper, HELPER_KINDS, HelperKind } from '../../lib/helper/add';
import { findProjectRoot, findTemplatesRoot } from '../../lib/findProject';

const addHelperCommand: Command = {
  name: 'add',
  description: 'Generate a typed helper (secrets, config, state, notifications) into src/helpers/',
  params: [
    {
      name: 'kind',
      description: 'Helper kind',
      required: true,
      type: ParamType.List,
      options: HELPER_KINDS as unknown as any[],
    },
    {
      name: 'force',
      description: 'Overwrite existing helper file',
      required: false,
      type: ParamType.Boolean,
    },
  ],
  action: async (args) => {
    try {
      const projectRoot = findProjectRoot();
      const templatesRoot = findTemplatesRoot(__dirname);
      const result = addHelper({
        kind: String(args.kind) as HelperKind,
        force: !!args.force,
        projectRoot,
        templatesRoot,
      });
      const rel = (p: string) => path.relative(projectRoot, p);
      console.log(`\n✓ Helper "${args.kind}" ready.\n`);
      for (const f of result.created) console.log(`  + ${rel(f)}`);
      for (const f of result.skipped) console.log(`  · ${rel(f)} (already exists — use --force to overwrite)`);
      if (args.kind === 'secrets' || args.kind === 'state') {
        console.log(
          `\n  Wire it on activate:\n    import { init${capitalize(String(args.kind))} } from '../helpers/${args.kind}';\n    init${capitalize(String(args.kind))}(context);\n`,
        );
      } else {
        console.log('');
      }
    } catch (err: any) {
      console.error(`\n✗ ${err.message}\n`);
      process.exitCode = 1;
    }
  },
};

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export default addHelperCommand;
