import type * as vscode from 'vscode';
import { applyTokenColors, removeTokenColors, type TokenColorRule } from './helpers/colorize';

/** Root TextMate scope of this language — rules are applied only to these files. */
export const SCOPE = '{{scopeName}}';

/**
 * Default token colors for {{displayName}}, emphasizing each construct. Edit
 * freely — they are applied to `[{{scopeName}}]` only, so other languages keep
 * the user's theme. Scope names must match your grammar
 * (syntaxes/{{langId}}.tmLanguage.json).
 */
export const RULES: TokenColorRule[] = [
  { scope: 'comment.line.number-sign.{{langId}}', settings: { foreground: '#6b7a6e', fontStyle: 'italic' } },
  { scope: 'string.quoted.double.basic.{{langId}}', settings: { foreground: '#98c379' } },
  { scope: 'string.quoted.single.literal.{{langId}}', settings: { foreground: '#98c379' } },
  { scope: 'constant.numeric.{{langId}}', settings: { foreground: '#d19a66' } },
];

export async function applyColors(vscodeNs: typeof vscode): Promise<void> {
  await applyTokenColors(SCOPE, RULES);
}

export async function removeColors(vscodeNs: typeof vscode): Promise<void> {
  await removeTokenColors(SCOPE);
}

/** True when the user has opted in (default) to automatic coloring. */
export function colorizeEnabled(vscodeNs: typeof vscode): boolean {
  return vscodeNs.workspace.getConfiguration('{{commandPrefix}}').get<boolean>('colorize', true);
}
