import type * as vscode from 'vscode';
import type { Handlers } from './rpc';
import type { CodiconName } from './codiconNames';

/**
 * Push a change to this webview over the RPC event channel. The webview reacts
 * with `listen(api, topic, …)`. Wire it to a data source with `watch()` /
 * `watchEntity()` inside `rpc()`:
 *
 *   rpc: (vscode, ctx, emit) => {
 *     watchEntity(Todos, () => emit('todos:changed'));
 *     return { stats: () => … };
 *   }
 */
export type RpcEmit = (topic: string, payload?: unknown) => void;

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
  /**
   * RPC handlers — receives the vscode namespace, the extension context, and
   * `emit` for pushing change events to this webview (see {@link RpcEmit}).
   */
  rpc?: (vscode: typeof import('vscode'), ctx: vscode.ExtensionContext, emit: RpcEmit) => H;
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
  /**
   * Keyboard shortcut. String shorthand uses the same key on every platform.
   * Object form supports `mac` override and a VS Code `when` clause.
   * Written to package.json#contributes.keybindings by `bun run gen`.
   */
  keybinding?: string | KeybindingDef | (string | KeybindingDef)[];
  /**
   * VS Code `when` clause that controls visibility/enablement of this command
   * in the command palette and auto-generated menu entries. Written to
   * `contributes.commands[].enablement` and used as the default `when` on
   * the palette menu entry by `bun run gen`.
   *
   * Examples: `'editorTextFocus'`, `'resourceLangId == typescript'`,
   * `'explorerResourceIsFolder && !virtualWorkspace'`.
   * Reference: https://code.visualstudio.com/api/references/when-clause-contexts
   */
  when?: string;
}

export interface KeybindingDef {
  /** Default key combo (e.g. 'ctrl+shift+h'). */
  key: string;
  /** Override combo on macOS (e.g. 'cmd+shift+h'). */
  mac?: string;
  /** VS Code context `when` clause (e.g. 'editorTextFocus'). */
  when?: string;
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

// --- Webview Views (inline sidebar sections) ---

export interface SubpanelDef<H extends Handlers = Handlers> {
  /** Stable id. Default: file basename. */
  id?: string;
  /** Section header shown in the sidebar. */
  title: string;
  /** Menu (activity bar container) this view lives in — basename in src/menus/. */
  menu: string;
  /** Webview bundle name under dist/webview/<ui>/. Default: same as id. */
  ui?: string;
  /** Keep DOM alive when hidden. Default: true. */
  retainContext?: boolean;
  /**
   * RPC handlers — receives the vscode namespace, the extension context, and
   * `emit` for pushing change events to this webview (see {@link RpcEmit}).
   */
  rpc?: (vscode: typeof import('vscode'), ctx: vscode.ExtensionContext, emit: RpcEmit) => H;
}

export function defineSubpanel<H extends Handlers = Handlers>(def: SubpanelDef<H>): SubpanelDef<H> {
  return def;
}

// --- Status Bar items ---

export interface StatusBarDef {
  /** Stable id. Default: file basename. */
  id?: string;
  /** Display text. May include `$(codicon)` syntax. */
  text: string;
  /** Tooltip on hover. */
  tooltip?: string;
  /** Optional codicon, prepended as `$(icon) text` when both present. */
  icon?: CodiconName | (string & {});
  /** Bar side. Default: 'left'. */
  alignment?: 'left' | 'right';
  /** Higher = leftmost on its side. Default: 100. */
  priority?: number;
  /** Command id to run on click (basename in src/commands/, or full vscode command id). */
  command?: string;
  /** Open a panel by id (basename in src/panels/). Takes precedence over `command` when set. */
  panel?: string;
  /** Background color theme key (e.g. 'statusBarItem.warningBackground'). */
  backgroundColor?: string;
  /**
   * Rich markdown tooltip (overrides `tooltip`). Supports command links
   * (`[text](command:ext.foo)`), codicons (`$(rocket)`), and HTML.
   * Rendered on hover. Mimics Copilot/GitLens popup style.
   */
  tooltipMarkdown?: string;
  /**
   * Open a popup menu on click instead of running a single command/panel.
   * Each item runs its `command`, opens its `panel`, or opens its `url`.
   */
  menu?: StatusBarMenuItem[];
}

export interface StatusBarMenuItem {
  /** Display label. May include `$(codicon)`. */
  label: string;
  /** Inline secondary text. */
  description?: string;
  /** Detail line (smaller, below). */
  detail?: string;
  /** Command id (basename in src/commands/) or full vscode command id. */
  command?: string;
  /** Panel id (basename in src/panels/). */
  panel?: string;
  /** External URL. */
  url?: string;
}

export function defineStatusBar(def: StatusBarDef): StatusBarDef {
  return def;
}

// --- Tree Views (data-driven) ---

export interface TreeNode {
  /** Display label. */
  label: string;
  /** Stable id, defaults to label. Used for reveal/select. */
  id?: string;
  /** Optional icon. */
  icon?: MenuIcon;
  /** Tooltip on hover. */
  tooltip?: string;
  /** Right-aligned description text. */
  description?: string;
  /** Context value used by `view/item/context` menu entries. */
  contextValue?: string;
  /** Initial state when this node has children. Default: 'collapsed'. */
  collapsed?: 'expanded' | 'collapsed';
  /** Eagerly provided children. If omitted, getChildren(this) is called lazily. */
  children?: TreeNode[];
  /** Click handler — run an arbitrary callback when the node is selected. */
  run?: (vscode: typeof import('vscode'), ctx: vscode.ExtensionContext) => unknown | Promise<unknown>;
  /** Click → open a panel by id. */
  panel?: string;
  /** Click → run a command by id. */
  command?: string;
}

export interface TreeViewDef {
  /** Stable id. Default: file basename. */
  id?: string;
  /** Sidebar section header. */
  title: string;
  /** Activity bar container id (menu basename in src/menus/). */
  menu: string;
  /** Show "Collapse All" button. Default: true. */
  showCollapseAll?: boolean;
  /** Initial / refreshed nodes. Called on mount and whenever the view is refreshed. */
  getChildren: (
    parent: TreeNode | undefined,
    vscode: typeof import('vscode'),
    ctx: vscode.ExtensionContext,
  ) => TreeNode[] | Promise<TreeNode[]>;
  /**
   * Keep the tree live. Receives `refresh` — call it (directly or as a callback)
   * to re-run `getChildren`. Subscribe to a data source here so the tree updates
   * itself; return an unsubscribe to clean up.
   *
   *   watch: (refresh) => watchEntity(Todos, refresh),
   */
  watch?: (
    refresh: () => void,
    vscode: typeof import('vscode'),
    ctx: vscode.ExtensionContext,
  ) => (() => void) | void;
}

export function defineTreeView(def: TreeViewDef): TreeViewDef {
  return def;
}

// --- Jobs (recurring / event-triggered tasks) ---

export type JobSchedule =
  /** Run every <interval>. Accepts ms number or duration string: "30s", "5m", "2h", "1d". */
  | { every: string | number; runOnStart?: boolean }
  /** Run at HH:MM local time, every day. */
  | { dailyAt: string }
  /** Run on a VS Code lifecycle event. */
  | { on: 'startup' | 'saveDocument' | 'openDocument' | 'changeActiveEditor' | 'changeConfig' }
  /** Run on filesystem changes matching a glob (relative to workspace). */
  | { onFile: string };

export interface JobDef {
  /** Stable id. Default: file basename. */
  id?: string;
  /** Display label (used in logs + opt. status bar). */
  title: string;
  /** When to run. */
  schedule: JobSchedule;
  /**
   * Skip if last successful run was less than this many ms ago. Stored in
   * `context.globalState` under `vsceasy.job.<id>.lastRun`. Useful for jobs
   * that should at most run every N hours regardless of how often the
   * trigger fires.
   */
  minIntervalMs?: number;
  /** The actual work. Errors are caught and logged — they never crash the host. */
  run: (vscode: typeof import('vscode'), ctx: vscode.ExtensionContext) => unknown | Promise<unknown>;
}

export function defineJob(def: JobDef): JobDef {
  return def;
}
