import { describe, test, expect } from 'bun:test';
import type { Command } from '@ideascol/cli-maker';

import { cli } from '../../cli';

function findGroup(name: string): Command | undefined {
  return cli.getCommands().find((c) => c.name === name);
}

function findSub(group: string, sub: string): Command | undefined {
  return findGroup(group)?.subcommands?.find((c) => c.name === sub);
}

describe('CLI', () => {
  test('basic metadata', () => {
    expect(cli.getName()).toBe('@ideascol/vscode-extension-framework');
    expect(cli.getOptions()?.version).toBe('0.1.0');
  });

  test('top-level commands registered', () => {
    const top = cli.getCommands().map((c) => c.name).sort();
    for (const expected of ['create', 'panel', 'menu', 'command', 'rpc', 'statusBar', 'doctor', 'upgrade']) {
      expect(top).toContain(expected);
    }
  });

  test('create command has required name', () => {
    const create = findGroup('create');
    expect(create).toBeDefined();
    const nameParam = create!.params.find((p) => p.name === 'name');
    expect(nameParam?.required).toBe(true);
  });

  test('panel group has add subcommand', () => {
    const add = findSub('panel', 'add');
    expect(add).toBeDefined();
    expect(add!.params.find((p) => p.name === 'name')?.required).toBe(true);
  });

  test('menu group has add + edit subcommands', () => {
    const subs = findGroup('menu')?.subcommands?.map((s) => s.name).sort();
    expect(subs).toEqual(['add', 'edit']);

    const add = findSub('menu', 'add');
    expect(add!.params.find((p) => p.name === 'name')?.required).toBe(true);
    expect(typeof (add!.params.find((p) => p.name === 'icon') as any)?.optionsLoader).toBe('function');

    const edit = findSub('menu', 'edit');
    const kindParam = edit!.params.find((p) => p.name === 'kind');
    expect(kindParam?.options).toEqual(['panel', 'command', 'url', 'group']);
    const urlParam = edit!.params.find((p) => p.name === 'url');
    expect((urlParam as any).when({ kind: 'url' })).toBe(true);
    expect((urlParam as any).when({ kind: 'panel' })).toBe(false);
  });

  test('command group has add subcommand with title default + conditional group', () => {
    const add = findSub('command', 'add');
    expect(add).toBeDefined();
    expect(typeof (add!.params.find((p) => p.name === 'title') as any)?.defaultValue).toBe('function');
    const groupParam = add!.params.find((p) => p.name === 'group');
    expect((groupParam as any).when({ menuEntry: '(none)' })).toBe(false);
    expect((groupParam as any).when({ menuEntry: 'main' })).toBe(true);
  });

  test('rpc group has add subcommand with required panel + method', () => {
    const add = findSub('rpc', 'add');
    expect(add).toBeDefined();
    const panelParam = add!.params.find((p) => p.name === 'panel');
    expect(panelParam?.required).toBe(true);
    expect(typeof (panelParam as any)?.optionsLoader).toBe('function');
    expect((add!.params.find((p) => p.name === 'returns') as any)?.defaultValue).toBe('void');
  });

  test('statusBar group has add subcommand with menu loop', () => {
    const add = findSub('statusBar', 'add');
    expect(add).toBeDefined();
    const bindTo = add!.params.find((p) => p.name === 'bindTo');
    expect((bindTo as any)?.options).toEqual(['command', 'panel', 'create new command', 'menu']);
    const menuParam = add!.params.find((p) => p.name === 'menu');
    expect((menuParam as any).when({ bindTo: 'menu' })).toBe(true);
    expect(Array.isArray((menuParam as any).itemParams)).toBe(true);
  });

  test('doctor has optional fix flag', () => {
    const cmd = findGroup('doctor');
    expect(cmd).toBeDefined();
    expect(cmd!.params.find((p) => p.name === 'fix')?.required).toBeFalsy();
  });

  test('upgrade has optional apply flag + ui default', () => {
    const cmd = findGroup('upgrade');
    expect(cmd).toBeDefined();
    expect((cmd!.params.find((p) => p.name === 'ui') as any)?.defaultValue).toBe('react');
  });
});
