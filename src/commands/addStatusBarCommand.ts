import { Command, ParamType } from '@ideascol/cli-maker';
import * as path from 'path';
import { addStatusBar } from '../lib/addStatusBar';
import { findProjectRoot, findTemplatesRoot } from '../lib/findProject';
import { listCommands } from '../lib/editMenu';
import { CODICONS, isKnownCodicon } from '../data/codicons';

const NEW_CMD_SENTINEL = '(create new)';

const addStatusBarCommand: Command = {
  name: 'addStatusBar',
  description: 'Add a status bar item bound to a command',
  params: [
    { name: 'name', description: 'Status bar id (camelCase, e.g. buildBtn)', required: true, type: ParamType.Text },
    { name: 'text', description: 'Display text shown in the status bar', required: true, type: ParamType.Text },
    {
      name: 'alignment',
      description: 'Side of the status bar',
      required: false,
      type: ParamType.List,
      options: ['left', 'right'],
      defaultValue: 'left',
    },
    {
      name: 'priority',
      description: 'Sort priority (higher = leftmost on its side)',
      required: false,
      type: ParamType.Number,
      defaultValue: 100,
    },
    {
      name: 'command',
      description: 'Command to run on click',
      required: true,
      type: ParamType.List,
      optionsLoader: () => {
        const cmds = listCommands(findProjectRoot());
        return [NEW_CMD_SENTINEL, ...cmds];
      },
    },
    {
      name: 'newCommandTitle',
      description: 'Title of the new command to create',
      required: true,
      type: ParamType.Text,
      when: (a) => a.command === NEW_CMD_SENTINEL,
      defaultValue: (a: Record<string, any>) => a.text ?? '',
    },
    {
      name: 'tooltip',
      description: 'Hover tooltip',
      required: false,
      type: ParamType.Text,
    },
    {
      name: 'icon',
      description: 'Codicon prepended to text',
      required: false,
      type: ParamType.List,
      optionsLoader: () => CODICONS.map((c) => c.name),
      optionLabel: (name: string) => {
        const c = CODICONS.find((x) => x.name === name);
        return c ? `${name}  \x1b[90m— ${c.category}\x1b[0m` : name;
      },
      pageSize: 12,
    },
  ],
  action: async (args) => {
    try {
      const projectRoot = findProjectRoot();
      const templatesRoot = findTemplatesRoot(__dirname);

      const isNewCmd = args.command === NEW_CMD_SENTINEL;
      const commandId = isNewCmd ? undefined : String(args.command);

      const icon = args.icon ? String(args.icon).trim() : undefined;
      if (icon && !isKnownCodicon(icon)) {
        console.warn(`  (note: "${icon}" not in bundled codicon list — assuming valid)`);
      }

      const result = addStatusBar({
        name: String(args.name),
        text: String(args.text),
        alignment: args.alignment as 'left' | 'right' | undefined,
        priority: args.priority != null ? Number(args.priority) : undefined,
        tooltip: args.tooltip ? String(args.tooltip) : undefined,
        icon,
        command: commandId,
        newCommandTitle: isNewCmd ? String(args.newCommandTitle) : undefined,
        projectRoot,
        templatesRoot,
      });

      const rel = (p: string) => path.relative(projectRoot, p);
      console.log(`\n✓ Status bar "${args.name}" added.\n`);
      console.log('  Created:');
      for (const f of result.created) console.log(`    + ${rel(f)}`);
      if (result.commandCreated) {
        console.log(`    + src/commands/${result.commandCreated}.ts  (new command)`);
      }
      console.log(
        result.genRan
          ? '\n  Registry + package.json updated. Run `bun run launch` to try it.\n'
          : '\n  Run `bun run gen` to register, then `bun run launch`.\n',
      );
    } catch (err: any) {
      console.error(`\n✗ ${err.message}\n`);
      process.exitCode = 1;
    }
  },
};

export default addStatusBarCommand;
