import * as fs from 'fs';
import * as path from 'path';

const ID_RE = /^[a-z][a-zA-Z0-9]*$/;

/**
 * Validate a generator identifier — camelCase, starts with a letter.
 * Throws with a clear message naming the field that failed.
 */
export function assertId(field: string, value: string): string {
  const trimmed = (value ?? '').trim();
  if (!trimmed) throw new Error(`${field} is required.`);
  if (!ID_RE.test(trimmed)) {
    throw new Error(
      `Invalid ${field}: "${trimmed}". Use camelCase starting with a lowercase letter (e.g. \`myPanel\`, \`doStuff\`).`,
    );
  }
  return trimmed;
}

/**
 * Throw a friendly error if `target` already exists. Quotes the project-relative path.
 */
export function assertNoOverwrite(projectRoot: string, target: string, kind: string): void {
  if (fs.existsSync(target)) {
    throw new Error(
      `${kind} already exists at \`${path.relative(projectRoot, target)}\`. Pick a different name or delete the file first.`,
    );
  }
}

/**
 * Throw if a referenced sibling resource (panel, menu, command) is missing on disk.
 * Error message lists the existing siblings so the user can pick one without re-running.
 */
export function assertSiblingExists(
  projectRoot: string,
  kind: 'panel' | 'menu' | 'command' | 'subpanel',
  id: string,
): string {
  const dir = `${kind}s`;
  const dirPath = path.join(projectRoot, 'src', dir);
  const candidates = [
    path.join(dirPath, `${id}.ts`),
    path.join(dirPath, `${id}.tsx`),
  ];
  for (const p of candidates) if (fs.existsSync(p)) return p;

  const existing = listSiblings(dirPath);
  const hint = existing.length
    ? ` Available ${kind}s: ${existing.map((n) => `"${n}"`).join(', ')}.`
    : ` No ${kind}s exist yet — run \`vsceasy ${kind} add --name <id>\` first.`;
  throw new Error(`${kind} "${id}" not found at \`src/${dir}/${id}.ts\`.${hint}`);
}

function listSiblings(dirPath: string): string[] {
  if (!fs.existsSync(dirPath)) return [];
  return fs
    .readdirSync(dirPath, { withFileTypes: true })
    .filter((e) => e.isFile() && /\.(ts|tsx)$/.test(e.name) && !e.name.startsWith('_'))
    .map((e) => e.name.replace(/\.(ts|tsx)$/, ''))
    .sort();
}
