/**
 * Reactive stores — a tiny, framework-agnostic observable value.
 *
 * A store holds one value and notifies subscribers when it changes. It's the
 * non-ORM half of the reactivity model: use it for arbitrary state (a counter,
 * a flag, a selection) that a visual element should track.
 *
 *   const counter = defineStore(0);
 *   counter.subscribe((v) => console.log('now', v));
 *   counter.set(1);          // logs: now 1
 *   counter.update((n) => n + 1);
 *
 * Pair it with `watch()` on the host to push changes to a webview, and
 * `listen()` on the webview to react — see those helpers below and in client.ts.
 */
export interface Store<T> {
  /** Read the current value. */
  get(): T;
  /** Replace the value and notify subscribers (no-op if `Object.is`-equal). */
  set(next: T): void;
  /** Derive the next value from the current one, then `set` it. */
  update(fn: (current: T) => T): void;
  /** Subscribe to changes. Returns an unsubscribe function. */
  subscribe(cb: (value: T) => void): () => void;
}

export function defineStore<T>(initial: T): Store<T> {
  let value = initial;
  const subs = new Set<(value: T) => void>();

  return {
    get: () => value,
    set(next) {
      if (Object.is(value, next)) return;
      value = next;
      subs.forEach((cb) => {
        try { cb(value); } catch { /* a bad subscriber must not break a set */ }
      });
    },
    update(fn) {
      this.set(fn(value));
    },
    subscribe(cb) {
      subs.add(cb);
      return () => { subs.delete(cb); };
    },
  };
}

/**
 * Anything that can be watched: it exposes a `subscribe(cb)` returning an
 * unsubscribe function. Stores satisfy this directly. (ORM entities are watched
 * with `watchEntity` from your generated `db.ts`, which has the same shape.)
 */
export interface Watchable {
  subscribe(cb: (...args: any[]) => void): () => void;
}

/**
 * Bridge a watchable source to a side-effect — typically an RPC emit that pushes
 * the change to a subscribed webview. Runs `effect` on every change. Returns an
 * unsubscribe function; register it on the panel's `ctx.subscriptions` (wrapped
 * in `{ dispose }`) so it's cleaned up when the extension deactivates.
 *
 *   // host side, in a panel's rpc():
 *   watch(badgeCount, () => server.emit('badge:changed'));
 *
 * For ORM entities, use `watchEntity(Todos, () => server.emit('todos:changed'))`
 * from your generated db.ts — same idea, same return.
 */
export function watch(source: Watchable, effect: () => void): () => void {
  return source.subscribe(() => effect());
}
