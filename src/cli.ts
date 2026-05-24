import { CLI } from '@ideascol/cli-maker';

import CommandCreate from './commands/createCommand';
import CommandDoctor from './commands/doctorCommand';
import CommandUpgrade from './commands/upgradeCommand';
import { PanelGroup, MenuGroup, CommandGroup, RpcGroup, StatusBarGroup } from './commands/groups';

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
    defaultCommands: {
      rotatePassphrase: false,
      aiGuide: true,
    },
  },
);

cli.command(CommandCreate);
cli.command(PanelGroup);
cli.command(MenuGroup);
cli.command(CommandGroup);
cli.command(RpcGroup);
cli.command(StatusBarGroup);
cli.command(CommandDoctor);
cli.command(CommandUpgrade);

cli.parse(process.argv);

export { cli };
