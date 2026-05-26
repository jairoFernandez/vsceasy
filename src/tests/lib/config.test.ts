import { describe, test, expect } from 'bun:test';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { readConfig, writeConfig, configPath } from '../../lib/config';
import { scaffold } from '../../lib/scaffold';
import { addCommand } from '../../lib/command/add';
import { addMenu } from '../../lib/menu/add';

function tmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'vsceasy-config-'));
}

describe('config', () => {
  test('returns empty when no file present', () => {
    const dir = tmpDir();
    expect(readConfig(dir)).toEqual({});
    expect(configPath(dir)).toBeNull();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  test('writeConfig + readConfig round-trip (ts)', () => {
    const dir = tmpDir();
    writeConfig(dir, { publisher: 'me', commandPrefix: 'myExt', ui: 'react' });
    expect(configPath(dir)).toBe(path.join(dir, 'vsceasy.config.ts'));
    const cfg = readConfig(dir);
    expect(cfg.publisher).toBe('me');
    expect(cfg.commandPrefix).toBe('myExt');
    expect(cfg.ui).toBe('react');
    fs.rmSync(dir, { recursive: true, force: true });
  });

  test('reads vsceasy.config.json', () => {
    const dir = tmpDir();
    fs.writeFileSync(
      path.join(dir, 'vsceasy.config.json'),
      JSON.stringify({ publisher: 'json-pub', commandPrefix: 'jp' }),
    );
    const cfg = readConfig(dir);
    expect(cfg.publisher).toBe('json-pub');
    expect(cfg.commandPrefix).toBe('jp');
    fs.rmSync(dir, { recursive: true, force: true });
  });

  test('scaffold writes vsceasy.config.ts with publisher + commandPrefix', async () => {
    const tmp = tmpDir();
    const target = path.join(tmp, 'demo');
    const templatesRoot = path.resolve(__dirname, '../../../templates');
    await scaffold({
      name: 'demo-ext',
      displayName: 'Demo',
      description: 'demo',
      publisher: 'me',
      ui: 'react',
      targetDir: target,
      templatesRoot,
    });
    const cfg = readConfig(target);
    expect(cfg.publisher).toBe('me');
    expect(cfg.commandPrefix).toBe('demoext');
    expect(cfg.ui).toBe('react');
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  test('command/add picks up defaultCategory from config', async () => {
    const tmp = tmpDir();
    const target = path.join(tmp, 'demo');
    const templatesRoot = path.resolve(__dirname, '../../../templates');
    await scaffold({
      name: 'demo',
      displayName: 'Demo',
      description: 'd',
      publisher: 'me',
      ui: 'react',
      targetDir: target,
      templatesRoot,
    });
    writeConfig(target, { publisher: 'me', defaultCategory: 'My Cat' });
    addCommand({ name: 'doStuff', projectRoot: target, templatesRoot, runGen: false });
    const src = fs.readFileSync(path.join(target, 'src', 'commands', 'doStuff.ts'), 'utf8');
    expect(src).toMatch(/category: 'My Cat'/);
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  test('menu/add picks up defaultIcon from config', async () => {
    const tmp = tmpDir();
    const target = path.join(tmp, 'demo');
    const templatesRoot = path.resolve(__dirname, '../../../templates');
    await scaffold({
      name: 'demo',
      displayName: 'Demo',
      description: 'd',
      publisher: 'me',
      ui: 'react',
      targetDir: target,
      templatesRoot,
    });
    writeConfig(target, { publisher: 'me', defaultIcon: 'rocket' });
    addMenu({ name: 'sidebar', projectRoot: target, templatesRoot, runGen: false });
    const src = fs.readFileSync(path.join(target, 'src', 'menus', 'sidebar.ts'), 'utf8');
    expect(src).toMatch(/icon: 'rocket'/);
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  test('reads minimal export default object literal in .ts', () => {
    const dir = tmpDir();
    fs.writeFileSync(
      path.join(dir, 'vsceasy.config.ts'),
      `export default {\n  publisher: 'lit',\n  commandPrefix: 'lp',\n};\n`,
    );
    const cfg = readConfig(dir);
    expect(cfg.publisher).toBe('lit');
    expect(cfg.commandPrefix).toBe('lp');
    fs.rmSync(dir, { recursive: true, force: true });
  });
});
