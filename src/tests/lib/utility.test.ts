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
