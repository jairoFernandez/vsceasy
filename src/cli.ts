import { CLI } from '@ideascol/cli-maker';

import CommandCreate from './commands/createCommand';
import CommandAddPanel from './commands/addPanelCommand';
import CommandAddMenu from './commands/addMenuCommand';
import CommandEditMenu from './commands/editMenuCommand';
import CommandAddCommand from './commands/addCommandCommand';
import CommandAddRpcMethod from './commands/addRpcMethodCommand';
import CommandAddStatusBar from './commands/addStatusBarCommand';
import CommandDoctor from './commands/doctorCommand';

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
cli.command(CommandEditMenu);
cli.command(CommandAddCommand);
cli.command(CommandAddRpcMethod);
cli.command(CommandAddStatusBar);
cli.command(CommandDoctor);

const commands = cli.getCommands();
const rotateIdx = commands.findIndex((c) => c.name === 'rotate-passphrase');
if (rotateIdx !== -1) {
  commands.splice(rotateIdx, 1);
}

cli.parse(process.argv);

export { cli };
