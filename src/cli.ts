import { CLI } from '@ideascol/cli-maker';

import CommandCreate from './commands/create';
import CommandDoctor from './commands/doctor';
import CommandUpgrade from './commands/upgrade';
import { PanelGroup, MenuGroup, CommandGroup, RpcGroup, StatusBarGroup, SubpanelGroup, TreeViewGroup, TestGroup, PublishGroup } from './commands/groups';

const cli = new CLI(
  'vsceasy',
  'Build VS Code extensions fast — React UI + typed RPC bridge + zero-config build.',
  {
    interactive: true,
    version: '0.1.0',
    introAnimation: {
      enabled: true,
      preset: 'retro-space',
      title: 'vsceasy',
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
cli.command(SubpanelGroup);
cli.command(TreeViewGroup);
cli.command(TestGroup);
cli.command(PublishGroup);
cli.command(CommandDoctor);
cli.command(CommandUpgrade);

cli.parse(process.argv);

export { cli };
