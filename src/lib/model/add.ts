import * as fs from 'fs';
import * as path from 'path';
import { substitute } from '../scaffold';
import { assertId, assertNoOverwrite } from '../validate';
import { dbExists } from '../db/init';

export interface FieldRelation {
  /** PascalCase name of the related model (e.g. `Category`). */
  model: string;
  /** Field on the related model to show in pickers. Default: first string field, else its pk. */
  label?: string;
}

export interface ModelField {
  name: string;
  /** Raw TS type. e.g. `string`, `number`, `string | null`, `Date`, `'a' | 'b'`. */
  type: string;
  /** Add `?` to the field name (becomes optional). */
  optional?: boolean;
  /** Mark as primary key. Exactly one field must be PK. Default: first field named `id`. */
  primaryKey?: boolean;
  /** Add to entity `indexes` (speeds up findOne by this field). */
  indexed?: boolean;
  /**
   * ManyToOne relation. When set, the field is emitted as a `<name>Id: string`
   * foreign key and recorded in the model's relation metadata so `crud add`
   * renders a populated dropdown. Authored as `name:ref(Model)` in the spec.
   */
  relation?: FieldRelation;
}

export interface AddModelOptions {
  name: string;
  fields: ModelField[];
  /** Plural identifier used as repository handle. Default: `${Name}s`. */
  plural?: string;
  /** Collection name persisted on disk. Default: `${plural.toLowerCase()}`. */
  collection?: string;
  projectRoot: string;
  templatesRoot: string;
}

export interface AddModelResult {
  created: string[];
  primaryKey: string;
  indexes: string[];
  /** Foreign-key fields and the models they point at. */
  relations: Array<{ field: string; model: string; label?: string }>;
}

export function addModel(opts: AddModelOptions): AddModelResult {
  const name = assertId('model name', normalizeCamel(opts.name));
  const Name = name.charAt(0).toUpperCase() + name.slice(1);

  if (!dbExists(opts.projectRoot)) {
    throw new Error(
      'No database initialized. Run `vsceasy db init` first, then re-run `vsceasy model add`.',
    );
  }
  if (opts.fields.length === 0) {
    throw new Error('Model needs at least one field. Re-run and add fields in the interactive loop.');
  }

  const Plural = opts.plural?.trim() || `${Name}s`;
  const collection = opts.collection?.trim() || Plural.toLowerCase();

  // PK resolution
  const explicitPk = opts.fields.filter((f) => f.primaryKey);
  if (explicitPk.length > 1) {
    throw new Error(
      `Model "${Name}": more than one field marked primaryKey: ${explicitPk.map((f) => f.name).join(', ')}.`,
    );
  }
  const pkField =
    explicitPk[0] ?? opts.fields.find((f) => f.name === 'id') ?? opts.fields[0];
  const primaryKey = pkField.name;
  const indexes = opts.fields.filter((f) => f.indexed && f.name !== primaryKey).map((f) => f.name);

  // Validate relations point at existing models, and build the FK field name.
  const modelsDir = path.join(opts.projectRoot, 'src', 'models');
  for (const f of opts.fields) {
    if (!f.relation) continue;
    if (f.relation.model === Name) {
      // self-reference is allowed; the file is about to be written.
    } else if (!fs.existsSync(path.join(modelsDir, `${f.relation.model}.ts`))) {
      throw new Error(
        `Field "${f.name}" references model "${f.relation.model}", but src/models/${f.relation.model}.ts does not exist. ` +
        `Run \`vsceasy model add --name ${f.relation.model}\` first.`,
      );
    }
  }

  const target = path.join(modelsDir, `${Name}.ts`);
  assertNoOverwrite(opts.projectRoot, target, 'Model');

  const tpl = path.join(opts.templatesRoot, '_generators', 'model', 'model.ts.tpl');

  // A relation field `category:ref(Category)` becomes a `categoryId: string` FK.
  const fkName = (f: ModelField) => (f.relation ? `${f.name}Id` : f.name);
  const fieldLines = opts.fields
    .map((f) => {
      const ts = f.relation ? 'string' : f.type;
      const note = f.relation ? `  // → ${f.relation.model}` : '';
      return `  ${fkName(f)}${f.optional ? '?' : ''}: ${ts};${note}`;
    })
    .join('\n');

  // Relation metadata block, read by `crud add` to build populated dropdowns.
  const relFields = opts.fields.filter((f) => f.relation);
  const relationsBlock = relFields.length
    ? `\n\n/** Relation metadata — used by \`vsceasy crud add\` to populate pickers. */\n` +
      `export const ${Name}Relations = {\n` +
      relFields
        .map((f) => {
          const r = f.relation!;
          const lbl = r.label ? `, label: '${r.label}'` : '';
          return `  ${fkName(f)}: { model: '${r.model}'${lbl} },`;
        })
        .join('\n') +
      `\n} as const;\n`
    : '';

  const vars: Record<string, string> = {
    name,
    Name,
    Plural,
    collection,
    primaryKey,
    fieldLines,
    indexesLine: indexes.length
      ? `\n  indexes: [${indexes.map((i) => `'${i}'`).join(', ')}],`
      : '',
    relationsBlock,
  };

  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, substitute(fs.readFileSync(tpl, 'utf8'), vars));

  return { created: [target], primaryKey, indexes, relations: relFields.map((f) => ({ field: fkName(f), ...f.relation! })) };
}

function normalizeCamel(s: string): string {
  const cleaned = s.trim().replace(/[^a-zA-Z0-9]+(.)/g, (_m, c) => c.toUpperCase()).replace(/[^a-zA-Z0-9]/g, '');
  if (!cleaned) return '';
  return cleaned.charAt(0).toLowerCase() + cleaned.slice(1);
}
