import { describe, test, expect } from 'bun:test';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { scaffold } from '../../lib/scaffold';
import { addHelper } from '../../lib/helper/add';

const templatesRoot = path.resolve(__dirname, '../../../templates');

async function scaffoldProject(): Promise<string> {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'vsceasy-helper-'));
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

describe('addHelper', () => {
  test.each(['secrets', 'config', 'state', 'notifications', 'cache'] as const)(
    'creates helper %s',
    async (kind) => {
      const project = await scaffoldProject();
      const result = addHelper({ kind, projectRoot: project, templatesRoot });
      const file = path.join(project, 'src', 'helpers', `${kind}.ts`);
      expect(result.created).toContain(file);
      expect(fs.existsSync(file)).toBe(true);
      fs.rmSync(path.dirname(project), { recursive: true, force: true });
    },
  );

  test('cache template exposes createCache with TTL + LRU', async () => {
    const project = await scaffoldProject();
    addHelper({ kind: 'cache', projectRoot: project, templatesRoot });
    const body = fs.readFileSync(path.join(project, 'src/helpers/cache.ts'), 'utf8');
    expect(body).toMatch(/export function createCache/);
    expect(body).toMatch(/wrap\(key/);
    expect(body).toMatch(/ttlMs/);
    fs.rmSync(path.dirname(project), { recursive: true, force: true });
  });

  test('config helper substitutes commandPrefix from config', async () => {
    const project = await scaffoldProject();
    addHelper({ kind: 'config', projectRoot: project, templatesRoot });
    const body = fs.readFileSync(path.join(project, 'src/helpers/config.ts'), 'utf8');
    expect(body).toMatch(/getConfiguration\('demo'\)/);
    fs.rmSync(path.dirname(project), { recursive: true, force: true });
  });

  test('skips existing helper without --force', async () => {
    const project = await scaffoldProject();
    addHelper({ kind: 'secrets', projectRoot: project, templatesRoot });
    const second = addHelper({ kind: 'secrets', projectRoot: project, templatesRoot });
    expect(second.created).toEqual([]);
    expect(second.skipped.length).toBe(1);
    fs.rmSync(path.dirname(project), { recursive: true, force: true });
  });

  test('rejects unknown kind', async () => {
    const project = await scaffoldProject();
    expect(() =>
      addHelper({ kind: 'foo' as any, projectRoot: project, templatesRoot }),
    ).toThrow(/Unknown helper kind/);
    fs.rmSync(path.dirname(project), { recursive: true, force: true });
  });
});
