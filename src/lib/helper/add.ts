import * as fs from 'fs';
import * as path from 'path';
import { substitute } from '../scaffold';
import { assertNoOverwrite } from '../validate';
import { readConfig } from '../config';

export type HelperKind = 'secrets' | 'config' | 'state' | 'notifications';

export const HELPER_KINDS: HelperKind[] = ['secrets', 'config', 'state', 'notifications'];

export interface AddHelperOptions {
  kind: HelperKind;
  projectRoot: string;
  templatesRoot: string;
  /** Overwrite existing helper file. Default false. */
  force?: boolean;
}

export interface AddHelperResult {
  created: string[];
  skipped: string[];
}

export function addHelper(opts: AddHelperOptions): AddHelperResult {
  if (!HELPER_KINDS.includes(opts.kind)) {
    throw new Error(
      `Unknown helper kind: "${opts.kind}". Available: ${HELPER_KINDS.map((k) => `"${k}"`).join(', ')}.`,
    );
  }

  const cfg = readConfig(opts.projectRoot);
  const pkgPath = path.join(opts.projectRoot, 'package.json');
  const pkg = fs.existsSync(pkgPath) ? JSON.parse(fs.readFileSync(pkgPath, 'utf8')) : {};

  const vars: Record<string, string> = {
    commandPrefix:
      cfg.commandPrefix ?? pkg.vsceasy?.commandPrefix ?? deriveCommandPrefix(pkg.name ?? 'ext'),
    displayName: pkg.displayName ?? pkg.name ?? 'My Extension',
  };

  const tpl = path.join(opts.templatesRoot, '_generators', 'helper', `${opts.kind}.ts.tpl`);
  if (!fs.existsSync(tpl)) throw new Error(`Helper template missing: ${tpl}`);

  const targetDir = path.join(opts.projectRoot, 'src', 'helpers');
  fs.mkdirSync(targetDir, { recursive: true });
  const target = path.join(targetDir, `${opts.kind}.ts`);

  const created: string[] = [];
  const skipped: string[] = [];
  if (fs.existsSync(target) && !opts.force) {
    skipped.push(target);
  } else {
    if (fs.existsSync(target)) assertNoOverwrite(opts.projectRoot, target, 'Helper'); // unreachable when force=true
    fs.writeFileSync(target, substitute(fs.readFileSync(tpl, 'utf8'), vars));
    created.push(target);
  }

  return { created, skipped };
}

function deriveCommandPrefix(name: string): string {
  return name.replace(/^@[^/]+\//, '').replace(/[^a-zA-Z0-9]+/g, '');
}
