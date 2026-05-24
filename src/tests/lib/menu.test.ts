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
