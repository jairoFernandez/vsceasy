import { describe, test, expect } from 'bun:test';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { scaffold } from '../../lib/scaffold';

describe('scaffold', () => {
  test('creates a project with substituted placeholders', async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'vsxf-test-'));
    const target = path.join(tmp, 'demo');
    const templatesRoot = path.resolve(__dirname, '../../../templates');

    await scaffold({
      name: '@acme/demo',
      displayName: 'Acme Demo',
      description: 'A demo',
      publisher: 'acme',
      ui: 'react',
      targetDir: target,
      templatesRoot,
    });

    const pkg = JSON.parse(fs.readFileSync(path.join(target, 'package.json'), 'utf8'));
    expect(pkg.name).toBe('@acme/demo');
    expect(pkg.displayName).toBe('Acme Demo');
    expect(pkg.publisher).toBe('acme');
    expect(pkg.contributes.commands[0].command).toBe('demo.hello');

    const ext = fs.readFileSync(path.join(target, 'src/extension/extension.ts'), 'utf8');
    expect(ext).toContain("'demo.hello'");
    expect(ext).not.toContain('{{');

    fs.rmSync(tmp, { recursive: true, force: true });
  });

  test('refuses non-empty target dir', async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'vsxf-test-'));
    fs.writeFileSync(path.join(tmp, 'existing.txt'), 'hi');
    const templatesRoot = path.resolve(__dirname, '../../../templates');
    await expect(
      scaffold({
        name: 'x',
        displayName: 'X',
        description: 'x',
        publisher: 'x',
        ui: 'react',
        targetDir: tmp,
        templatesRoot,
      }),
    ).rejects.toThrow(/not empty/);
    fs.rmSync(tmp, { recursive: true, force: true });
  });
});
