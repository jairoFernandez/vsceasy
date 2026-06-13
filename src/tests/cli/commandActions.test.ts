/**
 * End-to-end tests for the command `action` handlers (the thin CLI layer that
 * wires args → lib → console). Runs each action against a real scaffolded
 * project (chdir'd in), asserting filesystem side-effects, error handling, and
 * exit codes. `child_process.spawnSync` is mocked so `runGen` never spawns a
 * real `bun`/`npm` subprocess — it returns a non-zero status, so `genRan` is
 * deterministically false without touching the host.
 */
import { describe, test, expect, beforeEach, afterEach, spyOn } from 'bun:test';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as childProcess from 'child_process';

import { scaffold } from '../../lib/scaffold';

import createCommand from '../../commands/create';
import addPanelCommand from '../../commands/panel/add';
import addHelperCommand from '../../commands/helper/add';
import addCrudCommand from '../../commands/crud/add';
import addStoreCommand from '../../commands/store/add';
import { initDb } from '../../lib/db/init';
import { addModel } from '../../lib/model/add';

const templatesRoot = path.resolve(__dirname, '../../../templates');

// Never spawn a real gen subprocess. Non-zero status → which()/runGen() report
// failure → genRan stays false.
spyOn(childProcess, 'spawnSync').mockImplementation(
  () => ({ status: 1, signal: null, output: [], pid: 0, stdout: '', stderr: '' }) as any,
);

let tmpRoot: string;
let prevCwd: string;
let logs: string[];
let errs: string[];
let logSpy: ReturnType<typeof spyOn>;
let errSpy: ReturnType<typeof spyOn>;

beforeEach(() => {
  tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'vsceasy-cmd-'));
  prevCwd = process.cwd();
  logs = [];
  errs = [];
  logSpy = spyOn(console, 'log').mockImplementation((...a: unknown[]) => void logs.push(a.join(' ')));
  errSpy = spyOn(console, 'error').mockImplementation((...a: unknown[]) => void errs.push(a.join(' ')));
  process.exitCode = 0;
});

afterEach(() => {
  process.chdir(prevCwd);
  logSpy.mockRestore();
  errSpy.mockRestore();
  fs.rmSync(tmpRoot, { recursive: true, force: true });
  process.exitCode = 0;
});

async function scaffoldInto(dir: string): Promise<string> {
  const target = path.join(dir, 'demo');
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

// ── create ───────────────────────────────────────────────────────────────────

describe('create command action', () => {
  test('scaffolds a project into ./<name> relative to cwd', async () => {
    process.chdir(tmpRoot);
    await createCommand.action({ name: 'my-ext', ui: 'react', preset: 'minimal' });
    const root = path.join(tmpRoot, 'my-ext');
    expect(fs.existsSync(path.join(root, 'package.json'))).toBe(true);
    const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
    expect(pkg.name).toBe('my-ext');
    expect(logs.join('\n')).toContain('Created my-ext');
  });

  test('honors the --dir override and derives displayName from a scoped name', async () => {
    process.chdir(tmpRoot);
    await createCommand.action({ name: '@acme/cool-tool', dir: 'out', preset: 'minimal' });
    const root = path.join(tmpRoot, 'out');
    const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
    expect(pkg.name).toBe('@acme/cool-tool');
    // simpleName 'cool-tool' → title-cased displayName
    expect(pkg.displayName).toBe('Cool Tool');
  });

  test('--git and --install flags attempt git init and dependency install', async () => {
    process.chdir(tmpRoot);
    const spawn = childProcess.spawnSync as unknown as ReturnType<typeof spyOn>;
    spawn.mockClear();
    await createCommand.action({ name: 'flagged', preset: 'minimal', git: true, install: true });
    // spawnSync is globally mocked to status 1, so which() reports the tool
    // missing — but the flags must still drive the lookups. which() spawns
    // `which <cmd>`, so the looked-up tool is in args[1].
    const probed = spawn.mock.calls
      .filter((c: any[]) => c[0] === 'which' || c[0] === 'where')
      .map((c: any[]) => c[1]?.[0]);
    expect(probed).toContain('git');
    expect(probed.some((c: string) => c === 'bun' || c === 'npm')).toBe(true);
  });

  test('--git=false and --install=false skip both steps without spawning', async () => {
    process.chdir(tmpRoot);
    const spawn = childProcess.spawnSync as unknown as ReturnType<typeof spyOn>;
    spawn.mockClear();
    await createCommand.action({ name: 'noflags', preset: 'minimal', git: false, install: false });
    expect(spawn.mock.calls.length).toBe(0);
  });
});

// ── crud add ──────────────────────────────────────────────────────────────────

async function scaffoldWithModel(dir: string): Promise<string> {
  const project = await scaffoldInto(dir);
  initDb({ projectRoot: project, templatesRoot });
  addModel({
    name: 'Todo',
    fields: [
      { name: 'id', type: 'string', primaryKey: true },
      { name: 'title', type: 'string' },
      { name: 'done', type: 'boolean' },
    ],
    projectRoot: project,
    templatesRoot,
  });
  return project;
}

describe('crud add command action — menu flag parsing', () => {
  // Regression: raw policy flags (--menu none | new:<id> | existing:<id>) were
  // mis-mapped to `existing:<literal>`, so `--menu none` looked for src/menus/none.ts.
  test('--menu none scaffolds CRUD without a menu (no "menus/none.ts" error)', async () => {
    const project = await scaffoldWithModel(tmpRoot);
    process.chdir(project);
    await addCrudCommand.action({ model: 'Todo', menu: 'none' });
    expect(errs.join('\n')).not.toContain('Menu not found');
    expect(fs.existsSync(path.join(project, 'src/panels/todosList.ts'))).toBe(true);
    expect(fs.existsSync(path.join(project, 'src/menus/none.ts'))).toBe(false);
  });

  test('--menu new:<id> creates the named menu', async () => {
    const project = await scaffoldWithModel(tmpRoot);
    process.chdir(project);
    await addCrudCommand.action({ model: 'Todo', menu: 'new:todos' });
    expect(errs.join('\n')).not.toContain('Menu not found');
    expect(fs.existsSync(path.join(project, 'src/menus/todos.ts'))).toBe(true);
  });
});

// ── helper add ───────────────────────────────────────────────────────────────

describe('store add command action', () => {
  test('generates a typed reactive store under src/stores/', async () => {
    const project = await scaffoldInto(tmpRoot);
    process.chdir(project);
    await addStoreCommand.action({ name: 'badgeCount', type: 'number', initial: '0' });
    const file = path.join(project, 'src/stores/badgeCount.ts');
    expect(fs.existsSync(file)).toBe(true);
    const src = fs.readFileSync(file, 'utf8');
    expect(src).toMatch(/defineStore<number>\(0\)/);
    expect(src).toMatch(/export const badgeCount/);
    expect(logs.join('\n')).toContain('Store "badgeCount" created');
  });

  test('defaults type and initial value (string → empty string)', async () => {
    const project = await scaffoldInto(tmpRoot);
    process.chdir(project);
    await addStoreCommand.action({ name: 'query', type: 'string' });
    const src = fs.readFileSync(path.join(project, 'src/stores/query.ts'), 'utf8');
    expect(src).toMatch(/defineStore<string>\(''\)/);
  });
});

describe('helper add command action', () => {
  test('generates a helper file into the project', async () => {
    const project = await scaffoldInto(tmpRoot);
    process.chdir(project);
    await addHelperCommand.action({ kind: 'config' });
    expect(fs.existsSync(path.join(project, 'src/helpers/config.ts'))).toBe(true);
    expect(logs.join('\n')).toContain('Helper "config" ready');
  });

  test('skips an existing helper unless --force is passed', async () => {
    const project = await scaffoldInto(tmpRoot);
    process.chdir(project);

    await addHelperCommand.action({ kind: 'state' });
    const file = path.join(project, 'src/helpers/state.ts');
    fs.writeFileSync(file, '// hand-edited\n');

    logs = [];
    await addHelperCommand.action({ kind: 'state' });
    expect(logs.join('\n')).toContain('already exists');
    expect(fs.readFileSync(file, 'utf8')).toBe('// hand-edited\n'); // untouched

    logs = [];
    await addHelperCommand.action({ kind: 'state', force: true });
    expect(fs.readFileSync(file, 'utf8')).not.toBe('// hand-edited\n'); // overwritten
  });

  test('unknown kind sets a non-zero exit code and logs the error', async () => {
    const project = await scaffoldInto(tmpRoot);
    process.chdir(project);
    await addHelperCommand.action({ kind: 'bogus' });
    expect(process.exitCode).toBe(1);
    expect(errs.join('\n')).toMatch(/Unknown helper kind/);
  });
});

// ── panel add ────────────────────────────────────────────────────────────────

describe('panel add command action', () => {
  test('creates a panel and reports gen not run (no deps in tmp project)', async () => {
    const project = await scaffoldInto(tmpRoot);
    process.chdir(project);
    await addPanelCommand.action({ name: 'settings', title: 'Settings', withApi: 'no' });

    expect(fs.existsSync(path.join(project, 'src/panels/settings.ts'))).toBe(true);
    const out = logs.join('\n');
    expect(out).toContain('Panel "settings" added');
    // spawnSync mocked to fail → genRan false → fallback hint shown
    expect(out).toContain('Run `bun run gen`');
  });

  test('errors when run outside a vsceasy project', async () => {
    // cwd is a bare temp dir with no package.json above it
    const bare = fs.mkdtempSync(path.join(os.tmpdir(), 'vsceasy-bare-'));
    process.chdir(bare);
    await addPanelCommand.action({ name: 'x' });
    expect(process.exitCode).toBe(1);
    expect(errs.join('\n')).toMatch(/Not inside a vsceasy project/);
    process.chdir(prevCwd);
    fs.rmSync(bare, { recursive: true, force: true });
  });
});
