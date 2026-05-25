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

describe('addCommand', () => {
  const templatesRoot = path.resolve(__dirname, '../../../templates');

  async function scaffoldProject(): Promise<string> {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'vsceasy-addcommand-'));
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

  test('creates command file with title default', async () => {
    const project = await scaffoldProject();
    const result = addCommand({ name: 'doStuff', projectRoot: project, templatesRoot, runGen: false });
    const file = path.join(project, 'src/commands/doStuff.ts');
    expect(result.created).toContain(file);
    const body = fs.readFileSync(file, 'utf8');
    expect(body).toContain("title: 'DoStuff'");
    expect(body).not.toContain('{{');
    expect(body).not.toContain('category:');
    fs.rmSync(path.dirname(project), { recursive: true, force: true });
  });

  test('respects custom title + category', async () => {
    const project = await scaffoldProject();
    addCommand({
      name: 'sync',
      title: 'Sync Now',
      category: 'Demo',
      projectRoot: project,
      templatesRoot,
      runGen: false,
    });
    const body = fs.readFileSync(path.join(project, 'src/commands/sync.ts'), 'utf8');
    expect(body).toContain("title: 'Sync Now'");
    expect(body).toContain("category: 'Demo'");
    fs.rmSync(path.dirname(project), { recursive: true, force: true });
  });

  test('normalizes kebab name to camelCase filename', async () => {
    const project = await scaffoldProject();
    const result = addCommand({ name: 'do-cool-stuff', projectRoot: project, templatesRoot, runGen: false });
    expect(result.created[0]).toMatch(/doCoolStuff\.ts$/);
    fs.rmSync(path.dirname(project), { recursive: true, force: true });
  });

  test('refuses if command file exists', async () => {
    const project = await scaffoldProject();
    addCommand({ name: 'dup', projectRoot: project, templatesRoot, runGen: false });
    expect(() =>
      addCommand({ name: 'dup', projectRoot: project, templatesRoot, runGen: false }),
    ).toThrow(/already exists/);
    fs.rmSync(path.dirname(project), { recursive: true, force: true });
  });

  test('rejects invalid name', async () => {
    const project = await scaffoldProject();
    expect(() =>
      addCommand({ name: '---', projectRoot: project, templatesRoot, runGen: false }),
    ).toThrow(/Invalid command name/);
    fs.rmSync(path.dirname(project), { recursive: true, force: true });
  });

  test('writes keybinding field into command file when provided', async () => {
    const project = await scaffoldProject();
    addCommand({
      name: 'kb',
      keybinding: 'ctrl+shift+h',
      projectRoot: project,
      templatesRoot,
      runGen: false,
    });
    const body = fs.readFileSync(path.join(project, 'src/commands/kb.ts'), 'utf8');
    expect(body).toContain("keybinding: 'ctrl+shift+h'");
    fs.rmSync(path.dirname(project), { recursive: true, force: true });
  });

  test('gen emits contributes.keybindings from command files', async () => {
    const project = await scaffoldProject();
    addCommand({
      name: 'shortcutCmd',
      keybinding: 'ctrl+shift+x',
      projectRoot: project,
      templatesRoot,
      runGen: false,
    });
    const r = require('child_process').spawnSync('bun', ['scripts/gen.ts'], {
      cwd: project,
      stdio: 'pipe',
    });
    expect(r.status).toBe(0);
    const pkg = JSON.parse(fs.readFileSync(path.join(project, 'package.json'), 'utf8'));
    expect(pkg.contributes.keybindings).toBeDefined();
    const kb = pkg.contributes.keybindings.find((k: any) => k.command.endsWith('.shortcutCmd'));
    expect(kb?.key).toBe('ctrl+shift+x');
    fs.rmSync(path.dirname(project), { recursive: true, force: true });
  });

  test('inserts menu entry when menuEntry provided', async () => {
    const project = await scaffoldProject();
    addMenu({ name: 'main', projectRoot: project, templatesRoot, runGen: false });
    const result = addCommand({
      name: 'ping',
      menuEntry: 'main',
      icon: 'play',
      projectRoot: project,
      templatesRoot,
      runGen: false,
    });
    expect(result.menuUpdated).toBe(true);
    const menuBody = fs.readFileSync(path.join(project, 'src/menus/main.ts'), 'utf8');
    expect(menuBody).toContain("command: 'ping'");
    expect(menuBody).toContain("icon: 'play'");
    fs.rmSync(path.dirname(project), { recursive: true, force: true });
  });
});
