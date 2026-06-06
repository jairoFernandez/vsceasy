import { describe, test, expect } from 'bun:test';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { scaffold } from '../../lib/scaffold';
import { initDb } from '../../lib/db/init';
import { addModel } from '../../lib/model/add';
import { addCrud } from '../../lib/crud/add';
import { parseModelFile, inferInputSpec } from '../../lib/crud/parseModel';
import { addMenu } from '../../lib/menu/add';

const templatesRoot = path.resolve(__dirname, '../../../templates');

async function scaffoldWithUser(): Promise<string> {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'vsceasy-crud-'));
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
  initDb({ projectRoot: target, templatesRoot });
  addModel({
    name: 'User',
    fields: [
      { name: 'id', type: 'string', primaryKey: true },
      { name: 'name', type: 'string' },
      { name: 'email', type: 'string', indexed: true },
      { name: 'role', type: "'admin' | 'user'" },
      { name: 'active', type: 'boolean', optional: true },
      { name: 'createdAt', type: 'number' },
    ],
    projectRoot: target,
    templatesRoot,
  });
  return target;
}

describe('parseModelFile', () => {
  test('extracts interface fields + entity metadata', async () => {
    const project = await scaffoldWithUser();
    const m = parseModelFile(path.join(project, 'src/models/User.ts'));
    expect(m.name).toBe('User');
    expect(m.plural).toBe('Users');
    expect(m.collection).toBe('users');
    expect(m.primaryKey).toBe('id');
    expect(m.indexes).toEqual(['email']);
    expect(m.fields.map((f) => f.name)).toEqual(['id', 'name', 'email', 'role', 'active', 'createdAt']);
    expect(m.fields.find((f) => f.name === 'active')?.optional).toBe(true);
    fs.rmSync(path.dirname(project), { recursive: true, force: true });
  });
});

describe('inferInputSpec', () => {
  test('number → number input', () => {
    expect(inferInputSpec('number').kind).toBe('number');
  });
  test('boolean → boolean input', () => {
    expect(inferInputSpec('boolean').kind).toBe('boolean');
  });
  test('Date → date input', () => {
    expect(inferInputSpec('Date').kind).toBe('date');
  });
  test('string → text input', () => {
    expect(inferInputSpec('string').kind).toBe('text');
  });
  test('literal union → select with options', () => {
    const s = inferInputSpec("'admin' | 'user'");
    expect(s.kind).toBe('select');
    expect(s.options).toEqual(['admin', 'user']);
  });
  test('nullable string still text', () => {
    expect(inferInputSpec('string | null').kind).toBe('text');
  });
});

describe('addCrud', () => {
  test('generates service + 2 panels + 2 webview bundles + appends APIs', async () => {
    const project = await scaffoldWithUser();
    const r = addCrud({
      model: 'User',
      menu: 'none',
      projectRoot: project,
      templatesRoot,
      runGen: false,
    });
    const expect_ = (rel: string) =>
      expect(r.created).toContain(path.join(project, rel));

    expect_('src/services/UserService.ts');
    expect_('src/panels/usersList.ts');
    expect_('src/panels/userForm.ts');
    expect_('src/webview/panels/usersList/App.tsx');
    expect_('src/webview/panels/usersList/main.tsx');
    expect_('src/webview/panels/userForm/App.tsx');
    expect_('src/webview/panels/userForm/main.tsx');

    const api = fs.readFileSync(path.join(project, 'src/shared/api.ts'), 'utf8');
    expect(api).toMatch(/interface UsersListApi/);
    expect(api).toMatch(/interface UserFormApi/);
    expect(api).toMatch(/import type \{ User \} from '\.\.\/models\/User'/);

    const service = fs.readFileSync(path.join(project, 'src/services/UserService.ts'), 'utf8');
    expect(service).toMatch(/UsersRepo\(\)/);
    expect(service).toMatch(/upsert/);

    const formApp = fs.readFileSync(path.join(project, 'src/webview/panels/userForm/App.tsx'), 'utf8');
    expect(formApp).toMatch(/<select/);                        // role union
    expect(formApp).toMatch(/type="number"/);                 // createdAt
    expect(formApp).toMatch(/type="checkbox"/);               // active

    const listApp = fs.readFileSync(path.join(project, 'src/webview/panels/usersList/App.tsx'), 'utf8');
    expect(listApp).toMatch(/Name<\/th>/);
    expect(listApp).toMatch(/Email<\/th>/);

    fs.rmSync(path.dirname(project), { recursive: true, force: true });
  });

  test('wires into new menu when --menu new:<id>', async () => {
    const project = await scaffoldWithUser();
    const r = addCrud({
      model: 'User',
      menu: 'new:users',
      projectRoot: project,
      templatesRoot,
      runGen: false,
    });
    expect(r.menu?.id).toBe('users');
    expect(r.menu?.created).toBe(true);
    const menuSrc = fs.readFileSync(path.join(project, 'src/menus/users.ts'), 'utf8');
    expect(menuSrc).toMatch(/panel: 'usersList'/);
    expect(menuSrc).toMatch(/panel: 'userForm'/);
    fs.rmSync(path.dirname(project), { recursive: true, force: true });
  });

  test('wires into existing menu when --menu existing:<id>', async () => {
    const project = await scaffoldWithUser();
    addMenu({ name: 'main', projectRoot: project, templatesRoot, runGen: false });
    const r = addCrud({
      model: 'User',
      menu: 'existing:main',
      projectRoot: project,
      templatesRoot,
      runGen: false,
    });
    expect(r.menu?.id).toBe('main');
    expect(r.menu?.created).toBe(false);
    const menuSrc = fs.readFileSync(path.join(project, 'src/menus/main.ts'), 'utf8');
    expect(menuSrc).toMatch(/panel: 'usersList'/);
    fs.rmSync(path.dirname(project), { recursive: true, force: true });
  });

  test('respects crud.config.ts overrides (hidden + label)', async () => {
    const project = await scaffoldWithUser();
    fs.writeFileSync(
      path.join(project, 'src/models/User.crud.ts'),
      `export default {\n  title: 'People',\n  hidden: ['createdAt'],\n  fields: { name: { label: 'Full Name' } },\n};\n`,
    );
    addCrud({
      model: 'User',
      menu: 'none',
      projectRoot: project,
      templatesRoot,
      runGen: false,
    });
    const listApp = fs.readFileSync(path.join(project, 'src/webview/panels/usersList/App.tsx'), 'utf8');
    expect(listApp).toMatch(/Full Name<\/th>/);
    expect(listApp).not.toMatch(/Created At/);
    fs.rmSync(path.dirname(project), { recursive: true, force: true });
  });

  test('refuses to overwrite existing crud files', async () => {
    const project = await scaffoldWithUser();
    addCrud({ model: 'User', menu: 'none', projectRoot: project, templatesRoot, runGen: false });
    expect(() =>
      addCrud({ model: 'User', menu: 'none', projectRoot: project, templatesRoot, runGen: false }),
    ).toThrow(/already exists/i);
    fs.rmSync(path.dirname(project), { recursive: true, force: true });
  });

  test('errors when model file missing', async () => {
    const project = await scaffoldWithUser();
    expect(() =>
      addCrud({ model: 'Ghost', menu: 'none', projectRoot: project, templatesRoot, runGen: false }),
    ).toThrow(/Model file not found/);
    fs.rmSync(path.dirname(project), { recursive: true, force: true });
  });
});
