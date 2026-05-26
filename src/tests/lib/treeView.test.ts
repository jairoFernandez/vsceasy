import { describe, test, expect } from 'bun:test';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { scaffold } from '../../lib/scaffold';
import { addMenu } from '../../lib/menu/add';
import { addTreeView } from '../../lib/treeView/add';

const templatesRoot = path.resolve(__dirname, '../../../templates');

async function scaffoldProject(): Promise<string> {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'vsceasy-treeview-'));
  const target = path.join(tmp, 'demo');
  await scaffold({
    name: 'demo',
    displayName: 'Demo',
    description: 'demo',
    publisher: 'acme',
    ui: 'react',
    targetDir: target,
    templatesRoot,
  });
  return target;
}

describe('addTreeView', () => {
  test('creates a tree view file under an existing menu', async () => {
    const project = await scaffoldProject();
    addMenu({ name: 'main', projectRoot: project, templatesRoot, runGen: false });

    const result = addTreeView({
      name: 'explorer',
      menu: 'main',
      projectRoot: project,
      templatesRoot,
      runGen: false,
    });

    const file = path.join(project, 'src', 'treeViews', 'explorer.ts');
    expect(result.created).toContain(file);
    expect(fs.existsSync(file)).toBe(true);
    const src = fs.readFileSync(file, 'utf8');
    expect(src).toMatch(/defineTreeView/);
    expect(src).toMatch(/menu: 'main'/);
    expect(src).toMatch(/title: 'Explorer'/);

    fs.rmSync(path.dirname(project), { recursive: true, force: true });
  });

  test('rejects unknown menu', async () => {
    const project = await scaffoldProject();
    expect(() =>
      addTreeView({
        name: 'x',
        menu: 'ghost',
        projectRoot: project,
        templatesRoot,
        runGen: false,
      }),
    ).toThrow(/menu "ghost" not found/i);
    fs.rmSync(path.dirname(project), { recursive: true, force: true });
  });

  test('unknown-menu error lists existing menus', async () => {
    const project = await scaffoldProject();
    addMenu({ name: 'settings', projectRoot: project, templatesRoot, runGen: false });
    addMenu({ name: 'tools', projectRoot: project, templatesRoot, runGen: false });
    expect(() =>
      addTreeView({
        name: 'x',
        menu: 'ghost',
        projectRoot: project,
        templatesRoot,
        runGen: false,
      }),
    ).toThrow(/Available menus: "settings", "tools"/);
    fs.rmSync(path.dirname(project), { recursive: true, force: true });
  });

  test('rejects duplicate tree view', async () => {
    const project = await scaffoldProject();
    addMenu({ name: 'main', projectRoot: project, templatesRoot, runGen: false });
    addTreeView({ name: 'dup', menu: 'main', projectRoot: project, templatesRoot, runGen: false });
    expect(() =>
      addTreeView({ name: 'dup', menu: 'main', projectRoot: project, templatesRoot, runGen: false }),
    ).toThrow(/already exists/i);
    fs.rmSync(path.dirname(project), { recursive: true, force: true });
  });

  test('rejects invalid id', async () => {
    const project = await scaffoldProject();
    addMenu({ name: 'main', projectRoot: project, templatesRoot, runGen: false });
    expect(() =>
      addTreeView({ name: '---', menu: 'main', projectRoot: project, templatesRoot, runGen: false }),
    ).toThrow(/tree view name is required|Invalid tree view name/i);
    fs.rmSync(path.dirname(project), { recursive: true, force: true });
  });
});
