import * as vscode from 'vscode';

/**
 * Apply theme-independent token colors to a single TextMate scope (e.g. a
 * language's root scope like `source.toml`), written to the user's
 * `editor.tokenColorCustomizations`. Because the rules are keyed by
 * `[<scope>]`, only files in that scope are recolored — every other language
 * keeps the active theme's colors.
 *
 * Rules are tagged with a marker so {@link removeTokenColors} can strip exactly
 * the ones this extension added, preserving any the user wrote by hand.
 *
 * Typical use — auto-apply on activate behind an opt-out setting:
 *
 *   // extension.ts (onActivate hook)
 *   if (config.get<boolean>('colorize', true)) {
 *     await applyTokenColors('source.{{commandPrefix}}', MY_RULES);
 *   }
 *   vscode.workspace.onDidChangeConfiguration(async (e) => {
 *     if (!e.affectsConfiguration('{{commandPrefix}}.colorize')) return;
 *     if (config.get<boolean>('colorize', true)) await applyTokenColors('source.{{commandPrefix}}', MY_RULES);
 *     else await removeTokenColors('source.{{commandPrefix}}');
 *   });
 *
 * Declare the opt-out in package.json#contributes.configuration:
 *   "{{commandPrefix}}.colorize": { "type": "boolean", "default": true }
 */

export interface TokenColorRule {
  /** Comma-separated TextMate scopes, e.g. 'entity.name.section.foo, comment.line.foo'. */
  scope: string;
  settings: { foreground?: string; background?: string; fontStyle?: string };
}

type TaggedRule = TokenColorRule & { [MARK]?: true };

/** Marker key identifying rules this extension wrote (vs. the user's own). */
const MARK = '{{commandPrefix}}Colorize';
const SECTION = 'editor.tokenColorCustomizations';

const blockKey = (scope: string) => `[${scope}]`;

/**
 * Merge `rules` into `editor.tokenColorCustomizations["[<scope>]"].textMateRules`,
 * preserving the user's own rules and other scope keys. Idempotent — re-applying
 * replaces only previously-applied rules from this extension.
 */
export async function applyTokenColors(
  scope: string,
  rules: TokenColorRule[],
  target: vscode.ConfigurationTarget = vscode.ConfigurationTarget.Global,
): Promise<void> {
  const cfg = vscode.workspace.getConfiguration();
  const current = (cfg.get<Record<string, any>>(SECTION) ?? {}) as Record<string, any>;
  const key = blockKey(scope);
  const block = (current[key] ?? {}) as { textMateRules?: TaggedRule[] };
  const existing = Array.isArray(block.textMateRules) ? block.textMateRules : [];
  const userRules = existing.filter((r) => !r[MARK]);
  const ours: TaggedRule[] = rules.map((r) => ({ ...r, [MARK]: true }));
  const next = { ...current, [key]: { ...block, textMateRules: [...userRules, ...ours] } };
  await cfg.update(SECTION, next, target);
}

/** Remove only the rules this extension added for `scope`; leave the rest intact. */
export async function removeTokenColors(
  scope: string,
  target: vscode.ConfigurationTarget = vscode.ConfigurationTarget.Global,
): Promise<void> {
  const cfg = vscode.workspace.getConfiguration();
  const current = cfg.get<Record<string, any>>(SECTION);
  const key = blockKey(scope);
  if (!current || !current[key]) return;
  const block = current[key] as { textMateRules?: TaggedRule[] };
  const userRules = (block.textMateRules ?? []).filter((r) => !r[MARK]);

  const nextBlock: Record<string, unknown> = { ...block };
  if (userRules.length) nextBlock.textMateRules = userRules;
  else delete nextBlock.textMateRules;

  const next = { ...current };
  if (Object.keys(nextBlock).length) next[key] = nextBlock;
  else delete next[key];

  await cfg.update(SECTION, Object.keys(next).length ? next : undefined, target);
}
