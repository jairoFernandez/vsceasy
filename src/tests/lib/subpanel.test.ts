import { describe, test, expect } from 'bun:test';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { scaffold } from '../../lib/scaffold';
import { addMenu } from '../../lib/menu/add';
import { addSubpanel } from '../../lib/subpanel/add';

describe('addSubpanel', () => {
  const templatesRoot = path.resolve(__dirname, '../../../templates');

  async function scaffoldProject(): Promise<string> {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'vsxf-addwv-'));
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

  test('creates view file, UI, and API interface', async () => {
    const project = await scaffoldProject();
    addMenu({ name: 'main', projectRoot: project, templatesRoot, runGen: false });
    const result = addSubpanel({
      name: 'welcome',
      menu: 'main',
      projectRoot: project,
      templatesRoot,
      runGen: false,
    });
    const view = path.join(project, 'src/subpanels/welcome.ts');
    expect(result.created).toContain(view);
    const body = fs.readFileSync(view, 'utf8');
    expect(body).toContain("menu: 'main'");
    expect(body).toContain("title: 'Welcome'");
    expect(body).toContain('defineSubpanel<WelcomeViewApi>');
    expect(body).not.toContain('{{');

    const app = fs.readFileSync(path.join(project, 'src/webview/subpanels/welcome/App.tsx'), 'utf8');
    expect(app).toContain('<h2>Welcome</h2>');

    const api = fs.readFileSync(path.join(project, 'src/shared/api.ts'), 'utf8');
    expect(api).toMatch(/export interface WelcomeViewApi\s*\{\s*\}/);
    fs.rmSync(path.dirname(project), { recursive: true, force: true });
  });

  test('refuses unknown menu', async () => {
    const project = await scaffoldProject();
    expect(() =>
      addSubpanel({
        name: 'home',
        menu: 'doesNotExist',
        projectRoot: project,
        templatesRoot,
        runGen: false,
      }),
    ).toThrow(/Menu not found/);
    fs.rmSync(path.dirname(project), { recursive: true, force: true });
  });

  test('refuses duplicate', async () => {
    const project = await scaffoldProject();
    addMenu({ name: 'main', projectRoot: project, templatesRoot, runGen: false });
    addSubpanel({ name: 'dup', menu: 'main', projectRoot: project, templatesRoot, runGen: false });
    expect(() =>
      addSubpanel({ name: 'dup', menu: 'main', projectRoot: project, templatesRoot, runGen: false }),
    ).toThrow(/already exists/);
    fs.rmSync(path.dirname(project), { recursive: true, force: true });
  });

  test('withApi=false omits generic + rpc + API interface', async () => {
    const project = await scaffoldProject();
    addMenu({ name: 'main', projectRoot: project, templatesRoot, runGen: false });
    addSubpanel({
      name: 'plain',
      menu: 'main',
      withApi: false,
      projectRoot: project,
      templatesRoot,
      runGen: false,
    });
    const body = fs.readFileSync(path.join(project, 'src/subpanels/plain.ts'), 'utf8');
    expect(body).not.toContain('PlainViewApi');
    expect(body).not.toContain('rpc:');
    const api = fs.readFileSync(path.join(project, 'src/shared/api.ts'), 'utf8');
    expect(api).not.toContain('PlainViewApi');
    fs.rmSync(path.dirname(project), { recursive: true, force: true });
  });
});
