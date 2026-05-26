import { describe, test, expect } from 'bun:test';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { scaffold } from '../../lib/scaffold';
import { addJob } from '../../lib/job/add';

const templatesRoot = path.resolve(__dirname, '../../../templates');

async function scaffoldProject(): Promise<string> {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'vsceasy-job-'));
  const target = path.join(tmp, 'demo');
  await scaffold({
    name: 'demo',
    displayName: 'Demo',
    description: 'd',
    publisher: 'me',
    ui: 'react',
    targetDir: target,
    templatesRoot,
  });
  return target;
}

describe('addJob', () => {
  test('creates job with every interval', async () => {
    const project = await scaffoldProject();
    const result = addJob({
      name: 'sync',
      trigger: { every: '60s' },
      projectRoot: project,
      templatesRoot,
      runGen: false,
    });
    const file = path.join(project, 'src/jobs/sync.ts');
    expect(result.created).toContain(file);
    const body = fs.readFileSync(file, 'utf8');
    expect(body).toMatch(/defineJob/);
    expect(body).toMatch(/schedule: \{ every: '60s' \}/);
    fs.rmSync(path.dirname(project), { recursive: true, force: true });
  });

  test('creates job with dailyAt', async () => {
    const project = await scaffoldProject();
    addJob({
      name: 'nightly',
      trigger: { dailyAt: '02:30' },
      projectRoot: project,
      templatesRoot,
      runGen: false,
    });
    const body = fs.readFileSync(path.join(project, 'src/jobs/nightly.ts'), 'utf8');
    expect(body).toMatch(/dailyAt: '02:30'/);
    fs.rmSync(path.dirname(project), { recursive: true, force: true });
  });

  test('creates job with on event', async () => {
    const project = await scaffoldProject();
    addJob({
      name: 'onSave',
      trigger: { on: 'saveDocument' },
      projectRoot: project,
      templatesRoot,
      runGen: false,
    });
    const body = fs.readFileSync(path.join(project, 'src/jobs/onSave.ts'), 'utf8');
    expect(body).toMatch(/on: 'saveDocument'/);
    fs.rmSync(path.dirname(project), { recursive: true, force: true });
  });

  test('creates job with onFile watcher', async () => {
    const project = await scaffoldProject();
    addJob({
      name: 'watchMd',
      trigger: { onFile: '**/*.md' },
      projectRoot: project,
      templatesRoot,
      runGen: false,
    });
    const body = fs.readFileSync(path.join(project, 'src/jobs/watchMd.ts'), 'utf8');
    expect(body).toMatch(/onFile: '\*\*\/\*\.md'/);
    fs.rmSync(path.dirname(project), { recursive: true, force: true });
  });

  test('writes minIntervalMs when provided', async () => {
    const project = await scaffoldProject();
    addJob({
      name: 'throttled',
      trigger: { every: '5m' },
      minIntervalMs: 3_600_000,
      projectRoot: project,
      templatesRoot,
      runGen: false,
    });
    const body = fs.readFileSync(path.join(project, 'src/jobs/throttled.ts'), 'utf8');
    expect(body).toMatch(/minIntervalMs: 3600000/);
    fs.rmSync(path.dirname(project), { recursive: true, force: true });
  });

  test('rejects duplicate', async () => {
    const project = await scaffoldProject();
    addJob({ name: 'dup', trigger: { every: '30s' }, projectRoot: project, templatesRoot, runGen: false });
    expect(() =>
      addJob({ name: 'dup', trigger: { every: '30s' }, projectRoot: project, templatesRoot, runGen: false }),
    ).toThrow(/already exists/i);
    fs.rmSync(path.dirname(project), { recursive: true, force: true });
  });

  test('rejects invalid name', async () => {
    const project = await scaffoldProject();
    expect(() =>
      addJob({ name: '---', trigger: { every: '30s' }, projectRoot: project, templatesRoot, runGen: false }),
    ).toThrow(/job name is required|Invalid job name/);
    fs.rmSync(path.dirname(project), { recursive: true, force: true });
  });
});
