import { describe, test, expect } from 'bun:test';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const templatesRoot = path.resolve(__dirname, '../../../templates');
const cacheSrc = fs.readFileSync(
  path.join(templatesRoot, '_generators', 'helper', 'cache.ts.tpl'),
  'utf8',
);

async function loadCache() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'vsceasy-cache-'));
  const file = path.join(tmp, 'cache.ts');
  fs.writeFileSync(file, cacheSrc);
  const mod = await import(file);
  return { mod, cleanup: () => fs.rmSync(tmp, { recursive: true, force: true }) };
}

describe('cache runtime', () => {
  test('get/set/has/delete/size', async () => {
    const { mod, cleanup } = await loadCache();
    const c = mod.createCache({ ttlMs: 0 });
    c.set('a', 1);
    c.set('b', 2);
    expect(c.get('a')).toBe(1);
    expect(c.has('b')).toBe(true);
    expect(c.size).toBe(2);
    expect(c.delete('a')).toBe(true);
    expect(c.has('a')).toBe(false);
    cleanup();
  });

  test('expires by ttl', async () => {
    const { mod, cleanup } = await loadCache();
    const c = mod.createCache({ ttlMs: 10 });
    c.set('k', 'v');
    expect(c.get('k')).toBe('v');
    await new Promise((r) => setTimeout(r, 25));
    expect(c.get('k')).toBeUndefined();
    cleanup();
  });

  test('LRU evicts oldest beyond max', async () => {
    const { mod, cleanup } = await loadCache();
    const c = mod.createCache({ ttlMs: 0, max: 3 });
    c.set('a', 1); c.set('b', 2); c.set('c', 3);
    c.get('a');             // touch — make 'a' MRU
    c.set('d', 4);          // evicts oldest = 'b'
    expect(c.has('a')).toBe(true);
    expect(c.has('b')).toBe(false);
    expect(c.has('c')).toBe(true);
    expect(c.has('d')).toBe(true);
    cleanup();
  });

  test('wrap caches loader result and de-dupes concurrent calls', async () => {
    const { mod, cleanup } = await loadCache();
    const c = mod.createCache({ ttlMs: 0 });
    let calls = 0;
    const load = async () => { calls++; await new Promise((r) => setTimeout(r, 5)); return 42; };

    const [a, b, d] = await Promise.all([
      c.wrap('k', load), c.wrap('k', load), c.wrap('k', load),
    ]);
    expect([a, b, d]).toEqual([42, 42, 42]);
    expect(calls).toBe(1);

    expect(await c.wrap('k', load)).toBe(42);
    expect(calls).toBe(1);

    cleanup();
  });

  test('refresh invalidates then re-loads', async () => {
    const { mod, cleanup } = await loadCache();
    const c = mod.createCache({ ttlMs: 0 });
    let v = 1;
    const load = async () => v;
    expect(await c.wrap('k', load)).toBe(1);
    v = 2;
    expect(await c.wrap('k', load)).toBe(1);    // cached
    expect(await c.refresh('k', load)).toBe(2);  // forced
    cleanup();
  });
});
