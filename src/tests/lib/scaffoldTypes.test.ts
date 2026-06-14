import { describe, test, expect } from 'bun:test';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { scaffold } from '../../lib/scaffold';
import { runDoctor } from '../../lib/doctor';
import { readConfig } from '../../lib/config';
import { applyExtraContributes, deepMerge } from '../../lib/contributesMerge';

const templatesRoot = path.resolve(__dirname, '../../../templates');

async function scaffoldType(
  type: 'ui' | 'language' | 'empty',
  name = 'demo',
): Promise<string> {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), `vsceasy-${type}-`));
  const target = path.join(tmp, 'demo');
  await scaffold({
    name,
    displayName: 'Demo Lang',
    description: 'demo',
    publisher: 'acme',
    ui: 'react',
    type,
    targetDir: target,
    templatesRoot,
  });
  return target;
}

function readPkg(root: string): any {
  return JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
}

function cleanup(project: string) {
  fs.rmSync(path.dirname(project), { recursive: true, force: true });
}

describe('scaffold --type language', () => {
  test('materializes language assets and wires contributes.extra.json', async () => {
    const project = await scaffoldType('language', '@x/mylang');
    try {
      // assets exist (filenames {{langId}}-substituted)
      for (const rel of [
        'syntaxes/mylang.tmLanguage.json',
        'language-configuration.json',
        'snippets/mylang.json',
        'fileicons/mylang-icon-theme.json',
        'icons/mylang.svg',
        'contributes.extra.json',
      ]) {
        expect(fs.existsSync(path.join(project, rel))).toBe(true);
      }

      // no React/webview
      expect(fs.existsSync(path.join(project, 'src/panels'))).toBe(false);
      expect(fs.existsSync(path.join(project, 'src/webview'))).toBe(false);
      expect(fs.existsSync(path.join(project, 'vite.config.ts'))).toBe(false);

      const pkg = readPkg(project);
      expect(pkg.dependencies?.react).toBeUndefined();
      expect(pkg.devDependencies?.vite).toBeUndefined();
      expect(typeof pkg.scripts.gen).toBe('string');
      expect(typeof pkg.scripts.launch).toBe('string');
      expect(pkg.scripts['build:ui']).toBeUndefined();

      // grammar carries the derived scope name; extra wiring references the assets
      const grammar = fs.readFileSync(path.join(project, 'syntaxes/mylang.tmLanguage.json'), 'utf8');
      expect(grammar).toContain('source.mylang');
      const extra = JSON.parse(fs.readFileSync(path.join(project, 'contributes.extra.json'), 'utf8'));
      expect(extra.languages[0].id).toBe('mylang');
      expect(extra.grammars[0].scopeName).toBe('source.mylang');

      // persisted type
      expect(readConfig(project).type).toBe('language');
    } finally {
      cleanup(project);
    }
  });

  test('doctor reports language assets present', async () => {
    const project = await scaffoldType('language', '@x/mylang');
    try {
      // doctor's language check reads contributes.extra.json directly — no gen needed
      const report = runDoctor({ projectRoot: project });
      const lang = report.results.find((r) => r.id === 'language');
      expect(lang?.level).toBe('ok');
      expect(lang?.message).toContain('asset(s) present');
    } finally {
      cleanup(project);
    }
  });
});

describe('scaffold --type empty', () => {
  test('produces a bare extension with no React or panels', async () => {
    const project = await scaffoldType('empty');
    try {
      expect(fs.existsSync(path.join(project, 'src/panels'))).toBe(false);
      expect(fs.existsSync(path.join(project, 'src/webview'))).toBe(false);
      expect(fs.existsSync(path.join(project, 'src/extension/extension.ts'))).toBe(true);
      const pkg = readPkg(project);
      expect(pkg.dependencies?.react).toBeUndefined();
      expect(pkg.devDependencies?.['@vitejs/plugin-react']).toBeUndefined();
      expect(readConfig(project).type).toBe('empty');
      // 'ui' framework key omitted for non-ui types
      expect(readConfig(project).ui).toBeUndefined();
    } finally {
      cleanup(project);
    }
  });
});

describe('scaffold --type ui (regression)', () => {
  test('still scaffolds the React webview sample', async () => {
    const project = await scaffoldType('ui');
    try {
      expect(fs.existsSync(path.join(project, 'src/panels/dashboard.ts'))).toBe(true);
      expect(fs.existsSync(path.join(project, 'vite.config.ts'))).toBe(true);
      const pkg = readPkg(project);
      expect(pkg.dependencies?.react).toBeDefined();
      const cfg = readConfig(project);
      expect(cfg.type).toBe('ui');
      expect(cfg.ui).toBe('react');
    } finally {
      cleanup(project);
    }
  });
});

// The merge algorithm used by the scaffolded scripts/gen.ts is tested here
// in-process via its source-of-truth lib. (The template carries an inline copy;
// see templates/react/scripts/gen.ts — keep in sync.)
describe('contributes.extra.json merge', () => {
  test('merges non-owned keys and ignores gen-owned keys', () => {
    const contributes: Record<string, any> = {
      commands: [{ command: 'ext.real', title: 'Real' }],
    };
    applyExtraContributes(contributes, {
      languages: [{ id: 'demo', extensions: ['.demo'] }],
      grammars: [{ language: 'demo', scopeName: 'source.demo' }],
      // gen-owned — must be ignored
      commands: [{ command: 'should.be.ignored', title: 'nope' }],
    });
    expect(contributes.languages[0].id).toBe('demo');
    expect(contributes.grammars[0].scopeName).toBe('source.demo');
    // gen-owned commands untouched
    expect(contributes.commands).toEqual([{ command: 'ext.real', title: 'Real' }]);
  });

  test('deepMerge recurses objects, replaces arrays/primitives', () => {
    expect(deepMerge({ a: { x: 1 }, b: 2 }, { a: { y: 3 }, b: 9 })).toEqual({
      a: { x: 1, y: 3 },
      b: 9,
    });
    expect(deepMerge([1, 2], [3])).toEqual([3]);
    expect(deepMerge(undefined, { k: 1 })).toEqual({ k: 1 });
  });

  test('no-op when extra is absent', () => {
    const c = { commands: [] };
    expect(applyExtraContributes(c, null)).toBe(c);
    expect(applyExtraContributes(c, undefined)).toBe(c);
  });
});
