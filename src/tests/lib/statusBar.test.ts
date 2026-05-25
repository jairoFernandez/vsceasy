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

describe('addStatusBar', () => {
  const templatesRoot = path.resolve(__dirname, '../../../templates');

  async function scaffoldProject(): Promise<string> {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'vsceasy-addsb-'));
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

  test('creates status bar file binding to existing command', async () => {
    const project = await scaffoldProject();
    const result = addStatusBar({
      name: 'buildBtn',
      text: 'Build',
      command: 'hello',
      projectRoot: project,
      templatesRoot,
      runGen: false,
    });
    const file = path.join(project, 'src/statusBars/buildBtn.ts');
    expect(result.created).toContain(file);
    const body = fs.readFileSync(file, 'utf8');
    expect(body).toContain("text: 'Build'");
    expect(body).toContain("command: 'hello'");
    expect(body).toContain("alignment: 'left'");
    expect(body).toContain('priority: 100');
    expect(body).not.toContain('{{');
    fs.rmSync(path.dirname(project), { recursive: true, force: true });
  });

  test('bootstraps new command via newCommandTitle', async () => {
    const project = await scaffoldProject();
    const result = addStatusBar({
      name: 'syncBtn',
      text: 'Sync',
      newCommandTitle: 'Run Sync',
      projectRoot: project,
      templatesRoot,
      runGen: false,
    });
    expect(result.commandCreated).toBe('syncBtnAction');
    const cmdBody = fs.readFileSync(path.join(project, 'src/commands/syncBtnAction.ts'), 'utf8');
    expect(cmdBody).toContain("title: 'Run Sync'");
    const sbBody = fs.readFileSync(path.join(project, 'src/statusBars/syncBtn.ts'), 'utf8');
    expect(sbBody).toContain("command: 'syncBtnAction'");
    fs.rmSync(path.dirname(project), { recursive: true, force: true });
  });

  test('emits tooltipMarkdown as backtick string when provided', async () => {
    const project = await scaffoldProject();
    const md = '### Title\n\n[Click](command:foo)';
    const result = addStatusBar({
      name: 'rich',
      text: 'Rich',
      command: 'hello',
      tooltipMarkdown: md,
      projectRoot: project,
      templatesRoot,
      runGen: false,
    });
    const body = fs.readFileSync(result.created[0], 'utf8');
    expect(body).toContain('tooltipMarkdown: `### Title');
    expect(body).toContain('[Click](command:foo)');
    expect(body).not.toMatch(/\btooltip:/);
    fs.rmSync(path.dirname(project), { recursive: true, force: true });
  });

  test('emits menu array with mixed command/panel/url items', async () => {
    const project = await scaffoldProject();
    const result = addStatusBar({
      name: 'tools',
      text: 'Tools',
      menu: [
        { label: '$(play) Run', command: 'hello' },
        { label: '$(window) Dash', panel: 'dashboard', description: 'Open dashboard' },
        { label: '$(book) Docs', url: 'https://example.com' },
      ],
      projectRoot: project,
      templatesRoot,
      runGen: false,
    });
    const body = fs.readFileSync(result.created[0], 'utf8');
    expect(body).toContain('menu: [');
    expect(body).toContain("command: 'hello'");
    expect(body).toContain("panel: 'dashboard'");
    expect(body).toContain("url: 'https://example.com'");
    expect(body).toContain("description: 'Open dashboard'");
    expect(body).not.toMatch(/^\s*command:/m); // top-level command suppressed
    fs.rmSync(path.dirname(project), { recursive: true, force: true });
  });

  test('binds to a panel (uses panel field, omits command)', async () => {
    const project = await scaffoldProject();
    const result = addStatusBar({
      name: 'openDash',
      text: 'Dash',
      panel: 'dashboard',
      projectRoot: project,
      templatesRoot,
      runGen: false,
    });
    const body = fs.readFileSync(result.created[0], 'utf8');
    expect(body).toContain("panel: 'dashboard'");
    expect(body).not.toMatch(/\bcommand:/);
    fs.rmSync(path.dirname(project), { recursive: true, force: true });
  });

  test('writes optional fields when present', async () => {
    const project = await scaffoldProject();
    addStatusBar({
      name: 'warn',
      text: 'careful',
      alignment: 'right',
      priority: 50,
      tooltip: 'Heads up',
      icon: 'warning',
      command: 'hello',
      projectRoot: project,
      templatesRoot,
      runGen: false,
    });
    const body = fs.readFileSync(path.join(project, 'src/statusBars/warn.ts'), 'utf8');
    expect(body).toContain("icon: 'warning'");
    expect(body).toContain("tooltip: 'Heads up'");
    expect(body).toContain("alignment: 'right'");
    expect(body).toContain('priority: 50');
    fs.rmSync(path.dirname(project), { recursive: true, force: true });
  });

  test('refuses duplicate', async () => {
    const project = await scaffoldProject();
    addStatusBar({ name: 'dup', text: 'x', command: 'hello', projectRoot: project, templatesRoot, runGen: false });
    expect(() =>
      addStatusBar({ name: 'dup', text: 'x', command: 'hello', projectRoot: project, templatesRoot, runGen: false }),
    ).toThrow(/already exists/);
    fs.rmSync(path.dirname(project), { recursive: true, force: true });
  });
});
