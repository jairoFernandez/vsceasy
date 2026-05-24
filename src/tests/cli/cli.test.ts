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

  test('addCommand command registered with required name + title default', () => {
    const cmd = cli.getCommands().find((c) => c.name === 'addCommand');
    expect(cmd).toBeDefined();
    const nameParam = cmd!.params.find((p) => p.name === 'name');
    expect(nameParam?.required).toBe(true);
    const titleParam = cmd!.params.find((p) => p.name === 'title');
    expect(typeof (titleParam as any)?.defaultValue).toBe('function');
    const groupParam = cmd!.params.find((p) => p.name === 'group');
    expect((groupParam as any).when({ menuEntry: '(none)' })).toBe(false);
    expect((groupParam as any).when({ menuEntry: 'main' })).toBe(true);
  });

  test('addRpcMethod command registered with required panel + method', () => {
    const cmd = cli.getCommands().find((c) => c.name === 'addRpcMethod');
    expect(cmd).toBeDefined();
    const panelParam = cmd!.params.find((p) => p.name === 'panel');
    expect(panelParam?.required).toBe(true);
    expect(typeof (panelParam as any)?.optionsLoader).toBe('function');
    const methodParam = cmd!.params.find((p) => p.name === 'method');
    expect(methodParam?.required).toBe(true);
    const returnsParam = cmd!.params.find((p) => p.name === 'returns');
    expect((returnsParam as any)?.defaultValue).toBe('void');
  });

  test('addStatusBar command registered with required name/text/command', () => {
    const cmd = cli.getCommands().find((c) => c.name === 'addStatusBar');
    expect(cmd).toBeDefined();
    const nameParam = cmd!.params.find((p) => p.name === 'name');
    expect(nameParam?.required).toBe(true);
    const textParam = cmd!.params.find((p) => p.name === 'text');
    expect(textParam?.required).toBe(true);
    const bindTo = cmd!.params.find((p) => p.name === 'bindTo');
    expect((bindTo as any)?.options).toEqual(['command', 'panel', 'create new command', 'menu']);
    const menuParam = cmd!.params.find((p) => p.name === 'menu');
    expect((menuParam as any).when({ bindTo: 'menu' })).toBe(true);
    expect(Array.isArray((menuParam as any).itemParams)).toBe(true);
    const cmdParam = cmd!.params.find((p) => p.name === 'command');
    expect((cmdParam as any).when({ bindTo: 'command' })).toBe(true);
    expect((cmdParam as any).when({ bindTo: 'panel' })).toBe(false);
    const panelParam = cmd!.params.find((p) => p.name === 'panel');
    expect((panelParam as any).when({ bindTo: 'panel' })).toBe(true);
    const newTitleParam = cmd!.params.find((p) => p.name === 'newCommandTitle');
    expect((newTitleParam as any).when({ bindTo: 'create new command' })).toBe(true);
  });

  test('doctor command registered with optional fix flag', () => {
    const cmd = cli.getCommands().find((c) => c.name === 'doctor');
    expect(cmd).toBeDefined();
    const fixParam = cmd!.params.find((p) => p.name === 'fix');
    expect(fixParam?.required).toBeFalsy();
  });

  test('upgrade command registered with optional apply flag', () => {
    const cmd = cli.getCommands().find((c) => c.name === 'upgrade');
    expect(cmd).toBeDefined();
    const applyParam = cmd!.params.find((p) => p.name === 'apply');
    expect(applyParam?.required).toBeFalsy();
    const uiParam = cmd!.params.find((p) => p.name === 'ui');
    expect((uiParam as any)?.defaultValue).toBe('react');
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
