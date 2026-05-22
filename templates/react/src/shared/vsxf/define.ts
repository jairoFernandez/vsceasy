import type * as vscode from 'vscode';
import type { Handlers } from './rpc';
import type { CodiconName } from './codiconNames';

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

// --- Menus (Activity Bar + Tree View) ---

export type MenuIcon =
  | CodiconName                                // known codicon (autocompletes)
  | (string & {})                              // any codicon name (escape hatch, keeps autocomplete)
  | { path: string }                           // single SVG path relative to project root
  | { light: string; dark: string };           // theme-aware SVG paths

export type { CodiconName };

export interface MenuItem {
  /** Display label. */
  label: string;
  /** Optional icon (codicon name or asset path). */
  icon?: MenuIcon;
  /** Optional tooltip / hover description. */
  description?: string;
  /** Open a panel by id (file basename in src/panels/). */
  panel?: string;
  /** Execute a command by id (file basename in src/commands/). */
  command?: string;
  /** Open an external URL in the user's browser. */
  url?: string;
  /** Run an arbitrary handler (full vscode access). */
  run?: (vscode: typeof import('vscode'), ctx: vscode.ExtensionContext) => unknown | Promise<unknown>;
  /** Nested items — renders as a collapsible group. */
  children?: MenuItem[];
  /** Initial collapsed state for groups. Default: 'expanded'. */
  collapsed?: 'expanded' | 'collapsed';
}

export interface MenuDef {
  /** Stable id. Default: file basename. Becomes the view container id. */
  id?: string;
  /** Title shown at the top of the sidebar panel and as the activity bar tooltip. */
  title: string;
  /** Activity bar icon. Codicon string OR SVG path(s). */
  icon: MenuIcon;
  /** Items shown in the tree view. */
  items: MenuItem[];
}

export function defineMenu(def: MenuDef): MenuDef {
  return def;
}
