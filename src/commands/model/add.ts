import { Command, ParamType, prompt } from '@ideascol/cli-maker';
import * as path from 'path';
import { addModel, ModelField } from '../../lib/model/add';
import { parseFieldsSpec, parseFieldLine } from '../../lib/model/parseFields';
import { dbExists } from '../../lib/db/init';
import { findProjectRoot, findTemplatesRoot } from '../../lib/findProject';

const FIELD_HELP = [
  '',
  'Interactive field loop: enter `name:type` per line, empty line to finish.',
  '  Examples:',
  '    id:string!         — `!` after type = primary key',
  '    name:string        — required field',
  '    email?:string      — `?` after name = optional',
  '    createdAt:number   — number type',
  '    role:"a"|"b"       — literal union',
  '    tag:string@        — `@` after type = indexed',
  '    score:number!@     — primary key + indexed',
  '',
  'If no `!` is set, `id` (or first field) becomes the primary key.',
].join('\n');

const addModelCommand: Command = {
  name: 'add',
  description: 'Add a typed model (entity + repo) under src/models/. Requires `vsceasy db init` first.' + FIELD_HELP,
  params: [
    { name: 'name', description: 'Model name (PascalCase, e.g. User)', required: true, type: ParamType.Text },
    {
      name: 'plural',
      description: 'Plural identifier for the repo export (default: `${Name}s`)',
      required: false,
      type: ParamType.Text,
    },
    {
      name: 'collection',
      description: 'Persisted collection name (default: lowercased plural)',
      required: false,
      type: ParamType.Text,
    },
    {
      name: 'fields',
      description: 'Compact spec: `name:type!@,email?:string` (skip to use interactive loop)',
      required: false,
      type: ParamType.Text,
    },
  ],
  action: async (args) => {
    try {
      const projectRoot = findProjectRoot();
      const templatesRoot = findTemplatesRoot(__dirname);

      if (!dbExists(projectRoot)) {
        throw new Error('No `src/helpers/db.ts` found. Run `vsceasy db init` first.');
      }

      let fields: ModelField[] = [];
      if (args.fields) {
        fields = parseFieldsSpec(String(args.fields));
      } else {
        fields = await promptFieldsLoop();
      }
      if (fields.length === 0) {
        throw new Error('At least one field is required.');
      }

      const result = addModel({
        name: String(args.name).trim(),
        plural: args.plural ? String(args.plural).trim() : undefined,
        collection: args.collection ? String(args.collection).trim() : undefined,
        fields,
        projectRoot,
        templatesRoot,
      });

      const rel = (p: string) => path.relative(projectRoot, p);
      console.log(`\n✓ Model created (primaryKey: ${result.primaryKey}${result.indexes.length ? `, indexes: ${result.indexes.join(', ')}` : ''}).\n`);
      for (const f of result.created) console.log(`  + ${rel(f)}`);
      console.log(`\n  Usage:\n    import { ${plural(args.name)}Repo } from '../models/${pascal(args.name)}';\n    await ${plural(args.name)}Repo().insert({ ... });\n`);
    } catch (err: any) {
      console.error(`\n✗ ${err.message}\n`);
      process.exitCode = 1;
    }
  },
};

async function promptFieldsLoop(): Promise<ModelField[]> {
  console.log('\n  Field syntax: `name:type` — flags: `!` (primary) `@` (indexed) `?` after name (optional)');
  console.log('  Examples: `id:string!`, `email?:string@`, `score:number`');
  console.log('  Empty line finishes.\n');
  const fields: ModelField[] = [];
  while (true) {
    const line = (await prompt(`  field ${fields.length + 1}: `)).trim();
    if (!line) break;
    try {
      fields.push(parseFieldLine(line));
    } catch (err: any) {
      console.log(`  ✗ ${err.message}`);
    }
  }
  return fields;
}

function pascal(s: string): string {
  const cleaned = String(s)
    .trim()
    .replace(/[^a-zA-Z0-9]+(.)/g, (_m, c) => c.toUpperCase())
    .replace(/[^a-zA-Z0-9]/g, '');
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

function plural(s: string): string {
  return `${pascal(s)}s`;
}

export default addModelCommand;
