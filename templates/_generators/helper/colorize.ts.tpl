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

/**
 * Merge `rules` into `editor.tokenColorCustomizations.textMateRules`, preserving
 * the user's own rules. Idempotent — re-applying replaces only the rules this
 * extension previously wrote.
 *
 * IMPORTANT: rules go at the ROOT `textMateRules`, NOT under a `[<scope>]` key.
 * `editor.tokenColorCustomizations` only supports `[ThemeName]` keys, not
 * `[language]` (see microsoft/vscode#66729). Language targeting comes from the
 * language suffix baked into each rule's TextMate scope (e.g. `…​.toml`), so the
 * rules only affect files of that language even at the root.
 *
 * The `scope` argument is kept for API symmetry / future use and to identify the
 * rule set; it is not used as a settings key.
 */
export async function applyTokenColors(
  scope: string,
  rules: TokenColorRule[],
  target: vscode.ConfigurationTarget = vscode.ConfigurationTarget.Global,
): Promise<void> {
  const cfg = vscode.workspace.getConfiguration();
  const current = (cfg.get<Record<string, any>>(SECTION) ?? {}) as Record<string, any>;
  const existing = Array.isArray(current.textMateRules) ? (current.textMateRules as TaggedRule[]) : [];
  const userRules = existing.filter((r) => !r[MARK]);
  const ours: TaggedRule[] = rules.map((r) => ({ ...r, [MARK]: true }));
  const next = { ...current, textMateRules: [...userRules, ...ours] };
  await cfg.update(SECTION, next, target);
}

/** Remove only the rules this extension added; leave the user's settings intact. */
export async function removeTokenColors(
  scope: string,
  target: vscode.ConfigurationTarget = vscode.ConfigurationTarget.Global,
): Promise<void> {
  const cfg = vscode.workspace.getConfiguration();
  const current = cfg.get<Record<string, any>>(SECTION);
  if (!current || !Array.isArray(current.textMateRules)) return;
  const userRules = (current.textMateRules as TaggedRule[]).filter((r) => !r[MARK]);

  const next: Record<string, unknown> = { ...current };
  if (userRules.length) next.textMateRules = userRules;
  else delete next.textMateRules;

  await cfg.update(SECTION, Object.keys(next).length ? next : undefined, target);
}
