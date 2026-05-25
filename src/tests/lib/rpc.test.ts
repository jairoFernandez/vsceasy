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

describe('addRpcMethod', () => {
  const templatesRoot = path.resolve(__dirname, '../../../templates');

  async function scaffoldProject(): Promise<string> {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'vsceasy-addrpc-'));
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
