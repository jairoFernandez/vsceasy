/**
 * Deep-merge helper for `contributes.extra.json`.
 *
 * This is the source of truth for the merge algorithm used by the scaffolded
 * project's `scripts/gen.ts`. The template (`templates/react/scripts/gen.ts`)
 * carries an inline copy because it must run standalone with no dependency on
 * this package — keep the two in sync. This module exists so the algorithm is
 * unit-testable in-process (no subprocess).
 */

/** Keys gen.ts owns — never overridden by contributes.extra.json. */
export const GEN_OWNED_KEYS = new Set(['commands', 'keybindings', 'viewsContainers', 'views']);

export function isPlainObject(v: unknown): v is Record<string, any> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

export function deepMerge(base: any, override: any): any {
  if (isPlainObject(base) && isPlainObject(override)) {
    const out: Record<string, any> = { ...base };
    for (const [k, v] of Object.entries(override)) out[k] = deepMerge(base[k], v);
    return out;
  }
  // arrays and primitives: override wins
  return override;
}

/**
 * Merge `extra` into `contributes` in place. gen-owned keys present in `extra`
 * are ignored so gen.ts stays authoritative for them.
 */
export function applyExtraContributes(
  contributes: Record<string, any>,
  extra: Record<string, any> | null | undefined,
): Record<string, any> {
  if (!extra || typeof extra !== 'object') return contributes;
  for (const [key, value] of Object.entries(extra)) {
    if (GEN_OWNED_KEYS.has(key)) continue;
    contributes[key] = deepMerge(contributes[key], value);
  }
  return contributes;
}
