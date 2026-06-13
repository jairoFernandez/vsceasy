import type { ModelField, FieldRelation } from './add';

/**
 * Parse a compact model field spec into `ModelField[]`.
 *
 * Spec: comma-separated field lines, each `name[?]:type[!][@]`.
 *   `?` after name → optional
 *   `!` after type → primaryKey
 *   `@` after type → indexed
 *
 * Relations use `name:ref(Model)` or `name:ref(Model, label=field)`:
 *   category:ref(Category)             → FK categoryId, dropdown of Category rows
 *   category:ref(Category, label=name) → show Category.name in the dropdown
 *
 * Example: `id:string!,name:string,email?:string@,category:ref(Category)`
 */
export function parseFieldsSpec(spec: string): ModelField[] {
  // Split on commas that are NOT inside ref(...) parens.
  return splitTopLevel(spec)
    .map((s) => s.trim())
    .filter(Boolean)
    .map(parseFieldLine);
}

/** Split on commas outside of parentheses (so `ref(A, label=b)` stays intact). */
function splitTopLevel(spec: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let cur = '';
  for (const ch of spec) {
    if (ch === '(') depth++;
    else if (ch === ')') depth = Math.max(0, depth - 1);
    if (ch === ',' && depth === 0) { out.push(cur); cur = ''; continue; }
    cur += ch;
  }
  if (cur.trim()) out.push(cur);
  return out;
}

/** Parse a single `name[?]:type[!][@]` line (or `name:ref(Model)`). Throws on malformed input. */
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

  // Relation: `ref(Model)` or `ref(Model, label=field)`.
  const relation = parseRef(type);
  if (relation) {
    return { name, type: 'ref', optional, relation };
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

/** Parse `ref(Model)` / `ref(Model, label=field)`. Returns null when not a ref. */
export function parseRef(type: string): FieldRelation | null {
  const m = /^ref\s*\(\s*([A-Za-z][A-Za-z0-9_]*)\s*(?:,\s*label\s*=\s*([A-Za-z][A-Za-z0-9_]*)\s*)?\)$/.exec(type.trim());
  if (!m) return null;
  const model = m[1];
  const label = m[2];
  return label ? { model, label } : { model };
}
