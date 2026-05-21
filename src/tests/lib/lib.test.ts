import { describe, test, expect } from 'bun:test';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { scaffold } from '../../lib/scaffold';
import { addPanel } from '../../lib/addPanel';
import { findProjectRoot } from '../../lib/findProject';

describe('scaffold', () => {
  test('creates a project with substituted placeholders', async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'vsxf-test-'));
    const target = path.join(tmp, 'demo');
    const templatesRoot = path.resolve(__dirname, '../../../templates');

    await scaffold({
      name: '@acme/demo',
      displayName: 'Acme Demo',
      description: 'A demo',
      publisher: 'acme',
      ui: 'react',
      targetDir: target,
      templatesRoot,
    });

    const pkg = JSON.parse(fs.readFileSync(path.join(target, 'package.json'), 'utf8'));
    expect(pkg.name).toBe('@acme/demo');
    expect(pkg.displayName).toBe('Acme Demo');
    expect(pkg.publisher).toBe('acme');

    const panel = fs.readFileSync(path.join(target, 'src/panels/dashboard.ts'), 'utf8');
    expect(panel).toContain('Acme Demo Dashboard');
    expect(panel).not.toContain('{{');

    const ext = fs.readFileSync(path.join(target, 'src/extension/extension.ts'), 'utf8');
    expect(ext).toContain('bootstrap(registry)');
    expect(ext).not.toContain('{{');

    fs.rmSync(tmp, { recursive: true, force: true });
  });

  test('refuses non-empty target dir', async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'vsxf-test-'));
    fs.writeFileSync(path.join(tmp, 'existing.txt'), 'hi');
    const templatesRoot = path.resolve(__dirname, '../../../templates');
    await expect(
      scaffold({
        name: 'x',
        displayName: 'X',
        description: 'x',
        publisher: 'x',
        ui: 'react',
        targetDir: tmp,
        templatesRoot,
      }),
    ).rejects.toThrow(/not empty/);
    fs.rmSync(tmp, { recursive: true, force: true });
  });
});

describe('addPanel', () => {
  const templatesRoot = path.resolve(__dirname, '../../../templates');

  async function scaffoldProject(): Promise<string> {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'vsxf-addpanel-'));
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

  test('creates panel, ui, and appends API interface', async () => {
    const project = await scaffoldProject();
    const result = addPanel({
      name: 'settings',
      title: 'Settings',
      projectRoot: project,
      templatesRoot,
      runGen: false,
    });

    expect(result.created).toContain(path.join(project, 'src/panels/settings.ts'));
    expect(result.created).toContain(path.join(project, 'src/webview/panels/settings/App.tsx'));
    expect(result.created).toContain(path.join(project, 'src/webview/panels/settings/main.tsx'));

    const panel = fs.readFileSync(path.join(project, 'src/panels/settings.ts'), 'utf8');
    expect(panel).toContain('definePanel<SettingsApi>');
    expect(panel).toContain("title: 'Settings'");
    expect(panel).not.toContain('{{');

    const app = fs.readFileSync(path.join(project, 'src/webview/panels/settings/App.tsx'), 'utf8');
    expect(app).toContain('<h1>Settings</h1>');
    expect(app).not.toContain('{{');

    const api = fs.readFileSync(path.join(project, 'src/shared/api.ts'), 'utf8');
    expect(api).toMatch(/export interface SettingsApi\s*\{\s*\}/);

    fs.rmSync(path.dirname(project), { recursive: true, force: true });
  });

  test('refuses if panel already exists', async () => {
    const project = await scaffoldProject();
    addPanel({ name: 'foo', projectRoot: project, templatesRoot, runGen: false });
    expect(() =>
      addPanel({ name: 'foo', projectRoot: project, templatesRoot, runGen: false }),
    ).toThrow(/already exists/);
    fs.rmSync(path.dirname(project), { recursive: true, force: true });
  });

  test('withApi=false omits generic and rpc', async () => {
    const project = await scaffoldProject();
    addPanel({ name: 'bar', projectRoot: project, templatesRoot, withApi: false, runGen: false });
    const panel = fs.readFileSync(path.join(project, 'src/panels/bar.ts'), 'utf8');
    expect(panel).not.toContain('BarApi');
    expect(panel).not.toContain('rpc:');
    fs.rmSync(path.dirname(project), { recursive: true, force: true });
  });
});

describe('findProjectRoot', () => {
  test('walks up to find vsxf project', async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'vsxf-find-'));
    const project = path.join(tmp, 'proj');
    fs.mkdirSync(project);
    fs.writeFileSync(
      path.join(project, 'package.json'),
      JSON.stringify({ name: 'p', scripts: { gen: 'bun scripts/gen.ts' } }),
    );
    const nested = path.join(project, 'src', 'deep');
    fs.mkdirSync(nested, { recursive: true });
    expect(findProjectRoot(nested)).toBe(project);
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  test('throws when no project found', () => {
    expect(() => findProjectRoot(os.tmpdir())).toThrow(/Not inside a vsxf project/);
  });
});
