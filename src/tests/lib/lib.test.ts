import { describe, test, expect } from 'bun:test';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { scaffold, substitute } from '../../lib/scaffold';
import { addPanel } from '../../lib/addPanel';
import { addMenu } from '../../lib/addMenu';
import { addCommand } from '../../lib/addCommand';
import { addRpcMethod } from '../../lib/addRpcMethod';
import { addStatusBar } from '../../lib/addStatusBar';
import { runDoctor, applyFixes } from '../../lib/doctor';
import { upgrade } from '../../lib/upgrade';
import { editMenu, insertItem, listGroups, listMenus, listPanels } from '../../lib/editMenu';
import { findProjectRoot } from '../../lib/findProject';
import { parseMenu, renderMenuTree } from '../../lib/menuTree';

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

    const codiconTypes = fs.readFileSync(path.join(target, 'src/shared/vsxf/codiconNames.ts'), 'utf8');
    expect(codiconTypes).toContain('export type CodiconName');
    expect(codiconTypes).toContain("'rocket'");
    const defineSrc = fs.readFileSync(path.join(target, 'src/shared/vsxf/define.ts'), 'utf8');
    expect(defineSrc).toContain("from './codiconNames'");
    expect(defineSrc).toContain('CodiconName');

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

describe('substitute', () => {
  test('replaces placeholders', () => {
    expect(substitute('hi {{name}}!', { name: 'bob' })).toBe('hi bob!');
  });

  test('replaces multiple occurrences and keys', () => {
    expect(substitute('{{a}}-{{b}}-{{a}}', { a: '1', b: '2' })).toBe('1-2-1');
  });

  test('leaves unknown placeholders untouched', () => {
    expect(substitute('{{x}} {{y}}', { x: 'X' })).toBe('X {{y}}');
  });
});

describe('addMenu', () => {
  const templatesRoot = path.resolve(__dirname, '../../../templates');

  async function scaffoldProject(): Promise<string> {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'vsxf-addmenu-'));
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

  test('creates menu with defaults', async () => {
    const project = await scaffoldProject();
    const result = addMenu({ name: 'main', projectRoot: project, templatesRoot, runGen: false });
    const menuFile = path.join(project, 'src/menus/main.ts');
    expect(result.created).toContain(menuFile);
    const body = fs.readFileSync(menuFile, 'utf8');
    expect(body).toContain("title: 'Main'");
    expect(body).toContain("icon: 'symbol-misc'");
    expect(body).not.toContain('{{');
    fs.rmSync(path.dirname(project), { recursive: true, force: true });
  });

  test('uses custom title and icon', async () => {
    const project = await scaffoldProject();
    addMenu({
      name: 'tools',
      title: 'My Tools',
      icon: 'tools',
      projectRoot: project,
      templatesRoot,
      runGen: false,
    });
    const body = fs.readFileSync(path.join(project, 'src/menus/tools.ts'), 'utf8');
    expect(body).toContain("title: 'My Tools'");
    expect(body).toContain("icon: 'tools'");
    fs.rmSync(path.dirname(project), { recursive: true, force: true });
  });

  test('normalizes kebab/snake to camelCase filename', async () => {
    const project = await scaffoldProject();
    const result = addMenu({
      name: 'my-cool_menu',
      projectRoot: project,
      templatesRoot,
      runGen: false,
    });
    expect(result.created[0]).toMatch(/myCoolMenu\.ts$/);
    fs.rmSync(path.dirname(project), { recursive: true, force: true });
  });

  test('refuses if menu already exists', async () => {
    const project = await scaffoldProject();
    addMenu({ name: 'dup', projectRoot: project, templatesRoot, runGen: false });
    expect(() =>
      addMenu({ name: 'dup', projectRoot: project, templatesRoot, runGen: false }),
    ).toThrow(/already exists/);
    fs.rmSync(path.dirname(project), { recursive: true, force: true });
  });

  test('rejects invalid name', async () => {
    const project = await scaffoldProject();
    expect(() =>
      addMenu({ name: '---', projectRoot: project, templatesRoot, runGen: false }),
    ).toThrow(/Invalid menu name/);
    fs.rmSync(path.dirname(project), { recursive: true, force: true });
  });
});

describe('editMenu', () => {
  const templatesRoot = path.resolve(__dirname, '../../../templates');

  async function scaffoldProject(): Promise<string> {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'vsxf-editmenu-'));
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
    addMenu({ name: 'main', projectRoot: target, templatesRoot, runGen: false });
    return target;
  }

  test('listMenus / listPanels reflect scaffold', async () => {
    const project = await scaffoldProject();
    expect(listMenus(project)).toContain('main');
    expect(listPanels(project).length).toBeGreaterThan(0);
    fs.rmSync(path.dirname(project), { recursive: true, force: true });
  });

  test('listGroups returns Panels and Actions from template', async () => {
    const project = await scaffoldProject();
    const src = fs.readFileSync(path.join(project, 'src/menus/main.ts'), 'utf8');
    expect(listGroups(src)).toEqual(['Panels', 'Actions']);
    fs.rmSync(path.dirname(project), { recursive: true, force: true });
  });

  test('insertItem adds a panel under existing group', async () => {
    const project = await scaffoldProject();
    const file = path.join(project, 'src/menus/main.ts');
    const before = fs.readFileSync(file, 'utf8');
    const { source } = insertItem(before, {
      label: 'Dashboard',
      kind: 'panel',
      target: 'dashboard',
      icon: 'dashboard',
      parentLabel: 'Panels',
    });
    expect(source).toContain("label: 'Dashboard'");
    expect(source).toContain("panel: 'dashboard'");
    expect(source).toContain("icon: 'dashboard'");
    fs.rmSync(path.dirname(project), { recursive: true, force: true });
  });

  test('editMenu writes the file and supports root insertion', async () => {
    const project = await scaffoldProject();
    editMenu({
      projectRoot: project,
      menuName: 'main',
      item: { label: 'Top', kind: 'group' },
      runGen: false,
    });
    const after = fs.readFileSync(path.join(project, 'src/menus/main.ts'), 'utf8');
    expect(after).toContain("label: 'Top'");
    expect(after).toContain('children: []');
    fs.rmSync(path.dirname(project), { recursive: true, force: true });
  });

  test('insertItem url and command kinds', async () => {
    const project = await scaffoldProject();
    const src = fs.readFileSync(path.join(project, 'src/menus/main.ts'), 'utf8');
    const a = insertItem(src, { label: 'Docs', kind: 'url', target: 'https://example.com', parentLabel: 'Actions' });
    expect(a.source).toContain("url: 'https://example.com'");
    const b = insertItem(src, { label: 'Hello', kind: 'command', target: 'hello', parentLabel: 'Actions' });
    expect(b.source).toContain("command: 'hello'");
    fs.rmSync(path.dirname(project), { recursive: true, force: true });
  });

  test('throws when menu missing', async () => {
    const project = await scaffoldProject();
    expect(() => editMenu({
      projectRoot: project,
      menuName: 'nonexistent',
      item: { label: 'X', kind: 'group' },
      runGen: false,
    })).toThrow(/Menu not found/);
    fs.rmSync(path.dirname(project), { recursive: true, force: true });
  });

  test('throws when group label missing', async () => {
    const project = await scaffoldProject();
    expect(() => editMenu({
      projectRoot: project,
      menuName: 'main',
      item: { label: 'X', kind: 'group', parentLabel: 'Ghost' },
      runGen: false,
    })).toThrow(/Group "Ghost" not found/);
    fs.rmSync(path.dirname(project), { recursive: true, force: true });
  });

  test('inserted source still TypeScript-evaluatable shape', async () => {
    const project = await scaffoldProject();
    editMenu({
      projectRoot: project,
      menuName: 'main',
      item: { label: 'Settings', kind: 'panel', target: 'settings', icon: 'gear', parentLabel: 'Panels' },
      runGen: false,
    });
    const after = fs.readFileSync(path.join(project, 'src/menus/main.ts'), 'utf8');
    // No leftover placeholders and balanced brackets
    expect(after).not.toContain('{{');
    expect(countChar(after, '[')).toBe(countChar(after, ']'));
    expect(countChar(after, '{')).toBe(countChar(after, '}'));
    fs.rmSync(path.dirname(project), { recursive: true, force: true });
  });
});

function countChar(s: string, ch: string): number {
  let n = 0;
  for (const c of s) if (c === ch) n++;
  return n;
}

function stripAnsi(s: string): string {
  return s.replace(/\x1b\[[0-9;]*m/g, '');
}

describe('menuTree', () => {
  const sampleMenu = `import { defineMenu } from '../shared/vsxf';

export default defineMenu({
  title: 'Example 1',
  icon: 'rocket',
  items: [
    {
      label: 'Panels',
      children: [
        { label: 'Dashboard', panel: 'dashboard', icon: 'dashboard' },
        { label: 'Settings', panel: 'settings', icon: 'gear' },
      ],
    },
    {
      label: 'Actions',
      children: [
        { label: 'Hello', command: 'hello', icon: 'play' },
        { label: 'Docs', url: 'https://example.com', icon: 'book' },
      ],
    },
  ],
});
`;

  test('parseMenu extracts title, icon, and nested items', () => {
    const t = parseMenu(sampleMenu);
    expect(t.title).toBe('Example 1');
    expect(t.icon).toBe('rocket');
    expect(t.items.map((i) => i.label)).toEqual(['Panels', 'Actions']);
    expect(t.items[0].kind).toBe('group');
    expect(t.items[0].children?.map((c) => c.label)).toEqual(['Dashboard', 'Settings']);
    expect(t.items[0].children?.[0].kind).toBe('panel');
    expect(t.items[0].children?.[0].target).toBe('dashboard');
    expect(t.items[1].children?.[0].kind).toBe('command');
    expect(t.items[1].children?.[1].kind).toBe('url');
    expect(t.items[1].children?.[1].target).toBe('https://example.com');
  });

  test('renderMenuTree shows ghost insert under group', () => {
    const t = parseMenu(sampleMenu);
    const out = stripAnsi(renderMenuTree(t, {
      insertUnder: 'Panels',
      ghost: { label: 'Logs', kind: 'panel', target: 'logs', icon: 'output' },
    }));
    expect(out).toContain('Example 1');
    expect(out).toContain('Panels');
    expect(out).toContain('Dashboard');
    expect(out).toContain('Logs');
    expect(out).toContain('← new');
  });

  test('renderMenuTree ghost at root', () => {
    const t = parseMenu(sampleMenu);
    const out = stripAnsi(renderMenuTree(t, {
      insertUnder: 'root',
      ghost: { label: 'Misc', kind: 'group' },
    }));
    expect(out).toContain('Misc');
    expect(out).toContain('← new');
  });
});

describe('addCommand', () => {
  const templatesRoot = path.resolve(__dirname, '../../../templates');

  async function scaffoldProject(): Promise<string> {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'vsxf-addcommand-'));
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

describe('addRpcMethod', () => {
  const templatesRoot = path.resolve(__dirname, '../../../templates');

  async function scaffoldProject(): Promise<string> {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'vsxf-addrpc-'));
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

  test('adds method to existing api interface + rpc handler', async () => {
    const project = await scaffoldProject();
    const result = addRpcMethod({
      panel: 'dashboard',
      method: 'getCount',
      paramSig: 'limit: number',
      returns: 'number',
      projectRoot: project,
    });
    expect(result.interfaceCreated).toBe(false);
    expect(result.rpcBlockCreated).toBe(false);
    expect(result.webviewSnippet).toBe('const result = await api.getCount(limit);');
    const apiBody = fs.readFileSync(result.apiFile, 'utf8');
    expect(apiBody).toMatch(/interface DashboardApi[\s\S]*getCount\(limit: number\): Promise<number>;[\s\S]*\}/);
    const panelBody = fs.readFileSync(result.panelFile, 'utf8');
    expect(panelBody).toContain('async getCount(limit)');
    expect(panelBody).toContain("throw new Error('Not implemented')");
    fs.rmSync(path.dirname(project), { recursive: true, force: true });
  });

  test('wraps already-Promise return type only once', async () => {
    const project = await scaffoldProject();
    const result = addRpcMethod({
      panel: 'dashboard',
      method: 'fetchThing',
      returns: 'Promise<string[]>',
      projectRoot: project,
    });
    const apiBody = fs.readFileSync(result.apiFile, 'utf8');
    expect(apiBody).toContain('fetchThing(): Promise<string[]>;');
    expect(apiBody).not.toContain('Promise<Promise<');
    fs.rmSync(path.dirname(project), { recursive: true, force: true });
  });

  test('refuses duplicate method', async () => {
    const project = await scaffoldProject();
    addRpcMethod({ panel: 'dashboard', method: 'getCount', returns: 'number', projectRoot: project });
    expect(() =>
      addRpcMethod({ panel: 'dashboard', method: 'getCount', returns: 'number', projectRoot: project }),
    ).toThrow(/already declared/);
    fs.rmSync(path.dirname(project), { recursive: true, force: true });
  });

  test('rejects non-camelCase method', async () => {
    const project = await scaffoldProject();
    expect(() =>
      addRpcMethod({ panel: 'dashboard', method: 'Get-Count', projectRoot: project }),
    ).toThrow(/Invalid method name/);
    fs.rmSync(path.dirname(project), { recursive: true, force: true });
  });

  test('creates interface + rpc block when panel has neither', async () => {
    const project = await scaffoldProject();
    // Add a fresh panel without api
    addPanel({ name: 'plain', withApi: false, projectRoot: project, templatesRoot, runGen: false });
    const result = addRpcMethod({
      panel: 'plain',
      method: 'ping',
      returns: 'string',
      projectRoot: project,
    });
    expect(result.interfaceCreated).toBe(true);
    expect(result.rpcBlockCreated).toBe(true);
    const apiBody = fs.readFileSync(result.apiFile, 'utf8');
    expect(apiBody).toMatch(/export interface PlainApi \{[\s\S]*ping\(\): Promise<string>;[\s\S]*\}/);
    const panelBody = fs.readFileSync(result.panelFile, 'utf8');
    expect(panelBody).toContain("import type { PlainApi } from '../shared/api'");
    expect(panelBody).toContain('definePanel<PlainApi>');
    expect(panelBody).toContain('rpc: (vscode) => ({');
    fs.rmSync(path.dirname(project), { recursive: true, force: true });
  });
});

describe('addStatusBar', () => {
  const templatesRoot = path.resolve(__dirname, '../../../templates');

  async function scaffoldProject(): Promise<string> {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'vsxf-addsb-'));
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
    const editMenuLib = require('../../lib/editMenu');
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
    const editMenuLib = require('../../lib/editMenu');
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

describe('upgrade', () => {
  const templatesRoot = path.resolve(__dirname, '../../../templates');

  async function scaffoldProject(): Promise<string> {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'vsxf-upgrade-'));
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

  test('greenfield reports all in-sync (no changes)', async () => {
    const project = await scaffoldProject();
    const result = upgrade({ projectRoot: project, templatesRoot, apply: false });
    expect(result.applied).toBe(false);
    expect(result.changes.every((c) => c.status === 'in-sync')).toBe(true);
    fs.rmSync(path.dirname(project), { recursive: true, force: true });
  });

  test('detects drift as would-update (dry-run)', async () => {
    const project = await scaffoldProject();
    const bootstrapPath = path.join(project, 'src/shared/vsxf/bootstrap.ts');
    fs.writeFileSync(bootstrapPath, '// stale content\n');
    const result = upgrade({ projectRoot: project, templatesRoot, apply: false });
    const change = result.changes.find((c) => c.path === 'src/shared/vsxf/bootstrap.ts');
    expect(change?.status).toBe('would-update');
    // File untouched in dry-run
    expect(fs.readFileSync(bootstrapPath, 'utf8')).toBe('// stale content\n');
    fs.rmSync(path.dirname(project), { recursive: true, force: true });
  });

  test('apply=true overwrites drifted file', async () => {
    const project = await scaffoldProject();
    const bootstrapPath = path.join(project, 'src/shared/vsxf/bootstrap.ts');
    fs.writeFileSync(bootstrapPath, '// stale\n');
    const result = upgrade({ projectRoot: project, templatesRoot, apply: true, runGen: false });
    const change = result.changes.find((c) => c.path === 'src/shared/vsxf/bootstrap.ts');
    expect(change?.status).toBe('updated');
    const sourcePath = path.join(templatesRoot, 'react/src/shared/vsxf/bootstrap.ts');
    expect(fs.readFileSync(bootstrapPath, 'utf8')).toBe(fs.readFileSync(sourcePath, 'utf8'));
    fs.rmSync(path.dirname(project), { recursive: true, force: true });
  });

  test('apply creates missing file', async () => {
    const project = await scaffoldProject();
    fs.unlinkSync(path.join(project, 'src/shared/vsxf/define.ts'));
    const result = upgrade({ projectRoot: project, templatesRoot, apply: true, runGen: false });
    const change = result.changes.find((c) => c.path === 'src/shared/vsxf/define.ts');
    expect(change?.status).toBe('created');
    expect(fs.existsSync(path.join(project, 'src/shared/vsxf/define.ts'))).toBe(true);
    fs.rmSync(path.dirname(project), { recursive: true, force: true });
  });
});
