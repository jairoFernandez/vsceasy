import { CLI } from '@ideascol/cli-maker';

import CommandGreet from './commands/greetCommand';

const cli = new CLI('@ideascol/vscode-extension-framework', 'Framework para crear VSCode extensions rapido con UI React/Svelte/Vue/Vanilla, RPC tipado webview-extension, y file-based routing de panels/commands', {
  interactive: true,
  version: '1.0.0',
  introAnimation: {
    enabled: true,
    preset: 'retro-space', // Change to other presets or override fields below
    title: '{{cliName}}',
    subtitle: '{{cliDescription}}',
  },
});

cli.command(CommandGreet);

cli.parse(process.argv);

export { cli };
