import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Mini-ORM with pluggable providers. Ships with a filesystem JSON provider that
 * writes each entity to a single file under the extension's storage dir. Future
 * providers (sqlite, etc.) implement the same `Provider` interface — entity
 * definitions and call sites don't change.
 *
 * Usage:
 *   const User = defineEntity<{ id: string; name: string }>('users', { primaryKey: 'id' });
 *   const orm = createDb(context, { provider: 'storage' });
 *   await orm(User).insert({ id: 'u1', name: 'Jairo' });
 *   const u = await orm(User).findById('u1');
 */

// ── Entity definition ────────────────────────────────────────────────────────

export interface EntityOptions<T> {
  /** Field used as the unique key. */
  primaryKey: keyof T & string;
  /** Optional indexes — speeds up `findOne({ [k]: v })` for these fields. */
  indexes?: (keyof T & string)[];
}

export interface Entity<T> {
  readonly name: string;
  readonly primaryKey: keyof T & string;
  readonly indexes: (keyof T & string)[];
  /** Phantom type carrier so `orm(E)` infers `T`. Never read. */
  readonly __t?: T;
}

export function defineEntity<T extends object>(
  name: string,
  opts: EntityOptions<T>,
): Entity<T> {
  return { name, primaryKey: opts.primaryKey, indexes: opts.indexes ?? [] };
}

// ── Query types ──────────────────────────────────────────────────────────────

export type Where<T> = Partial<{ [K in keyof T]: T[K] | { in: T[K][] } | { neq: T[K] } }>;

export interface FindOptions<T> {
  where?: Where<T>;
  limit?: number;
  offset?: number;
  /** `'field:asc'` | `'field:desc'`. Default asc when only field given. */
  orderBy?: `${keyof T & string}:${'asc' | 'desc'}` | (keyof T & string);
}

export interface Repository<T> {
  findById(id: T[keyof T]): Promise<T | null>;
  findOne(where: Where<T>): Promise<T | null>;
  findMany(opts?: FindOptions<T>): Promise<T[]>;
  count(opts?: { where?: Where<T> }): Promise<number>;
  insert(row: T): Promise<T>;
  upsert(row: T): Promise<T>;
  update(id: T[keyof T], patch: Partial<T>): Promise<T | null>;
  delete(id: T[keyof T]): Promise<boolean>;
  deleteMany(where: Where<T>): Promise<number>;
  clear(): Promise<void>;
}

// ── Provider interface (future-proof for sqlite/etc.) ────────────────────────

export interface Provider {
  load(entity: string): Promise<Record<string, unknown>[]>;
  save(entity: string, rows: Record<string, unknown>[]): Promise<void>;
  /** Atomic batch. Implementations may optimize. */
  transaction(work: (snapshot: Map<string, Record<string, unknown>[]>) => Promise<void> | void): Promise<void>;
}

// ── Storage provider (filesystem JSON) ───────────────────────────────────────

class StorageProvider implements Provider {
  private cache = new Map<string, Record<string, unknown>[]>();

  constructor(private readonly root: string) {
    fs.mkdirSync(root, { recursive: true });
  }

  private fileFor(entity: string): string {
    return path.join(this.root, `${entity}.json`);
  }

  async load(entity: string): Promise<Record<string, unknown>[]> {
    if (this.cache.has(entity)) return this.cache.get(entity)!;
    const f = this.fileFor(entity);
    if (!fs.existsSync(f)) {
      this.cache.set(entity, []);
      return [];
    }
    try {
      const rows = JSON.parse(fs.readFileSync(f, 'utf8'));
      this.cache.set(entity, rows);
      return rows;
    } catch {
      this.cache.set(entity, []);
      return [];
    }
  }

  async save(entity: string, rows: Record<string, unknown>[]): Promise<void> {
    this.cache.set(entity, rows);
    const f = this.fileFor(entity);
    const tmp = `${f}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(rows));
    fs.renameSync(tmp, f); // atomic on same filesystem
  }

  async transaction(
    work: (snapshot: Map<string, Record<string, unknown>[]>) => Promise<void> | void,
  ): Promise<void> {
    // Snapshot pre-tx state for rollback. Working copy is what `work` mutates.
    const backup = new Map<string, Record<string, unknown>[]>();
    for (const [k, v] of this.cache) backup.set(k, structuredClone(v));
    const working = new Map<string, Record<string, unknown>[]>();
    for (const [k, v] of this.cache) working.set(k, structuredClone(v));
    try {
      await work(working);
      for (const [entity, rows] of working) await this.save(entity, rows);
    } catch (err) {
      // Roll back in-memory cache to the pre-tx snapshot.
      for (const [k, v] of backup) this.cache.set(k, v);
      throw err;
    }
  }
}

// ── Public DB type ───────────────────────────────────────────────────────────

export interface Db {
  <T extends object>(entity: Entity<T>): Repository<T>;
  transaction(work: (tx: Db) => Promise<void> | void): Promise<void>;
  /** Wipe a single entity. */
  drop(entity: Entity<unknown>): Promise<void>;
  /** Underlying provider — escape hatch for advanced use. */
  readonly provider: Provider;
}

export interface CreateDbOptions {
  /** `'storage'` writes under `context.storageUri/<subdir>/`. `'global'` uses `globalStorageUri`. */
  provider: 'storage' | 'global';
  /** Override sub-directory under the chosen storage root. Default: `db`. */
  subdir?: string;
}

export function createDb(ctx: vscode.ExtensionContext, opts: CreateDbOptions): Db {
  const baseUri = opts.provider === 'global' ? ctx.globalStorageUri : ctx.storageUri;
  if (!baseUri) {
    throw new Error('createDb: storage URI unavailable (open a workspace or use provider: "global").');
  }
  const root = path.join(baseUri.fsPath, opts.subdir ?? 'db');
  const provider = new StorageProvider(root);
  ctx.subscriptions.push({ dispose: () => {} }); // future hook
  return makeDb(provider);
}

// ── Singleton accessor — `import { db } from './db'; await db()(Users).insert(...)` ──

let _db: Db | undefined;

/**
 * Default options used by `initDb` when called as a bootstrap hook (one-arg).
 * Override via the 2-arg form: `initDb(context, { provider: 'global' })`.
 */
export const dbOptions: CreateDbOptions = { provider: '{{provider}}' };

/**
 * Initialize the shared db. Call once on activate. Idempotent.
 *
 * As a bootstrap hook (recommended — `bootstrap(registry, { onActivate: [initDb] })`):
 *   initDb(context)
 *
 * Direct call with custom options:
 *   initDb(context, { provider: 'global' })
 */
export function initDb(ctx: vscode.ExtensionContext, opts?: CreateDbOptions): Db {
  if (_db) return _db;
  _db = createDb(ctx, opts ?? dbOptions);
  return _db;
}

/** Access the shared db. Throws if `initDb()` wasn't called yet. */
export function db(): Db {
  if (!_db) throw new Error('db not initialized — call initDb(context) on activate.');
  return _db;
}

function makeDb(provider: Provider): Db {
  const repoFor = <T extends object>(entity: Entity<T>): Repository<T> => {
    const pk = entity.primaryKey;
    const load = () => provider.load(entity.name) as Promise<T[]>;
    const save = (rows: T[]) => provider.save(entity.name, rows as Record<string, unknown>[]);

    return {
      async findById(id) {
        const rows = await load();
        return rows.find((r) => r[pk] === id) ?? null;
      },
      async findOne(where) {
        const rows = await load();
        return rows.find((r) => match(r, where)) ?? null;
      },
      async findMany(opts = {}) {
        let rows = await load();
        if (opts.where) rows = rows.filter((r) => match(r, opts.where!));
        if (opts.orderBy) {
          const [field, dir] = String(opts.orderBy).split(':');
          const sign = dir === 'desc' ? -1 : 1;
          rows = [...rows].sort((a, b) => compare(a[field as keyof T], b[field as keyof T]) * sign);
        }
        if (opts.offset) rows = rows.slice(opts.offset);
        if (opts.limit !== undefined) rows = rows.slice(0, opts.limit);
        return rows;
      },
      async count(opts = {}) {
        const rows = await load();
        return opts.where ? rows.filter((r) => match(r, opts.where!)).length : rows.length;
      },
      async insert(row) {
        const rows = await load();
        if (rows.some((r) => r[pk] === row[pk])) {
          throw new Error(`${entity.name}: duplicate ${pk}=${String(row[pk])}`);
        }
        rows.push(row);
        await save(rows);
        return row;
      },
      async upsert(row) {
        const rows = await load();
        const i = rows.findIndex((r) => r[pk] === row[pk]);
        if (i >= 0) rows[i] = row; else rows.push(row);
        await save(rows);
        return row;
      },
      async update(id, patch) {
        const rows = await load();
        const i = rows.findIndex((r) => r[pk] === id);
        if (i < 0) return null;
        rows[i] = { ...rows[i], ...patch };
        await save(rows);
        return rows[i];
      },
      async delete(id) {
        const rows = await load();
        const before = rows.length;
        const next = rows.filter((r) => r[pk] !== id);
        if (next.length === before) return false;
        await save(next);
        return true;
      },
      async deleteMany(where) {
        const rows = await load();
        const next = rows.filter((r) => !match(r, where));
        const removed = rows.length - next.length;
        if (removed > 0) await save(next);
        return removed;
      },
      async clear() {
        await save([]);
      },
    };
  };

  const db: Db = Object.assign(repoFor as any, {
    provider,
    async drop(entity: Entity<unknown>) {
      await provider.save(entity.name, []);
    },
    async transaction(work: (tx: Db) => Promise<void> | void) {
      await provider.transaction(async (snapshot) => {
        // Build a tx-scoped Db that reads/writes the snapshot map.
        const txProvider: Provider = {
          async load(name) { return snapshot.get(name) ?? []; },
          async save(name, rows) { snapshot.set(name, rows); },
          async transaction() { throw new Error('Nested transactions are not supported'); },
        };
        await work(makeDb(txProvider));
      });
    },
  });

  return db;
}

// ── matcher ──────────────────────────────────────────────────────────────────

function match<T extends object>(row: T, where: Where<T>): boolean {
  for (const key of Object.keys(where) as (keyof T)[]) {
    const expected = where[key] as unknown;
    const actual = row[key];
    if (expected && typeof expected === 'object' && !Array.isArray(expected)) {
      if ('in' in expected) {
        if (!(expected as { in: unknown[] }).in.includes(actual)) return false;
        continue;
      }
      if ('neq' in expected) {
        if (actual === (expected as { neq: unknown }).neq) return false;
        continue;
      }
    }
    if (actual !== expected) return false;
  }
  return true;
}

function compare(a: unknown, b: unknown): number {
  if (a === b) return 0;
  if (a === null || a === undefined) return -1;
  if (b === null || b === undefined) return 1;
  return a < b ? -1 : 1;
}
