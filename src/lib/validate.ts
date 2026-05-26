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
 */
export function assertSiblingExists(
  projectRoot: string,
  kind: 'panel' | 'menu' | 'command' | 'subpanel',
  id: string,
): string {
  const dir = `${kind}s`;
  const candidates = [
    path.join(projectRoot, 'src', dir, `${id}.ts`),
    path.join(projectRoot, 'src', dir, `${id}.tsx`),
  ];
  for (const p of candidates) if (fs.existsSync(p)) return p;
  throw new Error(
    `${kind} "${id}" not found at \`src/${dir}/${id}.ts\`. Run \`vsceasy ${kind} add --name ${id}\` first.`,
  );
}
