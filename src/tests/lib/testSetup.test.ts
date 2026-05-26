import { describe, test, expect } from 'bun:test';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { scaffold } from '../../lib/scaffold';
import { setupTests } from '../../lib/testSetup';

const templatesRoot = path.resolve(__dirname, '../../../templates');

async function scaffoldProject(): Promise<string> {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'vsceasy-testsetup-'));
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

describe('setupTests', () => {
  test('writes vitest config, sample test, and updates package.json', async () => {
    const project = await scaffoldProject();
    const result = setupTests({ projectRoot: project, templatesRoot });

    const vitest = path.join(project, 'vitest.config.ts');
    const sample = path.join(project, 'src', '__tests__', 'sample.test.ts');
    expect(result.created).toContain(vitest);
    expect(result.created).toContain(sample);
    expect(fs.existsSync(vitest)).toBe(true);
    expect(fs.existsSync(sample)).toBe(true);
    expect(result.pkgUpdated).toBe(true);

    const pkg = JSON.parse(fs.readFileSync(path.join(project, 'package.json'), 'utf8'));
    expect(pkg.scripts.test).toBe('vitest run');
    expect(pkg.scripts['test:watch']).toBe('vitest');
    expect(pkg.devDependencies.vitest).toBeTruthy();

    fs.rmSync(path.dirname(project), { recursive: true, force: true });
  });

  test('idempotent without --force', async () => {
    const project = await scaffoldProject();
    setupTests({ projectRoot: project, templatesRoot });
    const second = setupTests({ projectRoot: project, templatesRoot });
    expect(second.created).toEqual([]);
    fs.rmSync(path.dirname(project), { recursive: true, force: true });
  });

  test('--force overwrites', async () => {
    const project = await scaffoldProject();
    setupTests({ projectRoot: project, templatesRoot });
    const sample = path.join(project, 'src', '__tests__', 'sample.test.ts');
    fs.writeFileSync(sample, '// my edits\n');
    setupTests({ projectRoot: project, templatesRoot, force: true });
    expect(fs.readFileSync(sample, 'utf8')).not.toBe('// my edits\n');
    fs.rmSync(path.dirname(project), { recursive: true, force: true });
  });
});
