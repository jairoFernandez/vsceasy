import { Command, ParamType } from '@ideascol/cli-maker';
import { upgrade, FileChange } from '../lib/upgrade';
import { findProjectRoot, findTemplatesRoot } from '../lib/findProject';

const ICONS: Record<FileChange['status'], string> = {
  'in-sync': '✓',
  'would-create': '+',
  'would-update': '~',
  'created': '+',
  'updated': '~',
  'missing-source': '!',
};
const COLORS = {
  ok: '\x1b[32m',
  warn: '\x1b[33m',
  err: '\x1b[31m',
  dim: '\x1b[90m',
  reset: '\x1b[0m',
  bold: '\x1b[1m',
};

const upgradeCommand: Command = {
  name: 'upgrade',
  description: 'Sync framework-owned files (src/shared/vsceasy/*, scripts/gen.ts) from the bundled templates',
  params: [
    {
      name: 'apply',
      description: 'Apply changes (default: dry-run only)',
      required: false,
      type: ParamType.Boolean,
    },
    {
      name: 'ui',
      description: 'Template UI variant',
      required: false,
      type: ParamType.List,
      options: ['react'],
      defaultValue: 'react',
    },
    {
      name: 'skipGen',
      description: 'Skip running `bun run gen` after apply',
      required: false,
      type: ParamType.Boolean,
    },
  ],
  action: async (args) => {
    try {
      const projectRoot = findProjectRoot();
      const templatesRoot = findTemplatesRoot(__dirname);
      const apply = args.apply === true || args.apply === 'true';

      const result = upgrade({
        projectRoot,
        templatesRoot,
        ui: (args.ui as string | undefined) ?? 'react',
        apply,
        runGen: !(args.skipGen === true || args.skipGen === 'true'),
      });

      console.log(`\n${COLORS.bold}vsceasy upgrade${COLORS.reset} ${COLORS.dim}— ${projectRoot}${COLORS.reset}\n`);

      let updates = 0, creates = 0, inSync = 0, missing = 0;
      for (const c of result.changes) {
        const color =
          c.status === 'in-sync' ? COLORS.dim :
          c.status === 'missing-source' ? COLORS.err :
          COLORS.warn;
        console.log(`  ${color}${ICONS[c.status]}${COLORS.reset} ${c.path}  ${COLORS.dim}${labelFor(c.status)}${COLORS.reset}`);
        if (c.status === 'in-sync') inSync++;
        else if (c.status === 'would-create' || c.status === 'created') creates++;
        else if (c.status === 'would-update' || c.status === 'updated') updates++;
        else if (c.status === 'missing-source') missing++;
      }

      console.log('');
      if (result.applied) {
        console.log(`  ${COLORS.ok}${creates + updates} file(s) written${COLORS.reset} · ${inSync} in sync${missing ? ` · ${COLORS.err}${missing} missing source${COLORS.reset}` : ''}`);
        if (result.genRan) {
          console.log(`  ${COLORS.dim}Registry regenerated.${COLORS.reset}`);
        } else if (creates + updates > 0) {
          console.log(`  ${COLORS.dim}Run \`bun run gen\` to refresh the registry.${COLORS.reset}`);
        }
      } else {
        const pending = creates + updates;
        if (pending === 0) {
          console.log(`  ${COLORS.ok}Already up to date.${COLORS.reset}`);
        } else {
          console.log(`  ${COLORS.warn}${pending} file(s) would change.${COLORS.reset} Re-run with ${COLORS.bold}--apply=true${COLORS.reset} to write them.`);
        }
        if (missing) {
          console.log(`  ${COLORS.err}${missing} template source(s) missing — your bundled framework may be incomplete.${COLORS.reset}`);
        }
      }
      console.log('');
    } catch (err: any) {
      console.error(`\n✗ ${err.message}\n`);
      process.exitCode = 1;
    }
  },
};

function labelFor(status: FileChange['status']): string {
  switch (status) {
    case 'in-sync': return 'in sync';
    case 'would-create': return 'would create';
    case 'would-update': return 'would update';
    case 'created': return 'created';
    case 'updated': return 'updated';
    case 'missing-source': return 'TEMPLATE MISSING';
  }
}

export default upgradeCommand;
