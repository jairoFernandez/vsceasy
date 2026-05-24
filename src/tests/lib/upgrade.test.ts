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
