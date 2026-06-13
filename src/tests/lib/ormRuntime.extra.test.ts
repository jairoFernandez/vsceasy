/**
 * Extended runtime tests for the generated `orm` helper — covers the surface the
 * baseline `ormRuntime.test.ts` leaves untested: findOne, deleteMany, clear/drop,
 * pagination, default-order, missing-id semantics, the singleton accessors, the
 * 'global' provider + subdir, corrupt-file recovery, ordering of null/undefined,
 * and transaction isolation / rollback / nesting edge cases.
 *
 * Loads the template directly (vscode import stripped) — same pattern as the
 * baseline file.
 */
import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const templatesRoot = path.resolve(__dirname, '../../../templates');
const ormSrc = fs.readFileSync(
  path.join(templatesRoot, '_generators', 'helper', 'db.ts.tpl'),
  'utf8',
);

// Strip the vscode import so this loads under bun:test. Each load gets a unique
// filename so the singleton module state (`_db`) doesn't leak between tests.
const patched = ormSrc.replace(`import * as vscode from 'vscode';`, '');
let loadSeq = 0;

async function loadOrm(tmp: string) {
  const file = path.join(tmp, `orm_${loadSeq++}.ts`);
  fs.writeFileSync(file, patched);
  return import(file);
}

function fakeCtx(dir: string) {
  return {
    storageUri: { fsPath: dir },
    globalStorageUri: { fsPath: path.join(dir, '__global__') },
    subscriptions: [] as { dispose(): void }[],
  };
}

let tmp: string;
beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'vsceasy-orm-x-'));
});
afterEach(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
});

// ── read-side surface ────────────────────────────────────────────────────────

describe('orm runtime — reads', () => {
  test('findOne returns first match or null', async () => {
    const mod = await loadOrm(tmp);
    const E = mod.defineEntity('e', { primaryKey: 'id' });
    const orm = mod.createDb(fakeCtx(tmp), { provider: 'storage' });

    await orm(E).insert({ id: 1, tag: 'a' });
    await orm(E).insert({ id: 2, tag: 'a' });
    await orm(E).insert({ id: 3, tag: 'b' });

    expect((await orm(E).findOne({ tag: 'a' })).id).toBe(1);
    expect(await orm(E).findOne({ tag: 'zzz' })).toBe(null);
  });

  test('findById returns null for missing id', async () => {
    const mod = await loadOrm(tmp);
    const E = mod.defineEntity('e', { primaryKey: 'id' });
    const orm = mod.createDb(fakeCtx(tmp), { provider: 'storage' });
    expect(await orm(E).findById('nope')).toBe(null);
  });

  test('findMany: offset paginates and default-order is ascending', async () => {
    const mod = await loadOrm(tmp);
    const E = mod.defineEntity('e', { primaryKey: 'id' });
    const orm = mod.createDb(fakeCtx(tmp), { provider: 'storage' });

    for (const n of [3, 1, 4, 1, 5, 9, 2]) {
      await orm(E).insert({ id: `r${loadSeq}-${Math.random()}`, n });
    }
    // orderBy without ':dir' defaults to asc
    const asc = await orm(E).findMany({ orderBy: 'n' });
    expect(asc.map((r: any) => r.n)).toEqual([1, 1, 2, 3, 4, 5, 9]);

    // offset + limit slice the ordered result
    const page = await orm(E).findMany({ orderBy: 'n:asc', offset: 2, limit: 3 });
    expect(page.map((r: any) => r.n)).toEqual([2, 3, 4]);
  });

  test('count() with no opts counts all rows', async () => {
    const mod = await loadOrm(tmp);
    const E = mod.defineEntity('e', { primaryKey: 'id' });
    const orm = mod.createDb(fakeCtx(tmp), { provider: 'storage' });
    await orm(E).insert({ id: 1 });
    await orm(E).insert({ id: 2 });
    expect(await orm(E).count()).toBe(2);
  });

  test('orderBy sorts null/undefined before defined values', async () => {
    const mod = await loadOrm(tmp);
    const E = mod.defineEntity('e', { primaryKey: 'id' });
    const orm = mod.createDb(fakeCtx(tmp), { provider: 'storage' });

    await orm(E).insert({ id: 1, score: 5 });
    await orm(E).insert({ id: 2, score: null });
    await orm(E).insert({ id: 3 }); // score undefined
    await orm(E).insert({ id: 4, score: 1 });

    const asc = await orm(E).findMany({ orderBy: 'score:asc' });
    // nulls/undefined compare as -1 → first; then 1, 5
    expect(asc.slice(-2).map((r: any) => r.score)).toEqual([1, 5]);
  });
});

// ── write-side surface ───────────────────────────────────────────────────────

describe('orm runtime — writes', () => {
  test('update returns null when id absent (no write)', async () => {
    const mod = await loadOrm(tmp);
    const E = mod.defineEntity('e', { primaryKey: 'id' });
    const orm = mod.createDb(fakeCtx(tmp), { provider: 'storage' });
    expect(await orm(E).update('ghost', { x: 1 })).toBe(null);
    expect(await orm(E).count()).toBe(0);
  });

  test('delete returns false when id absent', async () => {
    const mod = await loadOrm(tmp);
    const E = mod.defineEntity('e', { primaryKey: 'id' });
    const orm = mod.createDb(fakeCtx(tmp), { provider: 'storage' });
    await orm(E).insert({ id: 'keep' });
    expect(await orm(E).delete('ghost')).toBe(false);
    expect(await orm(E).count()).toBe(1);
  });

  test('deleteMany removes matching rows and returns removed count', async () => {
    const mod = await loadOrm(tmp);
    const E = mod.defineEntity('e', { primaryKey: 'id' });
    const orm = mod.createDb(fakeCtx(tmp), { provider: 'storage' });

    for (let i = 0; i < 6; i++) await orm(E).insert({ id: i, even: i % 2 === 0 });
    expect(await orm(E).deleteMany({ even: true })).toBe(3);
    expect(await orm(E).count()).toBe(3);
    // no match → 0, no write error
    expect(await orm(E).deleteMany({ even: 'nope' })).toBe(0);
  });

  test('clear empties one entity; drop empties via db.drop', async () => {
    const mod = await loadOrm(tmp);
    const A = mod.defineEntity('a', { primaryKey: 'id' });
    const B = mod.defineEntity('b', { primaryKey: 'id' });
    const orm = mod.createDb(fakeCtx(tmp), { provider: 'storage' });

    await orm(A).insert({ id: 1 });
    await orm(B).insert({ id: 1 });

    await orm(A).clear();
    expect(await orm(A).count()).toBe(0);
    expect(await orm(B).count()).toBe(1); // untouched

    await orm.drop(B);
    expect(await orm(B).count()).toBe(0);
  });

  test('update merges patch over existing row', async () => {
    const mod = await loadOrm(tmp);
    const E = mod.defineEntity('e', { primaryKey: 'id' });
    const orm = mod.createDb(fakeCtx(tmp), { provider: 'storage' });
    await orm(E).insert({ id: 1, a: 1, b: 2 });
    const updated = await orm(E).update(1, { b: 9 });
    expect(updated).toEqual({ id: 1, a: 1, b: 9 });
  });
});

// ── provider options + accessors ─────────────────────────────────────────────

describe('orm runtime — createDb / singleton', () => {
  test("provider: 'global' writes under globalStorageUri", async () => {
    const mod = await loadOrm(tmp);
    const E = mod.defineEntity('g', { primaryKey: 'id' });
    const orm = mod.createDb(fakeCtx(tmp), { provider: 'global' });
    await orm(E).insert({ id: 1 });
    expect(fs.existsSync(path.join(tmp, '__global__', 'db', 'g.json'))).toBe(true);
  });

  test('subdir overrides the default db directory', async () => {
    const mod = await loadOrm(tmp);
    const E = mod.defineEntity('s', { primaryKey: 'id' });
    const orm = mod.createDb(fakeCtx(tmp), { provider: 'storage', subdir: 'custom' });
    await orm(E).insert({ id: 1 });
    expect(fs.existsSync(path.join(tmp, 'custom', 's.json'))).toBe(true);
  });

  test('createDb throws only when no storage URI is available at all', async () => {
    const mod = await loadOrm(tmp);
    const ctx = { storageUri: undefined, globalStorageUri: undefined, subscriptions: [] };
    expect(() => mod.createDb(ctx, { provider: 'storage' })).toThrow(/no storage URI available/);
    expect(() => mod.createDb(ctx, { provider: 'global' })).toThrow(/no storage URI available/);
  });

  test("provider:'storage' falls back to globalStorageUri when no workspace is open", async () => {
    const mod = await loadOrm(tmp);
    // storageUri undefined (no folder open), globalStorageUri present — must not throw.
    const ctx = {
      storageUri: undefined,
      globalStorageUri: { fsPath: path.join(tmp, 'global') },
      subscriptions: [] as { dispose(): void }[],
    };
    const E = mod.defineEntity('fallback', { primaryKey: 'id' });
    const orm = mod.createDb(ctx, { provider: 'storage' });
    await orm(E).insert({ id: 1 });
    // written under the global root, not a workspace root
    expect(fs.existsSync(path.join(tmp, 'global', 'db', 'fallback.json'))).toBe(true);
  });

  test('db() throws before initDb, returns shared instance after, idempotent', async () => {
    const mod = await loadOrm(tmp);
    expect(() => mod.db()).toThrow(/not initialized/);

    const a = mod.initDb(fakeCtx(tmp), { provider: 'storage' });
    const b = mod.initDb(fakeCtx(tmp), { provider: 'storage' });
    expect(a).toBe(b); // idempotent — second call returns first instance
    expect(mod.db()).toBe(a);
  });

  test('provider escape hatch is exposed on the db', async () => {
    const mod = await loadOrm(tmp);
    const E = mod.defineEntity('e', { primaryKey: 'id' });
    const orm = mod.createDb(fakeCtx(tmp), { provider: 'storage' });
    await orm(E).insert({ id: 1 });
    const rows = await orm.provider.load('e');
    expect(rows).toEqual([{ id: 1 }]);
  });
});

// ── persistence resilience ───────────────────────────────────────────────────

describe('orm runtime — storage resilience', () => {
  test('corrupt JSON file loads as empty instead of throwing', async () => {
    const mod = await loadOrm(tmp);
    const E = mod.defineEntity('broken', { primaryKey: 'id' });
    const dbDir = path.join(tmp, 'db');
    fs.mkdirSync(dbDir, { recursive: true });
    fs.writeFileSync(path.join(dbDir, 'broken.json'), '{not valid json');

    const orm = mod.createDb(fakeCtx(tmp), { provider: 'storage' });
    expect(await orm(E).findMany()).toEqual([]);
    // and it recovers — can write over the corruption
    await orm(E).insert({ id: 1 });
    expect(await orm(E).count()).toBe(1);
  });

  test('save leaves no .tmp file behind (atomic rename)', async () => {
    const mod = await loadOrm(tmp);
    const E = mod.defineEntity('e', { primaryKey: 'id' });
    const orm = mod.createDb(fakeCtx(tmp), { provider: 'storage' });
    await orm(E).insert({ id: 1 });
    const files = fs.readdirSync(path.join(tmp, 'db'));
    expect(files).toEqual(['e.json']);
  });
});

// ── transaction semantics ────────────────────────────────────────────────────

describe('orm runtime — transactions', () => {
  test('writes inside a tx are invisible outside until commit', async () => {
    const mod = await loadOrm(tmp);
    const E = mod.defineEntity('e', { primaryKey: 'id' });
    const orm = mod.createDb(fakeCtx(tmp), { provider: 'storage' });
    await orm(E).insert({ id: 1 });

    let midCount = -1;
    await orm.transaction(async (tx: any) => {
      await tx(E).insert({ id: 2 });
      // outer orm still sees only the committed state
      midCount = await orm(E).count();
    });
    expect(midCount).toBe(1);
    expect(await orm(E).count()).toBe(2);
  });

  test('rollback restores multi-entity state with no partial writes', async () => {
    const mod = await loadOrm(tmp);
    const A = mod.defineEntity('a', { primaryKey: 'id' });
    const B = mod.defineEntity('b', { primaryKey: 'id' });
    const orm = mod.createDb(fakeCtx(tmp), { provider: 'storage' });
    await orm(A).insert({ id: 'a0' });

    await expect(
      orm.transaction(async (tx: any) => {
        await tx(A).insert({ id: 'a1' });
        await tx(B).insert({ id: 'b1' });
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');

    expect(await orm(A).count()).toBe(1); // a1 rolled back
    expect((await orm(A).findById('a0')) != null).toBe(true);
    expect(await orm(B).count()).toBe(0); // b1 never committed
  });

  test('update + delete inside a committed tx persist', async () => {
    const mod = await loadOrm(tmp);
    const E = mod.defineEntity('e', { primaryKey: 'id' });
    const orm = mod.createDb(fakeCtx(tmp), { provider: 'storage' });
    await orm(E).insert({ id: 1, v: 'old' });
    await orm(E).insert({ id: 2 });

    await orm.transaction(async (tx: any) => {
      await tx(E).update(1, { v: 'new' });
      await tx(E).delete(2);
    });

    expect((await orm(E).findById(1)).v).toBe('new');
    expect(await orm(E).findById(2)).toBe(null);
  });

  test('nested transaction is rejected', async () => {
    const mod = await loadOrm(tmp);
    const orm = mod.createDb(fakeCtx(tmp), { provider: 'storage' });

    await expect(
      orm.transaction(async (tx: any) => {
        await tx.transaction(async () => {});
      }),
    ).rejects.toThrow(/Nested transactions are not supported/);
  });
});
