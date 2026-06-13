import * as fs from 'fs';
import * as path from 'path';
import { substitute } from '../scaffold';
import { assertId, assertNoOverwrite } from '../validate';

export type StoreType = 'number' | 'string' | 'boolean' | 'json';

export interface AddStoreOptions {
  name: string;
  /** Value type. Default: 'number'. */
  type?: StoreType;
  /** Raw initial value expression. Defaults per type (0 / '' / false / null). */
  initial?: string;
  projectRoot: string;
  templatesRoot: string;
}

export interface AddStoreResult {
  created: string[];
}

const DEFAULT_INITIAL: Record<StoreType, string> = {
  number: '0',
  string: "''",
  boolean: 'false',
  json: 'null',
};

const TS_TYPE: Record<StoreType, string> = {
  number: 'number',
  string: 'string',
  boolean: 'boolean',
  json: 'any',
};

const EXAMPLE: Record<StoreType, string> = {
  number: '1',
  string: "'hello'",
  boolean: 'true',
  json: '{ open: true }',
};

export function addStore(opts: AddStoreOptions): AddStoreResult {
  const name = assertId('store name', normalizeCamel(opts.name));
  const type: StoreType = opts.type ?? 'number';
  const initial = (opts.initial?.trim() || DEFAULT_INITIAL[type]);

  const storeTs = path.join(opts.projectRoot, 'src', 'stores', `${name}.ts`);
  assertNoOverwrite(opts.projectRoot, storeTs, 'Store');

  const tplPath = path.join(opts.templatesRoot, '_generators', 'store', 'store.ts.tpl');
  const body = substitute(fs.readFileSync(tplPath, 'utf8'), {
    name,
    type: TS_TYPE[type],
    initial,
    example: EXAMPLE[type],
  });

  fs.mkdirSync(path.dirname(storeTs), { recursive: true });
  fs.writeFileSync(storeTs, body);

  return { created: [storeTs] };
}

function normalizeCamel(s: string): string {
  const cleaned = s.trim().replace(/[^a-zA-Z0-9]+(.)/g, (_m, c) => c.toUpperCase()).replace(/[^a-zA-Z0-9]/g, '');
  if (!cleaned) return '';
  return cleaned.charAt(0).toLowerCase() + cleaned.slice(1);
}
