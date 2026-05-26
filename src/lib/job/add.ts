import * as fs from 'fs';
import * as path from 'path';
import { spawnSync } from 'child_process';
import { substitute } from '../scaffold';
import { assertId, assertNoOverwrite } from '../validate';

export type JobTrigger =
  | { every: string }
  | { dailyAt: string }
  | { on: 'startup' | 'saveDocument' | 'openDocument' | 'changeActiveEditor' | 'changeConfig' }
  | { onFile: string };

export interface AddJobOptions {
  name: string;
  title?: string;
  trigger: JobTrigger;
  /** Skip run if last successful execution was less than this many ms ago. */
  minIntervalMs?: number;
  projectRoot: string;
  templatesRoot: string;
  runGen?: boolean;
}

export interface AddJobResult {
  created: string[];
  genRan: boolean;
}

export function addJob(opts: AddJobOptions): AddJobResult {
  const name = assertId('job name', normalizeCamel(opts.name));
  const Pascal = name.charAt(0).toUpperCase() + name.slice(1);
  const title = opts.title?.trim() || Pascal;

  const target = path.join(opts.projectRoot, 'src', 'jobs', `${name}.ts`);
  assertNoOverwrite(opts.projectRoot, target, 'Job');

  const tpl = path.join(opts.templatesRoot, '_generators', 'job', 'job.ts.tpl');
  if (!fs.existsSync(tpl)) throw new Error(`Job template missing: ${tpl}`);

  const vars: Record<string, string> = {
    name,
    Name: Pascal,
    title,
    schedule: stringifyTrigger(opts.trigger),
    minIntervalLine: opts.minIntervalMs ? `\n  minIntervalMs: ${opts.minIntervalMs},` : '',
  };

  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, substitute(fs.readFileSync(tpl, 'utf8'), vars));

  let genRan = false;
  if (opts.runGen !== false) genRan = runGen(opts.projectRoot);

  return { created: [target], genRan };
}

function stringifyTrigger(t: JobTrigger): string {
  if ('every' in t) return `{ every: '${escape(t.every)}' }`;
  if ('dailyAt' in t) return `{ dailyAt: '${escape(t.dailyAt)}' }`;
  if ('on' in t) return `{ on: '${escape(t.on)}' }`;
  if ('onFile' in t) return `{ onFile: '${escape(t.onFile)}' }`;
  throw new Error('Job requires a schedule: --every | --dailyAt | --on | --onFile');
}

function escape(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
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
