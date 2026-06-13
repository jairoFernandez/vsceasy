import { Command } from '@ideascol/cli-maker';
import { runWizard } from '../lib/wizard/run';
import { findTemplatesRoot } from '../lib/findProject';

const wizardCommand: Command = {
  name: 'wizard',
  description: 'Interactive guided flow — create a project or add features step by step',
  params: [],
  action: async () => {
    try {
      await runWizard({ templatesRoot: findTemplatesRoot(__dirname) });
    } catch (err: any) {
      console.error(`\n✗ ${err.message}\n`);
      process.exitCode = 1;
    }
  },
};

export default wizardCommand;
