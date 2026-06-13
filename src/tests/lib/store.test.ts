/**
 * Runtime test for the reactive `store` helper. Loads the runtime source directly
 * (no vscode dependency) and exercises get/set/update/subscribe + watch().
 */
import { describe, test, expect } from 'bun:test';
import * as path from 'path';

const storePath = path.resolve(__dirname, '../../../packages/vsceasy-runtime/src/store.ts');

async function loadStore() {
  return import(storePath);
}

describe('defineStore', () => {
  test('get returns the initial value', async () => {
    const { defineStore } = await loadStore();
    const s = defineStore(42);
    expect(s.get()).toBe(42);
  });

  test('set updates the value and notifies subscribers', async () => {
    const { defineStore } = await loadStore();
    const s = defineStore(0);
    const seen: number[] = [];
    s.subscribe((v: number) => seen.push(v));
    s.set(1);
    s.set(2);
    expect(s.get()).toBe(2);
    expect(seen).toEqual([1, 2]);
  });

  test('set is a no-op when the value is Object.is-equal', async () => {
    const { defineStore } = await loadStore();
    const s = defineStore(5);
    let calls = 0;
    s.subscribe(() => calls++);
    s.set(5);            // same value → no notify
    s.set(6);
    expect(calls).toBe(1);
  });

  test('update derives the next value from the current one', async () => {
    const { defineStore } = await loadStore();
    const s = defineStore(10);
    s.update((n: number) => n + 5);
    expect(s.get()).toBe(15);
  });

  test('subscribe returns an unsubscribe function', async () => {
    const { defineStore } = await loadStore();
    const s = defineStore(0);
    const seen: number[] = [];
    const off = s.subscribe((v: number) => seen.push(v));
    s.set(1);
    off();
    s.set(2);
    expect(seen).toEqual([1]);
  });

  test('a throwing subscriber does not break set for others', async () => {
    const { defineStore } = await loadStore();
    const s = defineStore(0);
    let good = 0;
    s.subscribe(() => { throw new Error('bad'); });
    s.subscribe(() => { good++; });
    s.set(1);
    expect(good).toBe(1);
  });
});

describe('watch', () => {
  test('runs the effect on every change and returns unsubscribe', async () => {
    const { defineStore, watch } = await loadStore();
    const s = defineStore(0);
    let runs = 0;
    const off = watch(s, () => { runs++; });
    s.set(1);
    s.set(2);
    expect(runs).toBe(2);
    off();
    s.set(3);
    expect(runs).toBe(2);
  });
});
