import * as fs from 'fs';
import * as path from 'path';
import { spawnSync } from 'child_process';
import { substitute } from '../scaffold';

export interface AddMenuOptions {
  name: string;
  title?: string;
  icon?: string;
  projectRoot: string;
  templatesRoot: string;
  runGen?: boolean;
}

export interface AddMenuResult {
  created: string[];
  genRan: boolean;
}

export function addMenu(opts: AddMenuOptions): AddMenuResult {
  const name = normalizeCamel(opts.name);
  if (!name) throw new Error(`Invalid menu name: ${opts.name}`);
  const Pascal = name.charAt(0).toUpperCase() + name.slice(1);
  const title = opts.title ?? Pascal;
  const icon = opts.icon ?? 'symbol-misc';

  const menuTs = path.join(opts.projectRoot, 'src', 'menus', `${name}.ts`);
  if (fs.existsSync(menuTs)) {
    throw new Error(`Menu already exists: ${path.relative(opts.projectRoot, menuTs)}`);
  }

  const tplPath = path.join(opts.templatesRoot, '_generators', 'menu', 'menu.ts.tpl');
  const body = substitute(fs.readFileSync(tplPath, 'utf8'), { name, Name: Pascal, title, icon });

  fs.mkdirSync(path.dirname(menuTs), { recursive: true });
  fs.writeFileSync(menuTs, body);

  const created = [menuTs];

  let genRan = false;
  if (opts.runGen !== false) genRan = runGen(opts.projectRoot);

  return { created, genRan };
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

function normalizeCamel(s: string): string {
  const cleaned = s.trim().replace(/[^a-zA-Z0-9]+(.)/g, (_m, c) => c.toUpperCase()).replace(/[^a-zA-Z0-9]/g, '');
  if (!cleaned) return '';
  return cleaned.charAt(0).toLowerCase() + cleaned.slice(1);
}
