import { describe, test, expect } from 'bun:test';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { scaffold, substitute } from '../../lib/scaffold';
import { addPanel } from '../../lib/panel/add';
import { addMenu } from '../../lib/menu/add';
import { addCommand } from '../../lib/command/add';
import { addRpcMethod } from '../../lib/rpc/add';
import { addStatusBar } from '../../lib/statusBar/add';
import { runDoctor, applyFixes } from '../../lib/doctor';
import { upgrade } from '../../lib/upgrade';
import { editMenu, insertItem, listGroups, listMenus, listPanels } from '../../lib/menu/edit';
import { findProjectRoot } from '../../lib/findProject';
import { parseMenu, renderMenuTree } from '../../lib/menuTree';

describe('addPanel', () => {
  const templatesRoot = path.resolve(__dirname, '../../../templates');

  async function scaffoldProject(): Promise<string> {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'vsceasy-addpanel-'));
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
