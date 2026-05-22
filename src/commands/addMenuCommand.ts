import { Command, ParamType } from '@ideascol/cli-maker';
import * as path from 'path';
import { addMenu } from '../lib/addMenu';
import { findProjectRoot, findTemplatesRoot } from '../lib/findProject';
import { askText, style } from '../lib/interactive';
import { pickIcon } from '../lib/iconPicker';

const addMenuCommand: Command = {
  name: 'addMenu',
  description: 'Add a sidebar menu (activity bar icon + tree view) to an existing vsxf project',
  params: [
    { name: 'name', description: 'Menu id (e.g. main)', required: false, type: ParamType.Text },
    { name: 'title', description: 'Title shown at the top of the sidebar panel', required: false, type: ParamType.Text },
    { name: 'icon', description: 'Codicon name (e.g. rocket, gear) — prompted with picker if omitted', required: false, type: ParamType.Text },
  ],
  action: async (args) => {
    try {
      const projectRoot = findProjectRoot();
      const templatesRoot = findTemplatesRoot(__dirname);

      const name = args.name || await askName();
      if (!name) throw new Error('Menu name is required');

      const title = args.title || await askText('Title shown in sidebar', defaultTitle(name));

      const header = (label: string) => {
        if (process.stdout.isTTY) process.stdout.write('\x1b[2J\x1b[H');
        console.log(`${style.BOLD}${style.CYAN}vsxf addMenu${style.RST}  ${style.DIM}— ${label}${style.RST}`);
        console.log(`  ${style.DIM}name:${style.RST}  ${name}`);
        console.log(`  ${style.DIM}title:${style.RST} ${title}`);
        console.log();
      };

      const icon = args.icon || await pickIcon({ onBeforeStep: header, allowNone: false });

      const result = addMenu({
        name,
        title,
        icon,
        projectRoot,
        templatesRoot,
      });

      const rel = (p: string) => path.relative(projectRoot, p);
      console.log(`\n${style.GREEN}✓${style.RST} Menu "${name}" added.\n`);
      console.log('  Created:');
      for (const f of result.created) console.log(`    + ${rel(f)}`);
      console.log(
        result.genRan
          ? `\n  ${style.DIM}Registry + package.json updated. Edit menu file to wire panels/commands, then \`bun run launch\`.${style.RST}\n`
          : `\n  ${style.DIM}Run \`bun run gen\` to register the menu, then \`bun run launch\`.${style.RST}\n`,
      );
    } catch (err: any) {
      console.error(`\n${style.YELLOW}✗${style.RST} ${err.message}\n`);
      process.exitCode = 1;
    }
  },
};

function defaultTitle(name: string): string {
  if (!name) return '';
  return name.charAt(0).toUpperCase() + name.slice(1);
}

async function askName(): Promise<string> {
  if (process.stdout.isTTY) process.stdout.write('\x1b[2J\x1b[H');
  console.log(`${style.BOLD}${style.CYAN}vsxf addMenu${style.RST}  ${style.DIM}— Menu name${style.RST}\n`);
  return askText('Menu id (e.g. main)');
}

export default addMenuCommand;
