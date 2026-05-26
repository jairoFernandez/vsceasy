import * as fs from 'fs';
import * as path from 'path';
import { spawnSync } from 'child_process';
import { substitute } from '../scaffold';
import { editMenu } from '../menu/edit';
import { assertId, assertNoOverwrite, assertSiblingExists } from '../validate';
import { readConfig } from '../config';

export interface AddCommandOptions {
  /** Command id — camelCase. Becomes file basename and command suffix. */
  name: string;
  /** Command palette title. Defaults to PascalCase(name). */
  title?: string;
  /** Optional category prefix. */
  category?: string;
  /** Insert into this menu (file basename in src/menus/). */
  menuEntry?: string;
  /** Parent group label inside the menu. undefined = root. */
  group?: string;
  /** Codicon name shown next to menu entry. */
  icon?: string;
  /** Keyboard shortcut (e.g. 'ctrl+shift+h'). Written into the command file. */
  keybinding?: string;
  /** Project root. */
  projectRoot: string;
  /** Bundled templates root. */
  templatesRoot: string;
  /** Run `bun run gen` after writing. Default true. */
  runGen?: boolean;
}

export interface AddCommandResult {
  created: string[];
  modified: string[];
  menuUpdated: boolean;
  genRan: boolean;
}

export function addCommand(opts: AddCommandOptions): AddCommandResult {
  const name = assertId('command name', normalizeCamel(opts.name));
  const Pascal = name.charAt(0).toUpperCase() + name.slice(1);
  const title = (opts.title ?? Pascal).trim() || Pascal;

  const file = path.join(opts.projectRoot, 'src', 'commands', `${name}.ts`);
  assertNoOverwrite(opts.projectRoot, file, 'Command');

  if (opts.menuEntry) assertSiblingExists(opts.projectRoot, 'menu', opts.menuEntry);

  const tplPath = path.join(opts.templatesRoot, '_generators', 'command', 'command.ts.tpl');
  if (!fs.existsSync(tplPath)) throw new Error(`Template missing: ${tplPath}`);

  const cfg = readConfig(opts.projectRoot);
  const category = opts.category ?? cfg.defaultCategory;

  const vars: Record<string, string> = {
    name,
    Name: Pascal,
    title,
    categoryLine: category ? `\n  category: '${escapeQuotes(category)}',` : '',
    keybindingLine: opts.keybinding ? `\n  keybinding: '${escapeQuotes(opts.keybinding)}',` : '',
  };

  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, substitute(fs.readFileSync(tplPath, 'utf8'), vars));

  const created = [file];
  const modified: string[] = [];
  let menuUpdated = false;

  if (opts.menuEntry) {
    const result = editMenu({
      projectRoot: opts.projectRoot,
      menuName: opts.menuEntry,
      runGen: false,
      item: {
        label: title,
        kind: 'command',
        target: name,
        icon: opts.icon || undefined,
        parentLabel: opts.group || undefined,
      },
    });
    modified.push(result.file);
    menuUpdated = true;
  }

  let genRan = false;
  if (opts.runGen !== false) genRan = runGen(opts.projectRoot);

  return { created, modified, menuUpdated, genRan };
}

function runGen(cwd: string): boolean {
  const tryRun = (cmd: string, args: string[]) => {
    const r = spawnSync(cmd, args, { cwd, stdio: 'inherit' });
    return r.status === 0;
  };
  if (which('bun') && tryRun('bun', ['run', 'gen'])) return true;
  if (which('npm') && tryRun('npm', ['run', 'gen'])) return true;
  console.warn('\n! Could not run "gen" automatically. Run `bun run gen` manually.\n');
  return false;
}

function which(cmd: string): boolean {
  const r = spawnSync(process.platform === 'win32' ? 'where' : 'which', [cmd], { stdio: 'ignore' });
  return r.status === 0;
}

function escapeQuotes(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

function normalizeCamel(s: string): string {
  const cleaned = s.trim().replace(/[^a-zA-Z0-9]+(.)/g, (_m, c) => c.toUpperCase()).replace(/[^a-zA-Z0-9]/g, '');
  if (!cleaned) return '';
  return cleaned.charAt(0).toLowerCase() + cleaned.slice(1);
}
