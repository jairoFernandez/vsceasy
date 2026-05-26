import { describe, test, expect } from 'bun:test';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { scaffold } from '../../lib/scaffold';
import { initDb, dbExists } from '../../lib/db/init';
import { addModel } from '../../lib/model/add';
import { wireInitDb } from '../../lib/db/wire';

const templatesRoot = path.resolve(__dirname, '../../../templates');

async function scaffoldProject(): Promise<string> {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'vsceasy-db-'));
  const target = path.join(tmp, 'demo');
  await scaffold({
    name: 'demo',
    displayName: 'Demo',
    description: 'd',
    publisher: 'me',
    ui: 'react',
    targetDir: target,
    templatesRoot,
  });
  return target;
}

describe('db init', () => {
  test('creates src/helpers/db.ts with default storage provider', async () => {
    const project = await scaffoldProject();
    const r = initDb({ projectRoot: project, templatesRoot });
    expect(r.created).toContain(path.join(project, 'src/helpers/db.ts'));
    expect(r.provider).toBe('storage');
    expect(dbExists(project)).toBe(true);
    const body = fs.readFileSync(r.path, 'utf8');
    expect(body).toMatch(/initDb/);
    expect(body).toMatch(/provider: 'storage'/);
    fs.rmSync(path.dirname(project), { recursive: true, force: true });
  });

  test('honors --provider global', async () => {
    const project = await scaffoldProject();
    const r = initDb({ projectRoot: project, templatesRoot, provider: 'global' });
    const body = fs.readFileSync(r.path, 'utf8');
    expect(body).toMatch(/provider: 'global'/);
    fs.rmSync(path.dirname(project), { recursive: true, force: true });
  });

  test('idempotent without --force', async () => {
    const project = await scaffoldProject();
    initDb({ projectRoot: project, templatesRoot });
    const second = initDb({ projectRoot: project, templatesRoot });
    expect(second.created).toEqual([]);
    expect(second.skipped.length).toBe(1);
    fs.rmSync(path.dirname(project), { recursive: true, force: true });
  });
});

describe('wireInitDb', () => {
  test('inserts import + onActivate hook into default entry', async () => {
    const project = await scaffoldProject();
    const r = wireInitDb(project);
    expect(r.status).toBe('wired');
    const src = fs.readFileSync(path.join(project, 'src/extension/extension.ts'), 'utf8');
    expect(src).toMatch(/import \{ initDb \} from '\.\.\/helpers\/db'/);
    expect(src).toMatch(/bootstrap\(registry, \{ onActivate: \[initDb\] \}\)/);
    fs.rmSync(path.dirname(project), { recursive: true, force: true });
  });

  test('idempotent on second call', async () => {
    const project = await scaffoldProject();
    wireInitDb(project);
    const r = wireInitDb(project);
    expect(r.status).toBe('already-wired');
    const src = fs.readFileSync(path.join(project, 'src/extension/extension.ts'), 'utf8');
    // Single initDb hook, single import
    expect((src.match(/initDb/g) ?? []).length).toBeGreaterThanOrEqual(2);
    expect((src.match(/initDb/g) ?? []).length).toBeLessThanOrEqual(3);
    fs.rmSync(path.dirname(project), { recursive: true, force: true });
  });

  test('preserves existing options object and appends initDb', async () => {
    const project = await scaffoldProject();
    const entry = path.join(project, 'src/extension/extension.ts');
    fs.writeFileSync(
      entry,
      `import { bootstrap } from '../shared/vsceasy';\nimport { registry } from './_registry';\nimport { foo } from './bar';\n\nexport const activate = bootstrap(registry, { onActivate: [foo] });\nexport function deactivate() {}\n`,
    );
    wireInitDb(project);
    const src = fs.readFileSync(entry, 'utf8');
    expect(src).toMatch(/onActivate: \[foo, initDb\]/);
    fs.rmSync(path.dirname(project), { recursive: true, force: true });
  });

  test('reports no-entry when extension.ts missing', async () => {
    const project = await scaffoldProject();
    fs.rmSync(path.join(project, 'src/extension/extension.ts'));
    const r = wireInitDb(project);
    expect(r.status).toBe('no-entry');
    fs.rmSync(path.dirname(project), { recursive: true, force: true });
  });

  test('reports unrecognized when bootstrap call is missing', async () => {
    const project = await scaffoldProject();
    const entry = path.join(project, 'src/extension/extension.ts');
    fs.writeFileSync(entry, `export function activate() {}\nexport function deactivate() {}\n`);
    const r = wireInitDb(project);
    expect(r.status).toBe('unrecognized');
    fs.rmSync(path.dirname(project), { recursive: true, force: true });
  });
});

describe('model add', () => {
  test('rejects without db init', async () => {
    const project = await scaffoldProject();
    expect(() =>
      addModel({
        name: 'User',
        fields: [{ name: 'id', type: 'string', primaryKey: true }],
        projectRoot: project,
        templatesRoot,
      }),
    ).toThrow(/db init/);
    fs.rmSync(path.dirname(project), { recursive: true, force: true });
  });

  test('creates src/models/User.ts with entity + repo', async () => {
    const project = await scaffoldProject();
    initDb({ projectRoot: project, templatesRoot });
    const r = addModel({
      name: 'User',
      fields: [
        { name: 'id', type: 'string', primaryKey: true },
        { name: 'name', type: 'string' },
        { name: 'email', type: 'string', indexed: true },
      ],
      projectRoot: project,
      templatesRoot,
    });
    expect(r.primaryKey).toBe('id');
    expect(r.indexes).toEqual(['email']);
    const file = path.join(project, 'src/models/User.ts');
    expect(r.created).toContain(file);
    const body = fs.readFileSync(file, 'utf8');
    expect(body).toMatch(/export interface User \{/);
    expect(body).toMatch(/  id: string;/);
    expect(body).toMatch(/  email: string;/);
    expect(body).toMatch(/defineEntity<User>\('users'/);
    expect(body).toMatch(/primaryKey: 'id'/);
    expect(body).toMatch(/indexes: \['email'\]/);
    expect(body).toMatch(/export const Users = defineEntity/);
    expect(body).toMatch(/export const UsersRepo/);
    fs.rmSync(path.dirname(project), { recursive: true, force: true });
  });

  test('marks optional field with `?`', async () => {
    const project = await scaffoldProject();
    initDb({ projectRoot: project, templatesRoot });
    addModel({
      name: 'Note',
      fields: [
        { name: 'id', type: 'string' },
        { name: 'body', type: 'string', optional: true },
      ],
      projectRoot: project,
      templatesRoot,
    });
    const body = fs.readFileSync(path.join(project, 'src/models/Note.ts'), 'utf8');
    expect(body).toMatch(/  body\?: string;/);
    fs.rmSync(path.dirname(project), { recursive: true, force: true });
  });

  test('rejects multiple primaryKey fields', async () => {
    const project = await scaffoldProject();
    initDb({ projectRoot: project, templatesRoot });
    expect(() =>
      addModel({
        name: 'Bad',
        fields: [
          { name: 'a', type: 'string', primaryKey: true },
          { name: 'b', type: 'string', primaryKey: true },
        ],
        projectRoot: project,
        templatesRoot,
      }),
    ).toThrow(/more than one field marked primaryKey/);
    fs.rmSync(path.dirname(project), { recursive: true, force: true });
  });

  test('defaults primaryKey to `id` when none marked', async () => {
    const project = await scaffoldProject();
    initDb({ projectRoot: project, templatesRoot });
    const r = addModel({
      name: 'Foo',
      fields: [
        { name: 'name', type: 'string' },
        { name: 'id', type: 'string' },
      ],
      projectRoot: project,
      templatesRoot,
    });
    expect(r.primaryKey).toBe('id');
    fs.rmSync(path.dirname(project), { recursive: true, force: true });
  });

  test('falls back to first field when no `id` and none marked', async () => {
    const project = await scaffoldProject();
    initDb({ projectRoot: project, templatesRoot });
    const r = addModel({
      name: 'Foo',
      fields: [
        { name: 'slug', type: 'string' },
        { name: 'name', type: 'string' },
      ],
      projectRoot: project,
      templatesRoot,
    });
    expect(r.primaryKey).toBe('slug');
    fs.rmSync(path.dirname(project), { recursive: true, force: true });
  });

  test('rejects duplicate model file', async () => {
    const project = await scaffoldProject();
    initDb({ projectRoot: project, templatesRoot });
    addModel({
      name: 'X',
      fields: [{ name: 'id', type: 'string' }],
      projectRoot: project,
      templatesRoot,
    });
    expect(() =>
      addModel({
        name: 'X',
        fields: [{ name: 'id', type: 'string' }],
        projectRoot: project,
        templatesRoot,
      }),
    ).toThrow(/already exists/i);
    fs.rmSync(path.dirname(project), { recursive: true, force: true });
  });

  test('rejects zero fields', async () => {
    const project = await scaffoldProject();
    initDb({ projectRoot: project, templatesRoot });
    expect(() =>
      addModel({ name: 'Empty', fields: [], projectRoot: project, templatesRoot }),
    ).toThrow(/at least one field/);
    fs.rmSync(path.dirname(project), { recursive: true, force: true });
  });
});
