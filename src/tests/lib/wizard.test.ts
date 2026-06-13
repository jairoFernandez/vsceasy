/**
 * Tests for the interactive wizard. The `interactive` module (select/askText/
 * confirm) is mocked with a scripted answer queue so the decision logic and
 * generator delegation run without a TTY. Asserts filesystem side-effects against
 * a real scaffolded project.
 */
import { describe, test, expect, beforeEach, afterEach, mock, spyOn } from 'bun:test';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as childProcess from 'child_process';

import { scaffold } from '../../lib/scaffold';

const templatesRoot = path.resolve(__dirname, '../../../templates');

// Never spawn a real gen subprocess from generators that call runGen.
spyOn(childProcess, 'spawnSync').mockImplementation(
  () => ({ status: 1, signal: null, output: [], pid: 0, stdout: '', stderr: '' }) as any,
);

// ── scripted interactive layer ───────────────────────────────────────────────
// Each entry answers the next select()/askText()/confirm() call, in order.
let answers: unknown[];
function next<T>(): T {
  if (answers.length === 0) throw new Error('wizard asked for more input than scripted');
  return answers.shift() as T;
}

mock.module('../../lib/interactive', () => ({
  style: { DIM: '', BOLD: '', CYAN: '', GREEN: '', YELLOW: '', INV: '', RST: '' },
  select: async () => next(),
  askText: async (_q: string, def?: string) => {
    const v = next<string>();
    return v === '' && def !== undefined ? def : v;
  },
  confirm: async () => next<boolean>(),
}));

// Import AFTER the mock is registered.
const { runWizard } = await import('../../lib/wizard/run');

let logs: string[];
let logSpy: ReturnType<typeof spyOn>;
let tmp: string;

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'vsceasy-wiz-'));
  logs = [];
  logSpy = spyOn(console, 'log').mockImplementation((...a: unknown[]) => void logs.push(a.join(' ')));
  answers = [];
});
afterEach(() => {
  logSpy.mockRestore();
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

describe('wizard — outside a project', () => {
  test('declining create exits cleanly without scaffolding', async () => {
    answers = [false]; // confirm("create here?") → no
    await runWizard({ templatesRoot, cwd: tmp });
    expect(fs.readdirSync(tmp)).toEqual([]);
    expect(logs.join('\n')).toContain('Nothing to do');
  });

  test('accepting create scaffolds a project from prompted answers', async () => {
    answers = [
      true, // confirm create
      'my-ext', // name
      '', // displayName → default
      '', // publisher → default
      'minimal', // preset select
    ];
    await runWizard({ templatesRoot, cwd: tmp });
    const root = path.join(tmp, 'my-ext');
    expect(fs.existsSync(path.join(root, 'package.json'))).toBe(true);
    const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
    expect(pkg.name).toBe('my-ext');
    expect(pkg.displayName).toBe('My Ext'); // title-cased default
  });
});

describe('wizard — inside a project', () => {
  test('adds a blank panel via the panel branch', async () => {
    const project = await scaffoldProject();
    answers = [
      'panel', // top menu select
      'settings', // panel id
      '', // title → default
      'blank', // template select
      true, // withApi confirm (only asked for blank)
    ];
    await runWizard({ templatesRoot, cwd: project });
    expect(fs.existsSync(path.join(project, 'src/panels/settings.ts'))).toBe(true);
    expect(logs.join('\n')).toContain('Panel ready');
  });

  test('adds a form-template panel that pulls in components and a save RPC', async () => {
    const project = await scaffoldProject();
    answers = [
      'panel', // menu
      'signup', // id
      '', // title → default
      'form', // template — non-blank, so withApi is NOT asked
    ];
    await runWizard({ templatesRoot, cwd: project });
    const app = fs.readFileSync(path.join(project, 'src/webview/panels/signup/App.tsx'), 'utf8');
    expect(app).toContain('await api.save({ name, email });');
    expect(fs.existsSync(path.join(project, 'src/webview/components/index.ts'))).toBe(true);
  });

  test('components branch generates the library', async () => {
    const project = await scaffoldProject();
    answers = ['components'];
    await runWizard({ templatesRoot, cwd: project });
    expect(fs.existsSync(path.join(project, 'src/webview/components/Button.tsx'))).toBe(true);
    expect(logs.join('\n')).toContain('Components ready');
  });

  test('initializes the database then a model in two runs', async () => {
    const project = await scaffoldProject();

    answers = ['db', 'storage']; // menu → db, then provider select
    await runWizard({ templatesRoot, cwd: project });
    expect(fs.existsSync(path.join(project, 'src/helpers/db.ts'))).toBe(true);

    answers = ['model', 'user', 'id:string!,name:string,email?:string@'];
    logs = [];
    await runWizard({ templatesRoot, cwd: project });
    expect(fs.existsSync(path.join(project, 'src/models/user.ts'))).toBe(true);
    expect(logs.join('\n')).toContain('primaryKey: id');
  });

  test('model branch refuses when no database is initialized', async () => {
    const project = await scaffoldProject();
    answers = ['model']; // menu → model; bails before asking for name
    await runWizard({ templatesRoot, cwd: project });
    expect(logs.join('\n')).toContain('No database yet');
    expect(fs.existsSync(path.join(project, 'src/models'))).toBe(false);
  });

  test('helper branch creates a helper and reports it', async () => {
    const project = await scaffoldProject();
    answers = ['helper', 'config']; // menu → helper, kind select
    await runWizard({ templatesRoot, cwd: project });
    expect(fs.existsSync(path.join(project, 'src/helpers/config.ts'))).toBe(true);
    expect(logs.join('\n')).toContain('Helper ready');
  });

  test('"something else" lists the remaining commands', async () => {
    const project = await scaffoldProject();
    answers = ['more'];
    await runWizard({ templatesRoot, cwd: project });
    const out = logs.join('\n');
    expect(out).toContain('vsceasy crud add');
    expect(out).toContain('vsceasy doctor');
  });
});
