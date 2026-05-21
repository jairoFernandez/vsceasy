import type * as vscode from 'vscode';
import type { Handlers } from './rpc';

export interface PanelDef<H extends Handlers = Handlers> {
  /** Stable id. Default: file basename. Used as command suffix and webview key. */
  id?: string;
  /** Tab title. */
  title: string;
  /** Webview bundle name under dist/webview/<ui>/. Default: same as id. */
  ui?: string;
  /** Where to open. Default: 'active'. */
  column?: 'active' | 'beside' | 'one' | 'two' | 'three';
  /** Keep DOM alive when hidden. Default: true. */
  retainContext?: boolean;
  /** RPC handlers — receives vscode namespace + extension context. */
  rpc?: (vscode: typeof import('vscode'), ctx: vscode.ExtensionContext) => H;
  /** Optional command palette entry that opens this panel. Default: true. */
  command?:
    | boolean
    | { title?: string; category?: string };
}

export interface CommandDef {
  /** Stable id. Default: file basename. */
  id?: string;
  /** Command palette title. */
  title: string;
  /** Optional category prefix (default: extension displayName). */
  category?: string;
  /** Handler. Receives vscode + extension context. */
  run: (vscode: typeof import('vscode'), ctx: vscode.ExtensionContext, ...args: unknown[]) => unknown | Promise<unknown>;
}

export function definePanel<H extends Handlers = Handlers>(def: PanelDef<H>): PanelDef<H> {
  return def;
}

export function defineCommand(def: CommandDef): CommandDef {
  return def;
}
