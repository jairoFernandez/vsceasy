import { CLI } from '@ideascol/cli-maker';

import CommandCreate from './commands/createCommand';
import CommandAddPanel from './commands/addPanelCommand';

const cli = new CLI(
  '@ideascol/vscode-extension-framework',
  'Build VS Code extensions fast — React UI + typed RPC bridge + zero-config build.',
  {
    interactive: true,
    version: '0.1.0',
    introAnimation: {
      enabled: true,
      preset: 'retro-space',
      title: 'vsxf',
      subtitle: 'VS Code Extension Framework',
    },
  },
);

cli.command(CommandCreate);
cli.command(CommandAddPanel);

cli.parse(process.argv);

export { cli };
