import { Command, ParamType } from '@ideascol/cli-maker';
import * as path from 'path';
import { addComponents } from '../../lib/components/add';
import { findProjectRoot, findTemplatesRoot } from '../../lib/findProject';

const addComponentsCommand: Command = {
  name: 'add',
  description: 'Generate a theme-aware React component library into src/webview/components/',
  params: [
    {
      name: 'force',
      description: 'Overwrite existing component files',
      required: false,
      type: ParamType.Boolean,
    },
  ],
  action: async (args) => {
    try {
      const projectRoot = findProjectRoot();
      const templatesRoot = findTemplatesRoot();
      const result = addComponents({ projectRoot, templatesRoot, force: !!args.force });
      const rel = (p: string) => path.relative(projectRoot, p);

      console.log(`\n✓ Components ready in ${rel(result.dir)}.\n`);
      for (const f of result.created) console.log(`  + ${rel(f)}`);
      for (const f of result.skipped) console.log(`  · ${rel(f)} (already exists — use --force to overwrite)`);
      console.log(
        `\n  Usage:\n    import { Button, Input, Field, Card, List } from '../../components';\n    import '../../components/components.css';\n`,
      );
    } catch (err: any) {
      console.error(`\n✗ ${err.message}\n`);
      process.exitCode = 1;
    }
  },
};

export default addComponentsCommand;
