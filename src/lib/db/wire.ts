import * as fs from 'fs';
import * as path from 'path';

export interface WireResult {
  status: 'wired' | 'already-wired' | 'unrecognized' | 'no-entry';
  path: string;
  message?: string;
}

/**
 * Patch `src/extension/extension.ts` to import `initDb` and add it as an
 * `onActivate` hook on the `bootstrap(registry)` call. Idempotent.
 */
export function wireInitDb(projectRoot: string, importPath = '../helpers/db'): WireResult {
  const entry = path.join(projectRoot, 'src', 'extension', 'extension.ts');
  if (!fs.existsSync(entry)) {
    return { status: 'no-entry', path: entry };
  }
  let src = fs.readFileSync(entry, 'utf8');

  if (/from\s+['"]\.\.\/helpers\/db['"]/.test(src) && /onActivate\s*:\s*\[[^\]]*initDb/.test(src)) {
    return { status: 'already-wired', path: entry, message: 'initDb already in onActivate hooks.' };
  }

  // 1. Ensure import line
  if (!/from\s+['"]\.\.\/helpers\/db['"]/.test(src)) {
    const importLine = `import { initDb } from '${importPath}';\n`;
    // Insert after the last top-of-file import block
    const lastImport = src.match(/(^import[^\n]*\n)+/m);
    src = lastImport
      ? src.slice(0, lastImport.index! + lastImport[0].length) + importLine + src.slice(lastImport.index! + lastImport[0].length)
      : importLine + src;
  } else if (!/\binitDb\b/.test(src)) {
    // Import line exists for db (e.g. `db`) but not initDb — merge names.
    src = src.replace(
      /import\s+\{([^}]*)\}\s+from\s+(['"])\.\.\/helpers\/db\2/,
      (_m, names, q) => {
        const set = new Set(String(names).split(',').map((n: string) => n.trim()).filter(Boolean));
        set.add('initDb');
        return `import { ${[...set].join(', ')} } from ${q}../helpers/db${q}`;
      },
    );
  }

  // 2. Transform `bootstrap(registry)` → `bootstrap(registry, { onActivate: [initDb] })`
  //    Handle existing options object too.
  const callRe = /\bbootstrap\s*\(\s*registry\s*(,\s*\{[\s\S]*?\})?\s*\)/;
  const m = callRe.exec(src);
  if (!m) {
    return { status: 'unrecognized', path: entry, message: 'Could not locate `bootstrap(registry)` call. Wire manually:\n    bootstrap(registry, { onActivate: [initDb] })' };
  }
  if (!m[1]) {
    src = src.replace(callRe, 'bootstrap(registry, { onActivate: [initDb] })');
  } else {
    // Already an options object — inject initDb into onActivate.
    const opts = m[1];
    let nextOpts: string;
    if (/onActivate\s*:\s*\[/.test(opts)) {
      nextOpts = opts.replace(/onActivate\s*:\s*\[([^\]]*)\]/, (_o, inner) => {
        const items = inner.split(',').map((x: string) => x.trim()).filter(Boolean);
        if (items.includes('initDb')) return `onActivate: [${items.join(', ')}]`;
        return `onActivate: [${[...items, 'initDb'].join(', ')}]`;
      });
    } else {
      nextOpts = opts.replace(/\{/, '{ onActivate: [initDb],');
    }
    src = src.replace(callRe, `bootstrap(registry${nextOpts})`);
  }

  fs.writeFileSync(entry, src);
  return { status: 'wired', path: entry };
}
