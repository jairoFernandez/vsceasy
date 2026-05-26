import { describe, test, expect } from 'bun:test';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { scaffold } from '../../lib/scaffold';
import { publishInit } from '../../lib/publish/init';

const templatesRoot = path.resolve(__dirname, '../../../templates');

async function scaffoldProject(publisher = 'acme'): Promise<string> {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'vsceasy-publish-'));
  const target = path.join(tmp, 'demo');
  await scaffold({
    name: 'demo',
    displayName: 'Demo',
    description: 'demo extension',
    publisher,
    ui: 'react',
    targetDir: target,
    templatesRoot,
  });
  return target;
}

describe('publishInit', () => {
  test('writes README/CHANGELOG, populates package.json fields', async () => {
    const project = await scaffoldProject();
    // delete README to force regeneration
    fs.rmSync(path.join(project, 'README.md'), { force: true });
    const result = publishInit({
      projectRoot: project,
      templatesRoot,
      runDryPack: false,
    });

    expect(result.created.find((p) => p.endsWith('README.md'))).toBeTruthy();
    expect(result.created.find((p) => p.endsWith('CHANGELOG.md'))).toBeTruthy();
    const pkg = JSON.parse(fs.readFileSync(path.join(project, 'package.json'), 'utf8'));
    expect(pkg.categories).toEqual(['Other']);
    expect(pkg.repository).toBeDefined();

    fs.rmSync(path.dirname(project), { recursive: true, force: true });
  });

  test('warns about placeholder publisher', async () => {
    const project = await scaffoldProject('your-publisher');
    const result = publishInit({
      projectRoot: project,
      templatesRoot,
      runDryPack: false,
    });
    expect(result.warnings.some((w) => /publisher/i.test(w))).toBe(true);
    fs.rmSync(path.dirname(project), { recursive: true, force: true });
  });

  test('warns about missing icon', async () => {
    const project = await scaffoldProject();
    const result = publishInit({
      projectRoot: project,
      templatesRoot,
      runDryPack: false,
    });
    expect(result.warnings.some((w) => /icon/i.test(w))).toBe(true);
    fs.rmSync(path.dirname(project), { recursive: true, force: true });
  });
});
