import type { ModelField } from './add';

/**
 * Parse a compact model field spec into `ModelField[]`.
 *
 * Spec: comma-separated field lines, each `name[?]:type[!][@]`.
 *   `?` after name → optional
 *   `!` after type → primaryKey
 *   `@` after type → indexed
 *
 * Example: `id:string!,name:string,email?:string@,score:number`
 */
export function parseFieldsSpec(spec: string): ModelField[] {
  return spec
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map(parseFieldLine);
}

/** Parse a single `name[?]:type[!][@]` line. Throws on malformed input. */
export function parseFieldLine(raw: string): ModelField {
  const line = raw.trim();
  if (!line) throw new Error('Empty field spec.');
  const colon = line.indexOf(':');
  if (colon < 0) throw new Error(`Field "${line}" missing :type — use \`name:type\` (e.g. \`name:string\`).`);
  let name = line.slice(0, colon).trim();
  let type = line.slice(colon + 1).trim();
  if (!name || !type) throw new Error(`Field "${line}" malformed.`);

  let optional = false;
  if (name.endsWith('?')) {
    optional = true;
    name = name.slice(0, -1);
  }

  let primaryKey = false;
  let indexed = false;
  // Strip trailing flags (in any order)
  while (type.endsWith('!') || type.endsWith('@')) {
    if (type.endsWith('!')) { primaryKey = true; type = type.slice(0, -1); }
    if (type.endsWith('@')) { indexed = true; type = type.slice(0, -1); }
  }
  type = type.trim();
  if (!type) throw new Error(`Field "${raw}" has no type after flags.`);

  return { name, type, optional, primaryKey, indexed };
}
