import * as fs from 'fs';
import * as path from 'path';
import type { InputKind } from './parseModel';

/**
 * Optional override file at `src/models/<Name>.crud.ts`:
 *
 *   export default {
 *     title: 'Users',
 *     icon: 'person',
 *     hidden: ['createdAt'],
 *     order: ['name', 'email'],
 *     fields: {
 *       email: { label: 'Email', input: 'text', placeholder: 'name@x.io' },
 *       role:  { input: 'select', options: ['admin', 'user'] },
 *     },
 *   };
 */
export interface CrudFieldOverride {
  label?: string;
  placeholder?: string;
  input?: InputKind;
  options?: string[];
  /** Hide this field from list table. Default: visible. */
  hideInList?: boolean;
  /** Hide this field from form. Default: visible (unless in `hidden`). */
  hideInForm?: boolean;
}

export interface CrudConfig {
  /** Plural display label (e.g. "Users"). Default: model plural id. */
  title?: string;
  /** Codicon for menu entry. Default: 'symbol-misc'. */
  icon?: string;
  /** Field names hidden from BOTH list and form. */
  hidden?: string[];
  /** Explicit field display order (form + list). Unlisted fields appended in source order. */
  order?: string[];
  fields?: Record<string, CrudFieldOverride>;
}

export function readCrudConfig(projectRoot: string, modelName: string): CrudConfig {
  const file = path.join(projectRoot, 'src', 'models', `${modelName}.crud.ts`);
  if (!fs.existsSync(file)) return {};
  try {
    const src = fs.readFileSync(file, 'utf8');
    return parseConfigSource(src);
  } catch {
    return {};
  }
}

function parseConfigSource(src: string): CrudConfig {
  // Reuse the same braced-literal extractor pattern as vsceasy.config.ts.
  const head = /export\s+default\s*\{/.exec(src);
  if (!head) return {};
  const open = head.index + head[0].length - 1;
  let depth = 0;
  let close = -1;
  for (let i = open; i < src.length; i++) {
    const c = src[i];
    if (c === '{') depth++;
    else if (c === '}') {
      depth--;
      if (depth === 0) { close = i; break; }
    }
  }
  if (close < 0) return {};
  const literal = src.slice(open, close + 1);
  try {
    const jsonish = literal
      .replace(/\/\/.*$/gm, '')
      .replace(/,\s*([}\]])/g, '$1')
      .replace(/([{,]\s*)([A-Za-z_][\w]*)\s*:/g, '$1"$2":')
      .replace(/'/g, '"');
    return JSON.parse(jsonish) as CrudConfig;
  } catch {
    return {};
  }
}
