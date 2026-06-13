/**
 * Tests for the component library generator and panel `--template` UIs.
 */
import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { scaffold } from '../../lib/scaffold';
import { addComponents, componentsExist } from '../../lib/components/add';
import { addPanel } from '../../lib/panel/add';

const templatesRoot = path.resolve(__dirname, '../../../templates');

let tmp: string;
beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'vsceasy-comp-'));
});
afterEach(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
});

async function scaffoldProject(): Promise<string> {
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

describe('addComponents', () => {
  test('writes the full component library + barrel + css', async () => {
    const project = await scaffoldProject();
    expect(componentsExist(project)).toBe(false);

    const result = addComponents({ projectRoot: project, templatesRoot });
    const dir = path.join(project, 'src/webview/components');
    for (const f of ['Button.tsx', 'Input.tsx', 'Field.tsx', 'Card.tsx', 'List.tsx', 'index.ts', 'components.css']) {
      expect(fs.existsSync(path.join(dir, f))).toBe(true);
    }
    expect(result.created.length).toBe(7);
    expect(componentsExist(project)).toBe(true);

    const barrel = fs.readFileSync(path.join(dir, 'index.ts'), 'utf8');
    expect(barrel).toMatch(/export \{ Button \}/);
    const css = fs.readFileSync(path.join(dir, 'components.css'), 'utf8');
    expect(css).toMatch(/var\(--vscode-button-background\)/);
  });

  test('is idempotent — second run skips, --force overwrites', async () => {
    const project = await scaffoldProject();
    addComponents({ projectRoot: project, templatesRoot });

    const again = addComponents({ projectRoot: project, templatesRoot });
    expect(again.created).toEqual([]);
    expect(again.skipped.length).toBe(7);

    const file = path.join(project, 'src/webview/components/Button.tsx');
    fs.writeFileSync(file, '// edited\n');
    const forced = addComponents({ projectRoot: project, templatesRoot, force: true });
    expect(forced.created.length).toBe(7);
    expect(fs.readFileSync(file, 'utf8')).not.toBe('// edited\n');
  });
});

describe('addPanel --template', () => {
  test('blank template keeps the empty starter App and empty API', async () => {
    const project = await scaffoldProject();
    addPanel({ name: 'plain', template: 'blank', projectRoot: project, templatesRoot, runGen: false });
    const app = fs.readFileSync(path.join(project, 'src/webview/panels/plain/App.tsx'), 'utf8');
    expect(app).toContain('to start building');
    expect(componentsExist(project)).toBe(false); // blank doesn't pull components
    const api = fs.readFileSync(path.join(project, 'src/shared/api.ts'), 'utf8');
    expect(api).toMatch(/export interface PlainApi \{\}/);
  });

  test('form template generates components, a working form, and a save() RPC method', async () => {
    const project = await scaffoldProject();
    const result = addPanel({ name: 'signup', template: 'form', projectRoot: project, templatesRoot, runGen: false });

    expect(componentsExist(project)).toBe(true); // auto-pulled
    const app = fs.readFileSync(path.join(project, 'src/webview/panels/signup/App.tsx'), 'utf8');
    expect(app).toContain("from '../../components'");
    expect(app).toContain('await api.save({ name, email });');
    // no unsubstituted template placeholders (the `{{name}}` form, not JSX `style={{…}}`)
    expect(app).not.toMatch(/\{\{\s*\w+\s*\}\}/);

    const api = fs.readFileSync(path.join(project, 'src/shared/api.ts'), 'utf8');
    expect(api).toMatch(/save\(input: \{ name: string; email: string \}\): Promise<void>/);

    // components counted in created
    expect(result.created.some((p) => p.endsWith('components/Button.tsx'))).toBe(true);
  });

  test('list + dashboard templates wire their own RPC methods', async () => {
    const project = await scaffoldProject();
    addPanel({ name: 'items', template: 'list', projectRoot: project, templatesRoot, runGen: false });
    addPanel({ name: 'metrics', template: 'dashboard', projectRoot: project, templatesRoot, runGen: false });

    const api = fs.readFileSync(path.join(project, 'src/shared/api.ts'), 'utf8');
    expect(api).toMatch(/list\(\): Promise<\{ id: string; label: string \}\[\]>/);
    expect(api).toMatch(/stats\(\): Promise<\{ total: number; active: number; updatedAt: string \}>/);

    const listApp = fs.readFileSync(path.join(project, 'src/webview/panels/items/App.tsx'), 'utf8');
    expect(listApp).toContain('setRows(await api.list());');
    const dashApp = fs.readFileSync(path.join(project, 'src/webview/panels/metrics/App.tsx'), 'utf8');
    expect(dashApp).toContain('setStats(await api.stats());');

    // components generated once, reused by the second template (not duplicated as created twice in one call)
    expect(componentsExist(project)).toBe(true);
  });

  test('non-blank template forces withApi on even when withApi:false is passed', async () => {
    const project = await scaffoldProject();
    addPanel({ name: 'forced', template: 'form', withApi: false, projectRoot: project, templatesRoot, runGen: false });
    const api = fs.readFileSync(path.join(project, 'src/shared/api.ts'), 'utf8');
    expect(api).toMatch(/export interface ForcedApi \{/);
    expect(api).toMatch(/save\(/);
  });

  test('unknown template throws', async () => {
    const project = await scaffoldProject();
    expect(() =>
      addPanel({ name: 'x', template: 'bogus' as any, projectRoot: project, templatesRoot, runGen: false }),
    ).toThrow(/Unknown panel template/);
  });
});
