/**
 * Runtime test for the generated `orm` helper. Loads the template file directly
 * (no vscode dep — the helper only types `vscode.ExtensionContext`), patches it
 * to skip the vscode import, and exercises CRUD + transactions end-to-end.
 */
import { describe, test, expect } from 'bun:test';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const templatesRoot = path.resolve(__dirname, '../../../templates');
const ormSrc = fs.readFileSync(
  path.join(templatesRoot, '_generators', 'helper', 'db.ts.tpl'),
  'utf8',
);

// Strip vscode import so this loads under bun:test
const patched = ormSrc.replace(`import * as vscode from 'vscode';`, '');

async function loadOrm(tmp: string) {
  const file = path.join(tmp, 'orm.ts');
  fs.writeFileSync(file, patched);
  return import(file);
}

function fakeCtx(dir: string) {
  return {
    storageUri: { fsPath: dir },
    globalStorageUri: { fsPath: dir },
    subscriptions: [] as { dispose(): void }[],
  };
}

describe('orm runtime', () => {
  test('CRUD: insert / findById / update / delete', async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'vsceasy-orm-'));
    const mod = await loadOrm(tmp);
    const User = mod.defineEntity('users', { primaryKey: 'id' });
    const orm = mod.createDb(fakeCtx(tmp), { provider: 'storage' });

    await orm(User).insert({ id: 'u1', name: 'Jairo', email: 'j@x.io' });
    expect(await orm(User).findById('u1')).toEqual({ id: 'u1', name: 'Jairo', email: 'j@x.io' });

    await orm(User).update('u1', { name: 'JF' });
    expect((await orm(User).findById('u1')).name).toBe('JF');

    expect(await orm(User).delete('u1')).toBe(true);
    expect(await orm(User).findById('u1')).toBe(null);

    fs.rmSync(tmp, { recursive: true, force: true });
  });

  test('findMany supports where + orderBy + limit', async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'vsceasy-orm-'));
    const mod = await loadOrm(tmp);
    const Post = mod.defineEntity('posts', { primaryKey: 'id' });
    const orm = mod.createDb(fakeCtx(tmp), { provider: 'storage' });

    for (let i = 0; i < 5; i++) {
      await orm(Post).insert({ id: `p${i}`, score: i, tag: i % 2 === 0 ? 'a' : 'b' });
    }
    const top2 = await orm(Post).findMany({ where: { tag: 'a' }, orderBy: 'score:desc', limit: 2 });
    expect(top2.map((p: any) => p.id)).toEqual(['p4', 'p2']);

    expect(await orm(Post).count({ where: { tag: 'b' } })).toBe(2);

    fs.rmSync(tmp, { recursive: true, force: true });
  });

  test('where supports { in } and { neq } operators', async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'vsceasy-orm-'));
    const mod = await loadOrm(tmp);
    const E = mod.defineEntity('e', { primaryKey: 'id' });
    const orm = mod.createDb(fakeCtx(tmp), { provider: 'storage' });

    await orm(E).insert({ id: 1, kind: 'a' });
    await orm(E).insert({ id: 2, kind: 'b' });
    await orm(E).insert({ id: 3, kind: 'c' });

    const inAB = await orm(E).findMany({ where: { kind: { in: ['a', 'b'] } } });
    expect(inAB.map((r: any) => r.id).sort()).toEqual([1, 2]);

    const notB = await orm(E).findMany({ where: { kind: { neq: 'b' } } });
    expect(notB.map((r: any) => r.id).sort()).toEqual([1, 3]);

    fs.rmSync(tmp, { recursive: true, force: true });
  });

  test('insert rejects duplicate primary key', async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'vsceasy-orm-'));
    const mod = await loadOrm(tmp);
    const E = mod.defineEntity('dup', { primaryKey: 'id' });
    const orm = mod.createDb(fakeCtx(tmp), { provider: 'storage' });

    await orm(E).insert({ id: 'x' });
    await expect(orm(E).insert({ id: 'x' })).rejects.toThrow(/duplicate id=x/);

    fs.rmSync(tmp, { recursive: true, force: true });
  });

  test('upsert inserts when absent, updates when present', async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'vsceasy-orm-'));
    const mod = await loadOrm(tmp);
    const E = mod.defineEntity('u', { primaryKey: 'id' });
    const orm = mod.createDb(fakeCtx(tmp), { provider: 'storage' });

    await orm(E).upsert({ id: 'a', v: 1 });
    await orm(E).upsert({ id: 'a', v: 2 });
    expect((await orm(E).findById('a')).v).toBe(2);
    expect(await orm(E).count()).toBe(1);

    fs.rmSync(tmp, { recursive: true, force: true });
  });

  test('transaction commits on success, rolls back on throw', async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'vsceasy-orm-'));
    const mod = await loadOrm(tmp);
    const E = mod.defineEntity('tx', { primaryKey: 'id' });
    const orm = mod.createDb(fakeCtx(tmp), { provider: 'storage' });

    await orm.transaction(async (tx: any) => {
      await tx(E).insert({ id: 1 });
      await tx(E).insert({ id: 2 });
    });
    expect(await orm(E).count()).toBe(2);

    await expect(
      orm.transaction(async (tx: any) => {
        await tx(E).insert({ id: 3 });
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');
    expect(await orm(E).count()).toBe(2);

    fs.rmSync(tmp, { recursive: true, force: true });
  });

  test('persists across createDb re-init (filesystem)', async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'vsceasy-orm-'));
    const mod = await loadOrm(tmp);
    const E = mod.defineEntity('persist', { primaryKey: 'id' });

    const orm1 = mod.createDb(fakeCtx(tmp), { provider: 'storage' });
    await orm1(E).insert({ id: 'k', v: 'value' });

    const orm2 = mod.createDb(fakeCtx(tmp), { provider: 'storage' });
    expect((await orm2(E).findById('k')).v).toBe('value');

    fs.rmSync(tmp, { recursive: true, force: true });
  });

  test('watchEntity fires on every mutation, not on reads', async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'vsceasy-orm-'));
    const mod = await loadOrm(tmp);
    const Todo = mod.defineEntity('todos', { primaryKey: 'id' });
    const orm = mod.createDb(fakeCtx(tmp), { provider: 'storage' });

    const hits: string[] = [];
    const off = mod.watchEntity(Todo, (name: string) => hits.push(name));

    await orm(Todo).insert({ id: 't1', title: 'a', done: false });
    await orm(Todo).upsert({ id: 't1', title: 'a2', done: false });
    await orm(Todo).update('t1', { done: true });
    await orm(Todo).findById('t1');           // read — must NOT fire
    await orm(Todo).findMany();                // read — must NOT fire
    await orm(Todo).delete('t1');
    await orm(Todo).delete('nope');            // no-op delete — must NOT fire

    expect(hits).toEqual(['todos', 'todos', 'todos', 'todos']);

    // Unsubscribe stops further notifications.
    off();
    await orm(Todo).insert({ id: 't2', title: 'b', done: false });
    expect(hits.length).toBe(4);

    fs.rmSync(tmp, { recursive: true, force: true });
  });
});
