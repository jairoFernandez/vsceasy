import { describe, test, expect } from 'bun:test';

import { cli } from '../../cli';

describe('CLI', () => {
  test('basic metadata', () => {
    expect(cli.getName()).toBe('@ideascol/vscode-extension-framework');
    expect(cli.getOptions()?.version).toBe('0.1.0');
  });

  test('create command registered', () => {
    const create = cli.getCommands().find((c) => c.name === 'create');
    expect(create).toBeDefined();
    const nameParam = create!.params.find((p) => p.name === 'name');
    expect(nameParam?.required).toBe(true);
  });

  test('addPanel command registered with required name', () => {
    const cmd = cli.getCommands().find((c) => c.name === 'addPanel');
    expect(cmd).toBeDefined();
    const nameParam = cmd!.params.find((p) => p.name === 'name');
    expect(nameParam?.required).toBe(true);
  });

  test('addMenu command registered with required name + searchable icon list', () => {
    const cmd = cli.getCommands().find((c) => c.name === 'addMenu');
    expect(cmd).toBeDefined();
    const nameParam = cmd!.params.find((p) => p.name === 'name');
    expect(nameParam?.required).toBe(true);
    const iconParam = cmd!.params.find((p) => p.name === 'icon');
    expect(iconParam).toBeDefined();
    expect(typeof (iconParam as any)?.optionsLoader).toBe('function');
  });

  test('editMenu command uses cli-maker standard UI (required + conditional params)', () => {
    const cmd = cli.getCommands().find((c) => c.name === 'editMenu');
    expect(cmd).toBeDefined();
    const nameParam = cmd!.params.find((p) => p.name === 'name');
    expect(nameParam?.required).toBe(true);
    const kindParam = cmd!.params.find((p) => p.name === 'kind');
    expect(kindParam?.options).toEqual(['panel', 'command', 'url', 'group']);
    const urlParam = cmd!.params.find((p) => p.name === 'url');
    expect(typeof (urlParam as any)?.when).toBe('function');
    expect((urlParam as any).when({ kind: 'url' })).toBe(true);
    expect((urlParam as any).when({ kind: 'panel' })).toBe(false);
    const iconParam = cmd!.params.find((p) => p.name === 'icon');
    expect((iconParam as any).when({ kind: 'group' })).toBe(false);
    expect((iconParam as any).when({ kind: 'panel' })).toBe(true);
  });
});
