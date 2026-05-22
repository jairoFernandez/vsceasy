import { CLI } from '@ideascol/cli-maker';

import CommandCreate from './commands/createCommand';
import CommandAddPanel from './commands/addPanelCommand';
import CommandAddMenu from './commands/addMenuCommand';

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
cli.command(CommandAddMenu);

const commands = cli.getCommands();
const rotateIdx = commands.findIndex((c) => c.name === 'rotate-passphrase');
if (rotateIdx !== -1) {
  commands.splice(rotateIdx, 1);
}

cli.parse(process.argv);

export { cli };
