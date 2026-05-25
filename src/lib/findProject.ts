import * as fs from 'fs';
import * as path from 'path';

/**
 * Walks up from `start` looking for a package.json whose `scripts.gen` matches
 * the vsceasy-generated value. Returns the directory containing it.
 */
export function findProjectRoot(start: string = process.cwd()): string {
  let dir = path.resolve(start);
  const { root } = path.parse(dir);
  while (true) {
    const pkgPath = path.join(dir, 'package.json');
    if (fs.existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
        // Match both old single-step gen and new gen:scan layouts.
        const genScript: string | undefined = pkg?.scripts?.gen;
        const hasScan: boolean = typeof pkg?.scripts?.['gen:scan'] === 'string';
        if (genScript === 'bun scripts/gen.ts' || hasScan) return dir;
      } catch {
        // ignore malformed package.json and keep walking
      }
    }
    if (dir === root) {
      throw new Error(
        `Not inside a vsceasy project (no package.json with scripts.gen="bun scripts/gen.ts" found above ${start}).`,
      );
    }
    dir = path.dirname(dir);
  }
}

/**
 * Resolves the bundled templates/ directory. Works whether the CLI runs from
 * the source tree (src/) or the compiled dist/.
 */
export function findTemplatesRoot(fromFile: string = __dirname): string {
  const candidates = [
    path.resolve(fromFile, '..', 'templates'),
    path.resolve(fromFile, '..', '..', 'templates'),
    path.resolve(fromFile, '..', '..', '..', 'templates'),
  ];
  for (const c of candidates) if (fs.existsSync(c)) return c;
  throw new Error(`templates/ directory not found near ${fromFile}`);
}
