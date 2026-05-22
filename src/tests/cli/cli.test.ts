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

  test('addMenu command registered (name optional, prompted interactively)', () => {
    const cmd = cli.getCommands().find((c) => c.name === 'addMenu');
    expect(cmd).toBeDefined();
    const nameParam = cmd!.params.find((p) => p.name === 'name');
    expect(nameParam?.required).toBeFalsy();
    expect(cmd!.params.find((p) => p.name === 'icon')).toBeDefined();
  });

  test('editMenu command registered with optional name', () => {
    const cmd = cli.getCommands().find((c) => c.name === 'editMenu');
    expect(cmd).toBeDefined();
    const nameParam = cmd!.params.find((p) => p.name === 'name');
    expect(nameParam?.required).toBeFalsy();
    const kindParam = cmd!.params.find((p) => p.name === 'kind');
    expect(kindParam?.options).toEqual(['panel', 'command', 'url', 'group']);
  });
});
