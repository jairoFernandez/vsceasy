import { Command, ParamType } from '@ideascol/cli-maker';
import * as path from 'path';
import { addHelper, HELPER_KINDS, HelperKind } from '../../lib/helper/add';
import { findProjectRoot, findTemplatesRoot } from '../../lib/findProject';

const addHelperCommand: Command = {
  name: 'add',
  description: 'Generate a typed helper (secrets, config, state, notifications, cache, colorize) into src/helpers/',
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
      const templatesRoot = findTemplatesRoot();
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
      } else if (args.kind === 'cache') {
        console.log(
          `\n  Usage:\n    import { createCache } from '../helpers/cache';\n    const cache = createCache<User>({ ttlMs: 60_000, max: 200 });\n    const u = await cache.wrap('user:' + id, () => orm(User).findById(id));\n`,
        );
      } else if (args.kind === 'colorize') {
        console.log(
          `\n  Usage (auto-apply scoped token colors on activate):\n    import { applyTokenColors } from '../helpers/colorize';\n    await applyTokenColors('source.mylang', [\n      { scope: 'entity.name.section.mylang', settings: { foreground: '#e6c07b', fontStyle: 'bold' } },\n    ]);\n    // add a "<prefix>.colorize" boolean to contributes.configuration to opt out\n`,
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
