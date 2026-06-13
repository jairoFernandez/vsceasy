import * as crypto from 'crypto';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { TEMPLATE_FILES, TEMPLATES_VERSION } from './templatesData';

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
 * Resolves the bundled templates/ directory.
 *
 * In the source tree / npm-style installs an on-disk `templates/` exists next
 * to the code, so we return that directly (fast, no extraction). When that is
 * absent — notably a globally installed binary whose bin is a symlink, where
 * walking the filesystem can never reach the package — we materialize the
 * templates embedded in the binary (see scripts/embedTemplates.ts) into a
 * stable temp dir and return that. Either way callers get a real directory,
 * so every fs.readFileSync/readdirSync consumer keeps working unchanged.
 *
 * Callers may pass a runtime-real path (e.g. `process.argv[1]`) to seed the
 * disk walk. Do NOT pass `__dirname`: the bundler inlines it as the
 * build-machine path, which does not exist on a user's machine.
 */
export function findTemplatesRoot(fromFile: string = process.argv[1] ?? __dirname): string {
  const onDisk = findTemplatesOnDisk(fromFile);
  if (onDisk) return onDisk;
  return materializeEmbeddedTemplates();
}

/** Walks up from `fromFile` looking for a real `templates/` dir. */
function findTemplatesOnDisk(fromFile: string): string | undefined {
  let dir = path.dirname(path.resolve(fromFile));
  const { root } = path.parse(dir);
  while (true) {
    const candidate = path.join(dir, 'templates');
    // Guard against a stray empty dir: require it to actually hold files.
    if (fs.existsSync(candidate) && fs.statSync(candidate).isDirectory()) {
      try {
        if (fs.readdirSync(candidate).length > 0) return candidate;
      } catch {
        /* fall through */
      }
    }
    if (dir === root) return undefined;
    dir = path.dirname(dir);
  }
}

let materializedRoot: string | undefined;

/**
 * Writes the embedded TEMPLATE_FILES map to a temp dir once per process. The
 * dir name includes the CLI version and a content hash so different installs
 * never collide and stale extractions are ignored after an upgrade.
 */
function materializeEmbeddedTemplates(): string {
  if (materializedRoot) return materializedRoot;

  const keys = Object.keys(TEMPLATE_FILES);
  if (keys.length === 0) {
    throw new Error(
      'No templates available: on-disk templates/ not found and no embedded ' +
        'templates were bundled. This is a packaging bug — rebuild with ' +
        '`bun run build` (runs scripts/embedTemplates.ts).',
    );
  }

  const hash = crypto
    .createHash('sha1')
    .update(`${TEMPLATES_VERSION}:${keys.length}:${keys.join('|')}`)
    .digest('hex')
    .slice(0, 12);
  const dest = path.join(os.tmpdir(), `vsceasy-templates-${TEMPLATES_VERSION}-${hash}`);

  // A complete prior extraction is reused. We mark completion with a sentinel
  // so a partially-written dir (crash mid-extract) is never trusted.
  const sentinel = path.join(dest, '.complete');
  if (fs.existsSync(sentinel)) {
    materializedRoot = dest;
    return dest;
  }

  fs.rmSync(dest, { recursive: true, force: true });
  fs.mkdirSync(dest, { recursive: true });
  for (const rel of keys) {
    const abs = path.join(dest, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, TEMPLATE_FILES[rel]);
  }
  fs.writeFileSync(sentinel, '');

  materializedRoot = dest;
  return dest;
}
