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
/**
 * Resolves the bundled templates/ directory by walking up from `fromFile`
 * until a directory containing `templates/` is found.
 *
 * Callers must pass a runtime-real path (e.g. `process.argv[1]`, the CLI entry
 * node actually executes). Do NOT pass `__dirname`: the bundler inlines it as
 * the absolute build-machine path (e.g. /home/runner/work/.../src/commands/x),
 * which does not exist on a user's machine.
 */
export function findTemplatesRoot(fromFile: string = process.argv[1] ?? __dirname): string {
  let dir = path.dirname(path.resolve(fromFile));
  const { root } = path.parse(dir);
  const tried: string[] = [];
  while (true) {
    const candidate = path.join(dir, 'templates');
    tried.push(candidate);
    if (fs.existsSync(candidate)) return candidate;
    if (dir === root) break;
    dir = path.dirname(dir);
  }
  throw new Error(
    `templates/ directory not found. Looked in:\n  ${tried.join('\n  ')}`,
  );
}
