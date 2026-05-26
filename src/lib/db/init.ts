import * as fs from 'fs';
import * as path from 'path';
import { substitute } from '../scaffold';

export type DbProvider = 'storage' | 'global';

export interface InitDbOptions {
  projectRoot: string;
  templatesRoot: string;
  provider?: DbProvider;
  /** Overwrite existing helpers/db.ts. Default false (idempotent). */
  force?: boolean;
}

export interface InitDbResult {
  created: string[];
  skipped: string[];
  path: string;
  provider: DbProvider;
}

export function initDb(opts: InitDbOptions): InitDbResult {
  const provider: DbProvider = opts.provider ?? 'storage';
  const targetDir = path.join(opts.projectRoot, 'src', 'helpers');
  fs.mkdirSync(targetDir, { recursive: true });
  const target = path.join(targetDir, 'db.ts');

  const tpl = path.join(opts.templatesRoot, '_generators', 'helper', 'db.ts.tpl');
  if (!fs.existsSync(tpl)) throw new Error(`db template missing: ${tpl}`);

  const created: string[] = [];
  const skipped: string[] = [];
  if (fs.existsSync(target) && !opts.force) {
    skipped.push(target);
  } else {
    const body = substitute(fs.readFileSync(tpl, 'utf8'), { provider });
    fs.writeFileSync(target, body);
    created.push(target);
  }
  return { created, skipped, path: target, provider };
}

export function dbExists(projectRoot: string): boolean {
  return fs.existsSync(path.join(projectRoot, 'src', 'helpers', 'db.ts'));
}
