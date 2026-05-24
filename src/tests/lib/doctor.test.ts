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

describe('doctor', () => {
  const templatesRoot = path.resolve(__dirname, '../../../templates');

  async function scaffoldProject(): Promise<string> {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'vsxf-doctor-'));
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

  test('greenfield project reports no errors', async () => {
    const project = await scaffoldProject();
    const report = runDoctor({ projectRoot: project });
    expect(report.counts.error).toBe(0);
    const engine = report.results.find((r) => r.id === 'engine');
    expect(engine?.level).toBe('ok');
    fs.rmSync(path.dirname(project), { recursive: true, force: true });
  });

  test('detects RPC contract drift (missing handler)', async () => {
    const project = await scaffoldProject();
    // Inject extra method into DashboardApi that has no handler
    const apiFile = path.join(project, 'src/shared/api.ts');
    let api = fs.readFileSync(apiFile, 'utf8');
    api = api.replace(/(interface DashboardApi[^{]*\{)/, '$1\n  missingMethod(): Promise<void>;');
    fs.writeFileSync(apiFile, api);

    const report = runDoctor({ projectRoot: project });
    const drift = report.results.find((r) => r.id === 'rpc.dashboard');
    expect(drift?.level).toBe('error');
    expect(drift?.details?.some((d) => d.includes('missingMethod'))).toBe(true);
    fs.rmSync(path.dirname(project), { recursive: true, force: true });
  });

  test('detects orphan menu reference', async () => {
    const project = await scaffoldProject();
    addMenu({ name: 'main', projectRoot: project, templatesRoot, runGen: false });
    const editMenuLib = require('../../lib/menu/edit');
    editMenuLib.editMenu({
      projectRoot: project,
      menuName: 'main',
      runGen: false,
      item: { label: 'Ghost', kind: 'command', target: 'nonexistent' },
    });

    const report = runDoctor({ projectRoot: project });
    const menuCheck = report.results.find((r) => r.id === 'menu.main.refs');
    expect(menuCheck?.level).toBe('error');
    expect(menuCheck?.details?.some((d) => d.includes('nonexistent'))).toBe(true);
    fs.rmSync(path.dirname(project), { recursive: true, force: true });
  });

  test('flags missing engines.vscode', async () => {
    const project = await scaffoldProject();
    const pkgPath = path.join(project, 'package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    delete pkg.engines;
    fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2));

    const report = runDoctor({ projectRoot: project });
    const engine = report.results.find((r) => r.id === 'engine');
    expect(engine?.level).toBe('error');
    fs.rmSync(path.dirname(project), { recursive: true, force: true });
  });

  test('flags unknown codicon in menu', async () => {
    const project = await scaffoldProject();
    addMenu({ name: 'tools', icon: 'not-a-real-codicon', projectRoot: project, templatesRoot, runGen: false });
    const report = runDoctor({ projectRoot: project });
    const icons = report.results.find((r) => r.id === 'menu.tools.icons');
    expect(icons?.level).toBe('warn');
    fs.rmSync(path.dirname(project), { recursive: true, force: true });
  });

  test('--fix adds missing RPC handler stubs', async () => {
    const project = await scaffoldProject();
    const apiFile = path.join(project, 'src/shared/api.ts');
    let api = fs.readFileSync(apiFile, 'utf8');
    api = api.replace(/(interface DashboardApi[^{]*\{)/, '$1\n  newOne(): Promise<void>;');
    fs.writeFileSync(apiFile, api);

    const report = runDoctor({ projectRoot: project });
    const applied = applyFixes(report);
    expect(applied.some((a) => a.id === 'rpc.dashboard' && /added.*newOne/.test(a.message))).toBe(true);

    const panelBody = fs.readFileSync(path.join(project, 'src/panels/dashboard.ts'), 'utf8');
    expect(panelBody).toContain('async newOne()');
    expect(panelBody).toContain("throw new Error('Not implemented')");

    const re = runDoctor({ projectRoot: project });
    expect(re.results.find((r) => r.id === 'rpc.dashboard')?.level).toBe('ok');
    fs.rmSync(path.dirname(project), { recursive: true, force: true });
  });

  test('--fix removes orphan menu command refs', async () => {
    const project = await scaffoldProject();
    addMenu({ name: 'main', projectRoot: project, templatesRoot, runGen: false });
    const editMenuLib = require('../../lib/menu/edit');
    editMenuLib.editMenu({
      projectRoot: project,
      menuName: 'main',
      runGen: false,
      item: { label: 'Ghost', kind: 'command', target: 'doesNotExist' },
    });

    const report = runDoctor({ projectRoot: project });
    expect(report.results.find((r) => r.id === 'menu.main.refs')?.level).toBe('error');
    applyFixes(report);

    const menuBody = fs.readFileSync(path.join(project, 'src/menus/main.ts'), 'utf8');
    expect(menuBody).not.toContain('doesNotExist');
    expect(menuBody).not.toContain("label: 'Ghost'");

    const after = runDoctor({ projectRoot: project });
    expect(after.results.find((r) => r.id === 'menu.main.refs')).toBeUndefined();
    fs.rmSync(path.dirname(project), { recursive: true, force: true });
  });

  test('--fix appends missing .gitignore entries', async () => {
    const project = await scaffoldProject();
    const gi = path.join(project, '.gitignore');
    fs.writeFileSync(gi, 'foo\n');

    const report = runDoctor({ projectRoot: project });
    const giResult = report.results.find((r) => r.id === 'gitignore');
    expect(giResult?.level).toBe('warn');
    applyFixes(report);

    const content = fs.readFileSync(gi, 'utf8');
    expect(content).toContain('dist');
    expect(content).toContain('node_modules');
    expect(content).toContain('foo');
    fs.rmSync(path.dirname(project), { recursive: true, force: true });
  });
});
