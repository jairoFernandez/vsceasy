import * as fs from 'fs';
import * as path from 'path';
import { spawnSync } from 'child_process';
import { substitute } from '../scaffold';
import { assertId, assertNoOverwrite, assertSiblingExists } from '../validate';

export interface AddTreeViewOptions {
  name: string;
  title?: string;
  menu: string;
  projectRoot: string;
  templatesRoot: string;
  runGen?: boolean;
}

export interface AddTreeViewResult {
  created: string[];
  genRan: boolean;
}

export function addTreeView(opts: AddTreeViewOptions): AddTreeViewResult {
  const name = assertId('tree view name', normalizeCamel(opts.name));
  const menu = assertId('menu id', normalizeCamel(opts.menu));
  assertSiblingExists(opts.projectRoot, 'menu', menu);

  const title = opts.title?.trim() || pascal(name);

  const target = path.join(opts.projectRoot, 'src', 'treeViews', `${name}.ts`);
  assertNoOverwrite(opts.projectRoot, target, 'Tree view');

  const tpl = path.join(opts.templatesRoot, '_generators', 'treeView', 'treeView.ts.tpl');
  const body = substitute(fs.readFileSync(tpl, 'utf8'), { name, Name: pascal(name), title, menu });
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, body);

  let genRan = false;
  if (opts.runGen !== false) genRan = runGen(opts.projectRoot);

  return { created: [target], genRan };
}

function runGen(cwd: string): boolean {
  const tryRun = (cmd: string, args: string[]) => spawnSync(cmd, args, { cwd, stdio: 'inherit' }).status === 0;
  if (which('bun') && tryRun('bun', ['run', 'gen'])) return true;
  if (which('npm') && tryRun('npm', ['run', 'gen'])) return true;
  console.warn('\n! Could not run "gen" automatically. Run `bun run gen` manually.\n');
  return false;
}

function which(cmd: string): boolean {
  return spawnSync(process.platform === 'win32' ? 'where' : 'which', [cmd], { stdio: 'ignore' }).status === 0;
}

function normalizeCamel(s: string): string {
  const cleaned = s.trim().replace(/[^a-zA-Z0-9]+(.)/g, (_m, c) => c.toUpperCase()).replace(/[^a-zA-Z0-9]/g, '');
  if (!cleaned) return '';
  return cleaned.charAt(0).toLowerCase() + cleaned.slice(1);
}

function pascal(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
