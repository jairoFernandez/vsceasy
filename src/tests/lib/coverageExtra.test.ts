/**
 * Branch-coverage fill-ins for the framework utilities: findProject (gen:scan
 * match, malformed package.json, findTemplatesRoot) and upgrade (would-create
 * dry-run, missing-source, invalid UI throw, gen-skip when nothing changed).
 */
import { describe, test, expect } from 'bun:test';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { scaffold } from '../../lib/scaffold';
import { findProjectRoot, findTemplatesRoot } from '../../lib/findProject';
import { upgrade } from '../../lib/upgrade';

const templatesRoot = path.resolve(__dirname, '../../../templates');

function mkTmp(prefix: string): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

// ── findProject ──────────────────────────────────────────────────────────────

describe('findProjectRoot — extra branches', () => {
  test('matches a project via the gen:scan script', () => {
    const tmp = mkTmp('vsceasy-scan-');
    const project = path.join(tmp, 'proj');
    fs.mkdirSync(project);
    fs.writeFileSync(
      path.join(project, 'package.json'),
      // no `gen`, but has `gen:scan` — new layout
      JSON.stringify({ name: 'p', scripts: { 'gen:scan': 'bun scripts/scan.ts' } }),
    );
    expect(findProjectRoot(project)).toBe(project);
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  test('skips a malformed package.json and keeps walking up', () => {
    const tmp = mkTmp('vsceasy-bad-');
    // parent is a valid project, child has a broken package.json
    const parent = path.join(tmp, 'parent');
    const child = path.join(parent, 'child');
    fs.mkdirSync(child, { recursive: true });
    fs.writeFileSync(
      path.join(parent, 'package.json'),
      JSON.stringify({ scripts: { gen: 'bun scripts/gen.ts' } }),
    );
    fs.writeFileSync(path.join(child, 'package.json'), '{ broken json');
    // from child: child's pkg throws → ignored → walks to parent
    expect(findProjectRoot(child)).toBe(parent);
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  test('a package.json without the gen script does not match', () => {
    const tmp = mkTmp('vsceasy-nomatch-');
    const project = path.join(tmp, 'proj');
    fs.mkdirSync(project);
    fs.writeFileSync(
      path.join(project, 'package.json'),
      JSON.stringify({ name: 'p', scripts: { build: 'tsc' } }),
    );
    // walks past it to root and throws
    expect(() => findProjectRoot(project)).toThrow(/Not inside a vsceasy project/);
    fs.rmSync(tmp, { recursive: true, force: true });
  });
});

describe('findTemplatesRoot', () => {
  test('finds a non-empty templates/ adjacent to the given file dir', () => {
    const tmp = mkTmp('vsceasy-tpl-');
    const libDir = path.join(tmp, 'dist', 'lib');
    fs.mkdirSync(libDir, { recursive: true });
    // candidate[1]: ../../templates relative to libDir → tmp/templates
    const tpl = path.join(tmp, 'templates');
    fs.mkdirSync(tpl);
    fs.writeFileSync(path.join(tpl, 'x.tpl'), 'hi'); // must hold files to count
    expect(findTemplatesRoot(libDir)).toBe(tpl);
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  test('falls back to embedded templates when no templates/ is near the file', () => {
    const tmp = mkTmp('vsceasy-notpl-');
    const deep = path.join(tmp, 'a', 'b', 'c', 'd');
    fs.mkdirSync(deep, { recursive: true });
    // New contract: instead of throwing, materialize the embedded templates to
    // a temp dir and return it (this is what a globally-installed binary hits).
    const root = findTemplatesRoot(deep);
    expect(fs.existsSync(root)).toBe(true);
    expect(fs.readdirSync(root).length).toBeGreaterThan(0);
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  test('resolves the real bundled templates root from __dirname', () => {
    // src/lib/findProject.ts sits two levels under the repo root that holds templates/
    expect(fs.existsSync(findTemplatesRoot(path.join(templatesRoot, '..', 'src', 'lib')))).toBe(true);
  });
});

// ── upgrade ──────────────────────────────────────────────────────────────────

describe('upgrade — extra branches', () => {
  async function scaffoldProject(): Promise<string> {
    const tmp = mkTmp('vsceasy-up2-');
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

  test('dry-run reports would-create for a missing destination file', async () => {
    const project = await scaffoldProject();
    fs.unlinkSync(path.join(project, 'src/shared/vsceasy/define.ts'));
    const result = upgrade({ projectRoot: project, templatesRoot, apply: false });
    const change = result.changes.find((c) => c.path === 'src/shared/vsceasy/define.ts');
    expect(change?.status).toBe('would-create');
    // dry-run leaves it absent
    expect(fs.existsSync(path.join(project, 'src/shared/vsceasy/define.ts'))).toBe(false);
    fs.rmSync(path.dirname(project), { recursive: true, force: true });
  });

  test('reports missing-source when a sync path is absent in templates', async () => {
    const project = await scaffoldProject();
    // Point at a stripped templates dir missing one synced file.
    const tplTmp = mkTmp('vsceasy-tplcopy-');
    const ui = path.join(tplTmp, 'react');
    fs.cpSync(path.join(templatesRoot, 'react'), ui, { recursive: true });
    fs.unlinkSync(path.join(ui, 'src/shared/vsceasy/define.ts'));

    const result = upgrade({ projectRoot: project, templatesRoot: tplTmp, apply: false });
    const change = result.changes.find((c) => c.path === 'src/shared/vsceasy/define.ts');
    expect(change?.status).toBe('missing-source');

    fs.rmSync(tplTmp, { recursive: true, force: true });
    fs.rmSync(path.dirname(project), { recursive: true, force: true });
  });

  test('throws when the templates UI variant does not exist', async () => {
    const project = await scaffoldProject();
    expect(() =>
      upgrade({ projectRoot: project, templatesRoot, ui: 'does-not-exist', apply: false }),
    ).toThrow(/Templates UI not found/);
    fs.rmSync(path.dirname(project), { recursive: true, force: true });
  });

  test('apply with no drift does not run gen', async () => {
    const project = await scaffoldProject();
    // greenfield → everything in-sync → gen must be skipped even with apply
    const result = upgrade({ projectRoot: project, templatesRoot, apply: true });
    expect(result.applied).toBe(true);
    expect(result.genRan).toBe(false);
    expect(result.changes.every((c) => c.status === 'in-sync')).toBe(true);
    fs.rmSync(path.dirname(project), { recursive: true, force: true });
  });
});
