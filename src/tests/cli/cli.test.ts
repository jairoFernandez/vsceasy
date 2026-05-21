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
});
