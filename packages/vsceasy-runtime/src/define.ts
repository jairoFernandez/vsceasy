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

/** Live values a reactive status bar item can return from `render`. */
export interface StatusBarState {
  /** Display text. May include `$(codicon)` syntax. */
  text?: string;
  /** Plain tooltip. */
  tooltip?: string;
  /** Markdown tooltip — takes precedence over `tooltip`. */
  tooltipMarkdown?: string;
  /** Background color theme key (e.g. 'statusBarItem.warningBackground'). */
  backgroundColor?: string;
  /** Hide the item entirely. Default: true (shown). */
  visible?: boolean;
}

export interface StatusBarDef {
  /** Stable id. Default: file basename. */
  id?: string;
  /** Display text. May include `$(codicon)` syntax. */
  text: string;
  /**
   * Make the item live. Returns the values to display; anything omitted falls
   * back to the static fields. Re-run on activate and on every `watch` change.
   *
   *   render: () => ({ text: `${wpm.get()} wpm` }),
   *   watch: (refresh) => wpm.subscribe(refresh),
   */
  render?: (
    vscode: typeof import('vscode'),
    ctx: vscode.ExtensionContext,
  ) => StatusBarState | undefined;
  /**
   * Keep the item live. Call `refresh` to re-run `render`; return an
   * unsubscribe. Same shape as `TreeViewDef.watch`.
   */
  watch?: (
    refresh: () => void,
    vscode: typeof import('vscode'),
    ctx: vscode.ExtensionContext,
  ) => (() => void) | void;
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

// --- Completion providers (classic IntelliSense) ---

/** Document selector: a language id, a glob pattern, or a full vscode selector. */
export type DocSelector =
  | string
  | { language?: string; scheme?: string; pattern?: string }
  | Array<string | { language?: string; scheme?: string; pattern?: string }>;

export interface CompletionItemDef {
  /** Text shown in the list. */
  label: string;
  /** Text actually inserted. Default: `label`. Use `${1:x}` for snippet tabstops when `snippet` is true. */
  insert?: string;
  /** Treat `insert` as a snippet (tabstops / placeholders). Default: false. */
  snippet?: boolean;
  /** Icon kind shown next to the label. Default: 'text'. */
  kind?:
    | 'text' | 'method' | 'function' | 'constructor' | 'field' | 'variable'
    | 'class' | 'interface' | 'module' | 'property' | 'keyword' | 'snippet'
    | 'value' | 'enum' | 'constant' | 'struct' | 'event' | 'operator';
  /** Right-aligned grey text in the list. */
  detail?: string;
  /** Markdown shown in the expanded documentation pane. */
  documentation?: string;
  /** Sort key. Lower sorts first. Default: label. */
  sortText?: string;
  /** Prevent VS Code from auto-selecting this as preselected. */
  preselect?: boolean;
}

/** Context handed to a completion provider on every request. */
export interface CompletionContext {
  document: vscode.TextDocument;
  position: vscode.Position;
  /** Word being typed at the cursor (may be empty). */
  prefix: string;
  /** Full text of the current line up to the cursor. */
  linePrefix: string;
  /** How the request was triggered. */
  triggerKind: 'invoke' | 'triggerCharacter' | 'incomplete';
  /** The trigger character, when triggerKind is 'triggerCharacter'. */
  triggerCharacter?: string;
  token: vscode.CancellationToken;
}

export interface CompletionDef {
  /** Stable id. Default: file basename. */
  id?: string;
  /** Which documents this applies to. Default: all files. */
  selector?: DocSelector;
  /** Characters that pop the list open in addition to normal typing. */
  triggerCharacters?: string[];
  /**
   * Non-invasive mode: wait this many ms of *keyboard silence* before the
   * provider produces anything. While the user types fluently, the list never
   * appears. Set 0 / omit for standard behaviour.
   */
  delayMs?: number;
  /**
   * Extra veto. Return false to produce no items for this request — use it to
   * charge points, enforce a practice mode, or suppress inside exercise files.
   * Runs after `delayMs` has elapsed.
   */
  gate?: (
    ctx: CompletionContext,
    vscode: typeof import('vscode'),
    extCtx: vscode.ExtensionContext,
  ) => boolean | Promise<boolean>;
  /** Produce the items. Return `[]` to show nothing. */
  provide: (
    ctx: CompletionContext,
    vscode: typeof import('vscode'),
    extCtx: vscode.ExtensionContext,
  ) => CompletionItemDef[] | Promise<CompletionItemDef[]>;
}

export function defineCompletion(def: CompletionDef): CompletionDef {
  return def;
}

// --- Inline completion (ghost text) ---

export interface InlineCompletionContext extends Omit<CompletionContext, 'triggerKind' | 'triggerCharacter'> {
  /** 'automatic' as you type, 'explicit' when the user asked for it. */
  triggerKind: 'automatic' | 'explicit';
  /** Text of the current line after the cursor. */
  lineSuffix: string;
}

export interface InlineSuggestion {
  /** The ghost text to insert at the cursor. */
  text: string;
  /**
   * Replace this many characters *before* the cursor along with inserting.
   * Default 0 (pure insertion).
   */
  replacePrefix?: number;
  /** Command run after the user accepts this suggestion (for telemetry / scoring). */
  onAccept?: (vscode: typeof import('vscode'), ctx: vscode.ExtensionContext) => unknown | Promise<unknown>;
}

export interface InlineCompletionDef {
  /** Stable id. Default: file basename. */
  id?: string;
  /** Which documents this applies to. Default: all files. */
  selector?: DocSelector;
  /**
   * Debounce: wait this many ms of keyboard silence before asking `provide`.
   * Essential when `provide` hits an LLM. Default: 300.
   */
  delayMs?: number;
  /**
   * Cache identical requests for this many ms so an LLM isn't re-queried while
   * the user reads the same suggestion. Default: 0 (no cache).
   */
  cacheMs?: number;
  /** Veto a request before `provide` runs. */
  gate?: (
    ctx: InlineCompletionContext,
    vscode: typeof import('vscode'),
    extCtx: vscode.ExtensionContext,
  ) => boolean | Promise<boolean>;
  /**
   * Produce ghost text. Return null / '' / [] for no suggestion. Always check
   * `ctx.token.isCancellationRequested` after an await — the user has usually
   * typed on.
   */
  provide: (
    ctx: InlineCompletionContext,
    vscode: typeof import('vscode'),
    extCtx: vscode.ExtensionContext,
  ) =>
    | string | null | undefined | InlineSuggestion | InlineSuggestion[]
    | Promise<string | null | undefined | InlineSuggestion | InlineSuggestion[]>;
}

export function defineInlineCompletion(def: InlineCompletionDef): InlineCompletionDef {
  return def;
}

// --- Typing guards (intercept keystrokes / paste / edits) ---

/** A single keystroke arriving through VS Code's `type` command. */
export interface TypingEvent {
  /** The character(s) the user typed. Usually length 1. */
  text: string;
  editor: vscode.TextEditor;
  document: vscode.TextDocument;
  position: vscode.Position;
  /** Text of the current line up to the cursor. */
  linePrefix: string;
}

/** A paste / multi-character insertion arriving through the clipboard. */
export interface PasteEvent {
  text: string;
  editor: vscode.TextEditor;
  document: vscode.TextDocument;
}

/** A deletion arriving through backspace, delete, or a cut. */
export interface DeleteEvent {
  /**
   * Which command the user invoked. `deleteLeft` is backspace, `deleteRight`
   * is the delete key; the `WordLeft` / `WordRight` variants are the
   * ctrl/alt-modified forms, and `cut` is clipboard cut.
   */
  kind: 'deleteLeft' | 'deleteRight' | 'deleteWordLeft' | 'deleteWordRight' | 'cut';
  editor: vscode.TextEditor;
  document: vscode.TextDocument;
  /** Cursor position when the deletion was invoked. */
  position: vscode.Position;
  /** The text that would be removed, as best the runtime can determine it. */
  text: string;
  /** True when the selection spans more than a single character. */
  hasSelection: boolean;
}

/** What a guard decides to do with an incoming keystroke. */
export type TypingVerdict =
  /** Let it through unchanged. */
  | true | undefined | void
  /** Swallow it — nothing is inserted. */
  | false
  /** Insert this instead of what was typed. */
  | { insert: string }
  /** Swallow it and show this warning. */
  | { block: true; message?: string };

export interface TypingGuardDef {
  /** Stable id. Default: file basename. */
  id?: string;
  /**
   * Which documents this guard watches. Default: all files. A guard that
   * matches nothing costs nothing — the `type` override checks the selector
   * before doing any work.
   */
  selector?: DocSelector;
  /**
   * Master switch, re-evaluated on every keystroke. Return false to make the
   * guard transparent (e.g. practice session not running).
   */
  enabled?: (
    vscode: typeof import('vscode'),
    ctx: vscode.ExtensionContext,
  ) => boolean;
  /**
   * Called for each typed character *before* it reaches the document.
   * Return `false` / `{ block: true }` to swallow it, `{ insert }` to
   * substitute. Anything else lets it through.
   *
   * NOTE: overriding `type` is exclusive — only one extension can own it. The
   * runtime registers a single override that fans out to every guard, and
   * falls back to `default:type` when all guards allow.
   */
  onType?: (
    e: TypingEvent,
    vscode: typeof import('vscode'),
    ctx: vscode.ExtensionContext,
  ) => TypingVerdict | Promise<TypingVerdict>;
  /**
   * Called when the user pastes. Return false / `{ block: true }` to refuse.
   * Wired by overriding the standard paste command.
   */
  onPaste?: (
    e: PasteEvent,
    vscode: typeof import('vscode'),
    ctx: vscode.ExtensionContext,
  ) => TypingVerdict | Promise<TypingVerdict>;
  /**
   * Called before a deletion reaches the document — backspace, delete, the
   * word-wise variants, and cut. Return `false` / `{ block: true }` to refuse
   * it, or let it through to handle the removal yourself.
   *
   * Deletions do NOT arrive through `onType`: VS Code routes them as their own
   * commands, so a guard that only implements `onType` will silently let the
   * user delete anything.
   */
  onDelete?: (
    e: DeleteEvent,
    vscode: typeof import('vscode'),
    ctx: vscode.ExtensionContext,
  ) => TypingVerdict | Promise<TypingVerdict>;
  /**
   * Observe every document change that got through (including programmatic
   * ones). Cannot block — use for metrics such as WPM and accuracy.
   */
  onChange?: (
    e: vscode.TextDocumentChangeEvent,
    vscode: typeof import('vscode'),
    ctx: vscode.ExtensionContext,
  ) => unknown;
}

export function defineTypingGuard(def: TypingGuardDef): TypingGuardDef {
  return def;
}

// --- Decorations (editor overlays) ---

/** Where a decoration renders. Same shape as vscode.DecorationRenderOptions, trimmed. */
export interface DecorationStyle {
  color?: string;
  backgroundColor?: string;
  border?: string;
  borderRadius?: string;
  fontStyle?: string;
  fontWeight?: string;
  textDecoration?: string;
  opacity?: string;
  /** Grey text rendered after the range without occupying document space. */
  after?: { contentText?: string; color?: string; fontStyle?: string; margin?: string };
  /** Same, rendered before the range. */
  before?: { contentText?: string; color?: string; fontStyle?: string; margin?: string };
  /** Gutter icon path relative to the extension root. */
  gutterIconPath?: string;
  gutterIconSize?: string;
  /** Marker in the overview ruler (the minimap scrollbar). */
  overviewRulerColor?: string;
  /** Default: false — the style stops at the end of the decorated range. */
  isWholeLine?: boolean;
}

/** One decorated span, produced by `compute`. */
export interface DecorationSpan {
  /** Zero-based line. */
  line: number;
  /** Zero-based start character. Default 0. */
  startChar?: number;
  /** Zero-based end character. Default: end of line. */
  endChar?: number;
  /** Hover text (markdown). */
  hover?: string;
  /** Per-span style overrides — merged over the def's `style`. */
  style?: DecorationStyle;
}

export interface DecorationDef {
  /** Stable id. Default: file basename. */
  id?: string;
  /** Which documents get decorated. Default: all files. */
  selector?: DocSelector;
  /** Base style applied to every span. */
  style: DecorationStyle;
  /**
   * When to recompute. Default: `['changeActiveEditor', 'changeDocument']`.
   * `'manual'` means only an explicit `refreshDecoration(id)` call redraws.
   */
  on?: Array<'changeActiveEditor' | 'changeDocument' | 'changeSelection' | 'manual'>;
  /** Debounce recomputation by this many ms. Default: 50. */
  debounceMs?: number;
  /** Produce the spans to decorate for the given editor. */
  compute: (
    editor: vscode.TextEditor,
    vscode: typeof import('vscode'),
    ctx: vscode.ExtensionContext,
  ) => DecorationSpan[] | Promise<DecorationSpan[]>;
  /**
   * Keep decorations live from an external source. Call `refresh` to redraw.
   * Return an unsubscribe. Same shape as `TreeViewDef.watch`.
   */
  watch?: (
    refresh: () => void,
    vscode: typeof import('vscode'),
    ctx: vscode.ExtensionContext,
  ) => (() => void) | void;
}

export function defineDecoration(def: DecorationDef): DecorationDef {
  return def;
}

// --- Terminals (run commands, capture output) ---

export interface TerminalRunResult {
  /** Merged stdout, in order. */
  stdout: string;
  /** Merged stderr, in order. */
  stderr: string;
  /** Process exit code. `null` when killed by a signal or timeout. */
  code: number | null;
  /** True when the run was cut short by `timeoutMs`. */
  timedOut: boolean;
  /** Wall-clock duration in ms. */
  durationMs: number;
}

export interface TerminalRunOptions {
  /** Working directory. Default: the def's `cwd`, else the first workspace folder. */
  cwd?: string;
  /** Extra environment variables, merged over `process.env`. */
  env?: Record<string, string>;
  /** Kill the process after this many ms. Default: the def's `timeoutMs`. */
  timeoutMs?: number;
  /** Streamed output callback, called as chunks arrive. */
  onData?: (chunk: string, stream: 'stdout' | 'stderr') => void;
}

/** Handle passed to `TerminalDef.run` and returned by `useTerminal(id)`. */
export interface TerminalHandle {
  /**
   * Run a command headlessly and capture its output. Never throws on a
   * non-zero exit — inspect `code`.
   */
  exec: (command: string, opts?: TerminalRunOptions) => Promise<TerminalRunResult>;
  /**
   * Send the command to a *visible* VS Code integrated terminal (the one named
   * by this def, created on first use). Output is not captured — use for
   * things the user should watch.
   */
  send: (command: string, opts?: { show?: boolean }) => void;
  /** Reveal the visible terminal. */
  show: () => void;
  /** Dispose the visible terminal, if one was created. */
  dispose: () => void;
}

export interface TerminalDef {
  /** Stable id. Default: file basename. Also the name of the visible terminal. */
  id?: string;
  /** Display name of the integrated terminal. Default: the id. */
  title?: string;
  /** Default working directory for `exec` / `send`. Default: first workspace folder. */
  cwd?: string;
  /** Environment merged over `process.env` for every `exec`. */
  env?: Record<string, string>;
  /** Default timeout in ms for `exec`. Default: 60_000. */
  timeoutMs?: number;
  /** Shell used by `exec`. Default: the platform shell. */
  shell?: string;
  /**
   * Optional lifecycle hook, run once on activate with the handle. Use it to
   * kick off a watcher (`h.send('bun test --watch')`) or to stash the handle.
   */
  run?: (
    handle: TerminalHandle,
    vscode: typeof import('vscode'),
    ctx: vscode.ExtensionContext,
  ) => unknown | Promise<unknown>;
}

export function defineTerminal(def: TerminalDef): TerminalDef {
  return def;
}
