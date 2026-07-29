import * as vscode from 'vscode';
import type { PanelDef, CommandDef, MenuDef, MenuItem, StatusBarDef, StatusBarMenuItem, StatusBarState, SubpanelDef, TreeViewDef, TreeNode, JobDef, JobSchedule, CompletionDef, CompletionItemDef, InlineCompletionDef, InlineSuggestion, TypingGuardDef, TypingVerdict, DeleteEvent, HoverDef, DecorationDef, DecorationStyle, DecorationSpan, TerminalDef, TerminalHandle, TerminalRunOptions, TerminalRunResult, DocSelector } from './define';
import { createRpcServer, webviewTransport } from './rpc';

export interface Registry {
  panels: Record<string, PanelDef>;
  commands: Record<string, CommandDef>;
  menus?: Record<string, MenuDef>;
  statusBars?: Record<string, StatusBarDef>;
  subpanels?: Record<string, SubpanelDef>;
  treeViews?: Record<string, TreeViewDef>;
  jobs?: Record<string, JobDef>;
  completions?: Record<string, CompletionDef>;
  inlineCompletions?: Record<string, InlineCompletionDef>;
  typingGuards?: Record<string, TypingGuardDef>;
  hovers?: Record<string, HoverDef>;
  decorations?: Record<string, DecorationDef>;
  terminals?: Record<string, TerminalDef>;
  /** Command prefix from package.json (e.g. "myExt"). */
  prefix: string;
}

const openPanels = new Map<string, vscode.WebviewPanel>();

/**
 * Hook fired with the `ExtensionContext`. Use to wire `initDb(context)`,
 * `initSecrets(context)`, `initState(context)`, etc. Return value ignored;
 * may be sync or async (awaited in order).
 *
 * Signature uses `...rest: any[]` so any 1- or 2-arg helper (including ones
 * that declare a typed second parameter like `initDb(ctx, opts?)`) assigns
 * cleanly. The bootstrap runtime always passes the `vscode` namespace as the
 * second arg — helpers free to ignore it or declare their own type.
 */
export type ActivateHook = (
  context: vscode.ExtensionContext,
  ...rest: any[]
) => unknown | Promise<unknown>;

export interface BootstrapOptions {
  /**
   * Hooks that receive the `ExtensionContext` on activate, before any panel /
   * command / job is registered. Use to wire `initDb(context)`, `initSecrets(context)`,
   * `initState(context)`, telemetry, etc.
   */
  onActivate?: ActivateHook[];
  /** Symmetric: runs in reverse on deactivate. */
  onDeactivate?: ActivateHook[];
}

export function bootstrap(registry: Registry, options: BootstrapOptions = {}) {
  return async function activate(context: vscode.ExtensionContext) {
    for (const hook of options.onActivate ?? []) {
      await hook(context, vscode);
    }
    for (const [id, def] of Object.entries(registry.commands)) {
      const cmd = `${registry.prefix}.${def.id ?? id}`;
      context.subscriptions.push(
        vscode.commands.registerCommand(cmd, (...args) => def.run(vscode, context, ...args)),
      );
    }

    for (const [id, def] of Object.entries(registry.panels)) {
      if (def.command !== false) {
        const cmd = `${registry.prefix}.open${capitalize(def.id ?? id)}`;
        context.subscriptions.push(
          vscode.commands.registerCommand(cmd, () => openPanel(context, registry.prefix, id, def)),
        );
      }
    }

    if (registry.menus) {
      for (const [id, def] of Object.entries(registry.menus)) {
        registerMenu(context, registry, id, def);
      }
    }

    if (registry.statusBars) {
      for (const [id, def] of Object.entries(registry.statusBars)) {
        registerStatusBar(context, registry, id, def);
      }
    }

    if (registry.subpanels) {
      for (const [id, def] of Object.entries(registry.subpanels)) {
        registerSubpanel(context, registry, id, def);
      }
    }

    if (registry.treeViews) {
      for (const [id, def] of Object.entries(registry.treeViews)) {
        registerTreeView(context, registry, id, def);
      }
    }

    if (registry.jobs) {
      for (const [id, def] of Object.entries(registry.jobs)) {
        registerJob(context, registry, id, def);
      }
    }

    if (registry.completions) {
      for (const [id, def] of Object.entries(registry.completions)) {
        registerCompletion(context, id, def);
      }
    }

    if (registry.inlineCompletions) {
      for (const [id, def] of Object.entries(registry.inlineCompletions)) {
        registerInlineCompletion(context, registry, id, def);
      }
    }

    if (registry.typingGuards && Object.keys(registry.typingGuards).length) {
      registerTypingGuards(context, registry.typingGuards);
    }

    if (registry.hovers) {
      for (const [id, def] of Object.entries(registry.hovers)) {
        registerHover(context, id, def);
      }
    }

    if (registry.decorations) {
      for (const [id, def] of Object.entries(registry.decorations)) {
        registerDecoration(context, registry, id, def);
      }
    }

    if (registry.terminals) {
      for (const [id, def] of Object.entries(registry.terminals)) {
        registerTerminal(context, id, def);
      }
    }

    // Register deactivate hooks as disposables — fire in reverse order on shutdown.
    for (const hook of [...(options.onDeactivate ?? [])].reverse()) {
      context.subscriptions.push({
        dispose: () => {
          void hook(context, vscode);
        },
      });
    }
  };
}

// --- Document selectors ---

/** Normalise the friendly `DocSelector` into what vscode.languages expects. */
function toDocumentSelector(sel: DocSelector | undefined): vscode.DocumentSelector {
  if (!sel) return { scheme: 'file' };
  const one = (s: string | { language?: string; scheme?: string; pattern?: string }) =>
    typeof s === 'string'
      // A string with a glob character is a path pattern; otherwise a language id.
      ? (/[*/.]/.test(s) ? { pattern: s } : { language: s })
      : s;
  return Array.isArray(sel) ? sel.map(one) : one(sel);
}

/** Runtime check of the same selector, for the places vscode won't do it for us. */
function matchesSelector(doc: vscode.TextDocument, sel: DocSelector | undefined): boolean {
  if (!sel) return doc.uri.scheme === 'file';
  return vscode.languages.match(toDocumentSelector(sel), doc) > 0;
}

// --- Completion providers ---

const COMPLETION_KINDS: Record<string, vscode.CompletionItemKind> = {
  text: vscode.CompletionItemKind.Text,
  method: vscode.CompletionItemKind.Method,
  function: vscode.CompletionItemKind.Function,
  constructor: vscode.CompletionItemKind.Constructor,
  field: vscode.CompletionItemKind.Field,
  variable: vscode.CompletionItemKind.Variable,
  class: vscode.CompletionItemKind.Class,
  interface: vscode.CompletionItemKind.Interface,
  module: vscode.CompletionItemKind.Module,
  property: vscode.CompletionItemKind.Property,
  keyword: vscode.CompletionItemKind.Keyword,
  snippet: vscode.CompletionItemKind.Snippet,
  value: vscode.CompletionItemKind.Value,
  enum: vscode.CompletionItemKind.Enum,
  constant: vscode.CompletionItemKind.Constant,
  struct: vscode.CompletionItemKind.Struct,
  event: vscode.CompletionItemKind.Event,
  operator: vscode.CompletionItemKind.Operator,
};

/**
 * Track the last keystroke per document so `delayMs` can measure real keyboard
 * silence. A single shared listener serves every completion / inline provider.
 */
const lastKeystrokeAt = new Map<string, number>();
let keystrokeTrackerInstalled = false;

function ensureKeystrokeTracker(context: vscode.ExtensionContext) {
  if (keystrokeTrackerInstalled) return;
  keystrokeTrackerInstalled = true;
  context.subscriptions.push(
    vscode.workspace.onDidChangeTextDocument((e) => {
      lastKeystrokeAt.set(e.document.uri.toString(), Date.now());
    }),
    vscode.workspace.onDidCloseTextDocument((doc) => {
      lastKeystrokeAt.delete(doc.uri.toString());
    }),
  );
}

/**
 * Resolve once the document has been quiet for `delayMs`. Returns false if the
 * user typed again while waiting (or the request was cancelled) — the caller
 * should then produce nothing, because a newer request is already in flight.
 */
async function awaitQuiet(
  doc: vscode.TextDocument,
  delayMs: number,
  token: vscode.CancellationToken,
): Promise<boolean> {
  if (delayMs <= 0) return !token.isCancellationRequested;
  const key = doc.uri.toString();
  const startedFrom = lastKeystrokeAt.get(key) ?? 0;
  const elapsed = Date.now() - startedFrom;
  const wait = delayMs - elapsed;
  if (wait > 0) {
    await new Promise((r) => setTimeout(r, wait));
    if (token.isCancellationRequested) return false;
    // Someone typed while we waited — a newer request supersedes this one.
    if ((lastKeystrokeAt.get(key) ?? 0) !== startedFrom) return false;
  }
  return !token.isCancellationRequested;
}

function buildCompletionContext(
  document: vscode.TextDocument,
  position: vscode.Position,
  token: vscode.CancellationToken,
  ctx: vscode.CompletionContext,
) {
  const linePrefix = document.lineAt(position.line).text.slice(0, position.character);
  const wordRange = document.getWordRangeAtPosition(position);
  return {
    document,
    position,
    prefix: wordRange ? document.getText(wordRange.with(undefined, position)) : '',
    linePrefix,
    triggerKind:
      ctx.triggerKind === vscode.CompletionTriggerKind.TriggerCharacter
        ? ('triggerCharacter' as const)
        : ctx.triggerKind === vscode.CompletionTriggerKind.TriggerForIncompleteCompletions
          ? ('incomplete' as const)
          : ('invoke' as const),
    triggerCharacter: ctx.triggerCharacter,
    token,
  };
}

function registerCompletion(
  context: vscode.ExtensionContext,
  id: string,
  def: CompletionDef,
) {
  ensureKeystrokeTracker(context);
  const provider: vscode.CompletionItemProvider = {
    async provideCompletionItems(document, position, token, completionCtx) {
      const c = buildCompletionContext(document, position, token, completionCtx);
      // Non-invasive: stay silent until the user actually pauses.
      if (!(await awaitQuiet(document, def.delayMs ?? 0, token))) return undefined;
      if (def.gate && !(await def.gate(c, vscode, context))) return undefined;
      let items: CompletionItemDef[];
      try {
        items = await def.provide(c, vscode, context);
      } catch (err) {
        console.error(`[vsceasy completion:${def.id ?? id}] provide failed:`, err);
        return undefined;
      }
      if (token.isCancellationRequested || !items?.length) return undefined;
      return items.map((it) => {
        const item = new vscode.CompletionItem(
          it.label,
          COMPLETION_KINDS[it.kind ?? 'text'] ?? vscode.CompletionItemKind.Text,
        );
        const insert = it.insert ?? it.label;
        item.insertText = it.snippet ? new vscode.SnippetString(insert) : insert;
        item.detail = it.detail;
        if (it.documentation) item.documentation = new vscode.MarkdownString(it.documentation);
        if (it.sortText) item.sortText = it.sortText;
        if (it.preselect) item.preselect = true;
        return item;
      });
    },
  };
  context.subscriptions.push(
    vscode.languages.registerCompletionItemProvider(
      toDocumentSelector(def.selector),
      provider,
      ...(def.triggerCharacters ?? []),
    ),
  );
}

// --- Inline completion (ghost text) ---

function registerInlineCompletion(
  context: vscode.ExtensionContext,
  registry: Registry,
  id: string,
  def: InlineCompletionDef,
) {
  ensureKeystrokeTracker(context);
  const defId = def.id ?? id;
  // Accept callbacks can't be attached to the item directly — VS Code only
  // takes a command, so we register one per def and pass the index through.
  const acceptCmd = `${registry.prefix}._inline.${defId}.accept`;
  let pending: InlineSuggestion[] = [];
  context.subscriptions.push(
    vscode.commands.registerCommand(acceptCmd, async (index: number) => {
      const s = pending[index];
      if (!s?.onAccept) return;
      try {
        await s.onAccept(vscode, context);
      } catch (err) {
        console.error(`[vsceasy inlineCompletion:${defId}] onAccept failed:`, err);
      }
    }),
  );

  const cache = new Map<string, { at: number; value: InlineSuggestion[] }>();

  const provider: vscode.InlineCompletionItemProvider = {
    async provideInlineCompletionItems(document, position, inlineCtx, token) {
      const line = document.lineAt(position.line).text;
      const c = {
        document,
        position,
        prefix: (() => {
          const r = document.getWordRangeAtPosition(position);
          return r ? document.getText(r.with(undefined, position)) : '';
        })(),
        linePrefix: line.slice(0, position.character),
        lineSuffix: line.slice(position.character),
        triggerKind:
          inlineCtx.triggerKind === vscode.InlineCompletionTriggerKind.Invoke
            ? ('explicit' as const)
            : ('automatic' as const),
        token,
      };

      if (!(await awaitQuiet(document, def.delayMs ?? 300, token))) return undefined;
      if (def.gate && !(await def.gate(c, vscode, context))) return undefined;

      // Cache on the exact cursor context so re-triggers don't re-hit the LLM.
      const cacheMs = def.cacheMs ?? 0;
      const cacheKey = `${document.uri.toString()}:${position.line}:${position.character}:${c.linePrefix}`;
      if (cacheMs > 0) {
        const hit = cache.get(cacheKey);
        if (hit && Date.now() - hit.at < cacheMs) {
          return toInlineItems(hit.value, position, acceptCmd, (v) => (pending = v));
        }
      }

      let raw: Awaited<ReturnType<InlineCompletionDef['provide']>>;
      try {
        raw = await def.provide(c, vscode, context);
      } catch (err) {
        console.error(`[vsceasy inlineCompletion:${defId}] provide failed:`, err);
        return undefined;
      }
      if (token.isCancellationRequested) return undefined;

      const suggestions: InlineSuggestion[] = (
        raw == null ? [] : typeof raw === 'string' ? [{ text: raw }] : Array.isArray(raw) ? raw : [raw]
      ).filter((s) => s.text);
      if (!suggestions.length) return undefined;

      if (cacheMs > 0) {
        cache.set(cacheKey, { at: Date.now(), value: suggestions });
        // Bound the cache — these keys are per-cursor-position and never reused.
        if (cache.size > 64) cache.delete(cache.keys().next().value as string);
      }
      return toInlineItems(suggestions, position, acceptCmd, (v) => (pending = v));
    },
  };

  context.subscriptions.push(
    vscode.languages.registerInlineCompletionItemProvider(toDocumentSelector(def.selector), provider),
  );
}

function toInlineItems(
  suggestions: InlineSuggestion[],
  position: vscode.Position,
  acceptCmd: string,
  setPending: (v: InlineSuggestion[]) => void,
): vscode.InlineCompletionItem[] {
  setPending(suggestions);
  return suggestions.map((s, i) => {
    const startChar = Math.max(0, position.character - (s.replacePrefix ?? 0));
    const range = new vscode.Range(position.line, startChar, position.line, position.character);
    const item = new vscode.InlineCompletionItem(s.text, range);
    if (s.onAccept) {
      item.command = { command: acceptCmd, title: 'accepted', arguments: [i] };
    }
    return item;
  });
}

// --- Hovers ---

function registerHover(context: vscode.ExtensionContext, id: string, def: HoverDef) {
  const provider: vscode.HoverProvider = {
    async provideHover(document, position, token) {
      const line = document.lineAt(position.line).text;
      const wordRange = document.getWordRangeAtPosition(position);
      let markdown: string | null | undefined;
      try {
        markdown = await def.provide(
          {
            document,
            position,
            word: wordRange ? document.getText(wordRange) : '',
            line,
            lineNumber: position.line,
            token,
          },
          vscode,
          context,
        );
      } catch (err) {
        console.error(`[vsceasy hover:${def.id ?? id}] provide failed:`, err);
        return undefined;
      }
      if (token.isCancellationRequested || !markdown) return undefined;
      const md = new vscode.MarkdownString(markdown, true);
      // Let the panel carry command links and inline HTML.
      md.isTrusted = true;
      md.supportHtml = true;
      return new vscode.Hover(md);
    },
  };
  context.subscriptions.push(
    vscode.languages.registerHoverProvider(toDocumentSelector(def.selector), provider),
  );
}

// --- Typing guards ---

/**
 * A single `type` override fans out to every guard. VS Code allows only one
 * extension to own `type`, so registering per-guard would break silently — the
 * runtime owns it once and consults the guards in registration order.
 */
function registerTypingGuards(
  context: vscode.ExtensionContext,
  guards: Record<string, TypingGuardDef>,
) {
  const entries = Object.entries(guards);
  const active = (def: TypingGuardDef, doc: vscode.TextDocument) =>
    matchesSelector(doc, def.selector) && (def.enabled ? def.enabled(vscode, context) : true);

  /**
   * VS Code fires editing commands again without waiting for the previous
   * invocation to settle, so a guard that awaits anything can have two edits in
   * flight at once — both reading the same state, both deciding against it.
   * Typing fast then silently drops characters. Chaining every invocation onto
   * a single promise makes the handlers strictly sequential, which is the only
   * ordering that matches what the user did.
   *
   * Typing and deletion share one queue on purpose: a backspace racing the
   * keystroke before it would desync any guard that tracks an offset.
   */
  let queue: Promise<unknown> = Promise.resolve();
  const serialize = <T>(work: () => Promise<T>): Promise<T> => {
    const next = queue.then(work, work);
    // Keep the chain alive even when one link rejects.
    queue = next.catch(() => undefined);
    return next;
  };

  if (entries.some(([, d]) => d.onType)) {
    context.subscriptions.push(
      vscode.commands.registerCommand('type', (args: { text: string }) =>
        serialize(async () => {
        const editor = vscode.window.activeTextEditor;
        // No editor (or nothing to inspect) — hand straight back to VS Code.
        if (!editor || typeof args?.text !== 'string') {
          return vscode.commands.executeCommand('default:type', args);
        }
        const document = editor.document;
        let text = args.text;

        for (const [id, def] of entries) {
          if (!def.onType || !active(def, document)) continue;
          const position = editor.selection.active;
          let verdict: TypingVerdict;
          try {
            verdict = await def.onType(
              {
                text,
                editor,
                document,
                position,
                linePrefix: document.lineAt(position.line).text.slice(0, position.character),
              },
              vscode,
              context,
            );
          } catch (err) {
            console.error(`[vsceasy typingGuard:${def.id ?? id}] onType failed:`, err);
            continue;
          }
          if (verdict === false) return;
          if (verdict && typeof verdict === 'object') {
            if ('block' in verdict && verdict.block) {
              if (verdict.message) vscode.window.setStatusBarMessage(verdict.message, 2000);
              return;
            }
            if ('insert' in verdict) {
              // Feed the substitution through the remaining guards.
              text = verdict.insert;
            }
          }
        }
        return vscode.commands.executeCommand('default:type', { text });
        }),
      ),
    );
  }

  if (entries.some(([, d]) => d.onDelete)) {
    /**
     * Deletions never reach the `type` override — VS Code routes each one as
     * its own command. Override them individually; when every guard allows,
     * `applyDeletion` performs the edit, because (unlike `type`) these commands
     * have no `default:` twin to delegate back to.
     */
    const DELETE_COMMANDS: Array<{ command: string; kind: DeleteEvent['kind'] }> = [
      { command: 'deleteLeft', kind: 'deleteLeft' },
      { command: 'deleteRight', kind: 'deleteRight' },
      { command: 'deleteWordLeft', kind: 'deleteWordLeft' },
      { command: 'deleteWordRight', kind: 'deleteWordRight' },
      { command: 'editor.action.clipboardCutAction', kind: 'cut' },
    ];

    for (const { command, kind } of DELETE_COMMANDS) {
      context.subscriptions.push(
        vscode.commands.registerCommand(command, () =>
          serialize(async () => {
            const editor = vscode.window.activeTextEditor;
            // There is NO `default:deleteLeft` — VS Code only provides
            // `default:` twins for `type`, `cut`, `copy` and `paste`. Once we
            // override a delete command we own it, so the deletion has to be
            // performed through the edit API.
            const fallback = () => applyDeletion(editor, kind);
            if (!editor) return fallback();

            const document = editor.document;
            const position = editor.selection.active;
            const hasSelection = !editor.selections.every((s) => s.isEmpty);

            for (const [id, def] of entries) {
              if (!def.onDelete || !active(def, document)) continue;
              let verdict: TypingVerdict;
              try {
                verdict = await def.onDelete(
                  {
                    kind,
                    editor,
                    document,
                    position,
                    text: deletionText(editor, kind),
                    hasSelection,
                  },
                  vscode,
                  context,
                );
              } catch (err) {
                console.error(`[vsceasy typingGuard:${def.id ?? id}] onDelete failed:`, err);
                continue;
              }
              if (verdict === false) return;
              if (verdict && typeof verdict === 'object' && 'block' in verdict && verdict.block) {
                if (verdict.message) vscode.window.setStatusBarMessage(verdict.message, 2000);
                return;
              }
            }
            return fallback();
          }),
        ),
      );
    }
  }

  if (entries.some(([, d]) => d.onPaste)) {
    /**
     * Overriding `editor.action.clipboardPasteAction` claims paste for the
     * WHOLE window, webview inputs and terminal included — and unlike `type`
     * there is no `default:` twin to hand it back to. A guard that owns it
     * permanently therefore breaks Cmd+V everywhere it does not apply.
     *
     * So the command is registered only while some guard is actually enabled,
     * and disposed the moment none is. `enabled` is re-checked whenever the
     * active editor changes, which is when focus could have moved into or out
     * of a guarded document.
     */
    let override: vscode.Disposable | undefined;

    const pasteHandler = async () => {
      const editor = vscode.window.activeTextEditor;
      // Focus left the editor between the check and the keypress.
      if (!editor) return;
      const document = editor.document;
      const text = await vscode.env.clipboard.readText();

      for (const [id, def] of entries) {
        if (!def.onPaste || !active(def, document)) continue;
        let verdict: TypingVerdict;
        try {
          verdict = await def.onPaste({ text, editor, document }, vscode, context);
        } catch (err) {
          console.error(`[vsceasy typingGuard:${def.id ?? id}] onPaste failed:`, err);
          continue;
        }
        if (verdict === false) return;
        if (verdict && typeof verdict === 'object') {
          if ('block' in verdict && verdict.block) {
            if (verdict.message) vscode.window.showWarningMessage(verdict.message);
            return;
          }
          if ('insert' in verdict) {
            await editor.edit((b) => {
              for (const sel of editor.selections) b.replace(sel, verdict.insert);
            });
            return;
          }
        }
      }
      // Allowed: perform the paste, since we own the command and there is no
      // default to fall back on.
      await editor.edit((b) => {
        for (const sel of editor.selections) b.replace(sel, text);
      });
    };

    const sync = () => {
      const doc = vscode.window.activeTextEditor?.document;
      const wanted = !!doc && entries.some(([, d]) => d.onPaste && active(d, doc));
      if (wanted && !override) {
        override = vscode.commands.registerCommand(
          'editor.action.clipboardPasteAction',
          pasteHandler,
        );
      } else if (!wanted && override) {
        override.dispose();
        override = undefined;
      }
    };

    sync();
    pasteSyncers.add(sync);
    context.subscriptions.push(
      vscode.window.onDidChangeActiveTextEditor(sync),
      vscode.workspace.onDidOpenTextDocument(sync),
      {
        dispose: () => {
          pasteSyncers.delete(sync);
          override?.dispose();
        },
      },
    );
  }

  const observers = entries.filter(([, d]) => d.onChange);
  if (observers.length) {
    context.subscriptions.push(
      vscode.workspace.onDidChangeTextDocument((e) => {
        for (const [id, def] of observers) {
          if (!active(def, e.document)) continue;
          try {
            def.onChange!(e, vscode, context);
          } catch (err) {
            console.error(`[vsceasy typingGuard:${def.id ?? id}] onChange failed:`, err);
          }
        }
      }),
    );
  }
}

/**
 * Best-effort reconstruction of what a delete command would remove. Exact for a
 * selection and for single-character deletes; the word-wise variants use the
 * editor's own word boundaries, which is what VS Code deletes in practice.
 */
function deletionText(editor: vscode.TextEditor, kind: DeleteEvent['kind']): string {
  const doc = editor.document;
  const sel = editor.selection;
  if (!sel.isEmpty) return doc.getText(sel);

  const pos = sel.active;
  const line = doc.lineAt(pos.line);

  switch (kind) {
    case 'deleteLeft': {
      // At column 0 backspace joins with the previous line.
      if (pos.character === 0) return pos.line === 0 ? '' : '\n';
      return line.text.slice(pos.character - 1, pos.character);
    }
    case 'deleteRight': {
      if (pos.character >= line.text.length) {
        return pos.line >= doc.lineCount - 1 ? '' : '\n';
      }
      return line.text.slice(pos.character, pos.character + 1);
    }
    case 'deleteWordLeft': {
      const range = pos.character > 0 ? doc.getWordRangeAtPosition(pos.translate(0, -1)) : undefined;
      return range ? doc.getText(range.with(undefined, pos)) : line.text.slice(0, pos.character);
    }
    case 'deleteWordRight': {
      const range = doc.getWordRangeAtPosition(pos);
      return range ? doc.getText(range.with(pos)) : line.text.slice(pos.character);
    }
    default:
      return '';
  }
}

/**
 * Perform a deletion ourselves.
 *
 * Overriding `deleteLeft` and friends means we own them: unlike `type`, VS Code
 * exposes no `default:deleteLeft` to hand the work back to, so calling one
 * throws "command not found" and the user simply cannot delete.
 *
 * Handles every selection in the editor so multi-cursor keeps working.
 */
async function applyDeletion(
  editor: vscode.TextEditor | undefined,
  kind: DeleteEvent['kind'],
): Promise<void> {
  if (!editor) return;
  if (kind === 'cut') return cutSelection(editor);

  const doc = editor.document;
  const ranges = editor.selections.map((sel) => {
    // A non-empty selection is deleted as-is, whichever key was pressed.
    if (!sel.isEmpty) return new vscode.Range(sel.start, sel.end);

    const pos = sel.active;
    const line = doc.lineAt(pos.line);

    switch (kind) {
      case 'deleteLeft': {
        // At column 0, backspace joins with the end of the previous line.
        if (pos.character === 0) {
          if (pos.line === 0) return undefined;
          const prev = doc.lineAt(pos.line - 1);
          return new vscode.Range(prev.range.end, pos);
        }
        return new vscode.Range(pos.translate(0, -1), pos);
      }
      case 'deleteRight': {
        if (pos.character >= line.text.length) {
          if (pos.line >= doc.lineCount - 1) return undefined;
          return new vscode.Range(pos, new vscode.Position(pos.line + 1, 0));
        }
        return new vscode.Range(pos, pos.translate(0, 1));
      }
      case 'deleteWordLeft': {
        const word = pos.character > 0 ? doc.getWordRangeAtPosition(pos.translate(0, -1)) : undefined;
        // No word before the cursor (whitespace, punctuation), or one that
        // starts exactly at it and would give an empty range: fall back to a
        // single character, which beats doing nothing.
        if (!word || word.start.isEqual(pos)) {
          return pos.character === 0
            ? pos.line === 0
              ? undefined
              : new vscode.Range(doc.lineAt(pos.line - 1).range.end, pos)
            : new vscode.Range(pos.translate(0, -1), pos);
        }
        return new vscode.Range(word.start, pos);
      }
      case 'deleteWordRight': {
        const word = doc.getWordRangeAtPosition(pos);
        // `word.end === pos` when the cursor sits just *after* a word, which
        // would produce an empty range and delete nothing. Treat that like
        // having no word: step forward one character instead.
        if (!word || word.end.isEqual(pos)) {
          return pos.character >= line.text.length
            ? pos.line >= doc.lineCount - 1
              ? undefined
              : new vscode.Range(pos, new vscode.Position(pos.line + 1, 0))
            : new vscode.Range(pos, pos.translate(0, 1));
        }
        return new vscode.Range(pos, word.end);
      }
      default:
        return undefined;
    }
  });

  const toDelete = ranges.filter((r): r is vscode.Range => !!r && !r.isEmpty);
  if (!toDelete.length) return;

  await editor.edit((b) => {
    for (const range of toDelete) b.delete(range);
  });
}

/** Perform a clipboard cut, since `editor.action.clipboardCutAction` has no `default:` twin. */
async function cutSelection(editor: vscode.TextEditor | undefined): Promise<void> {
  if (!editor) return;
  const doc = editor.document;
  // VS Code cuts the whole line when the selection is empty.
  const ranges = editor.selections.map((s) =>
    s.isEmpty ? doc.lineAt(s.active.line).rangeIncludingLineBreak : new vscode.Range(s.start, s.end),
  );
  await vscode.env.clipboard.writeText(ranges.map((r) => doc.getText(r)).join(''));
  await editor.edit((b) => {
    for (const r of ranges) b.delete(r);
  });
}

// --- Decorations ---

/**
 * Re-evaluators for the paste override — see `refreshTypingGuards`.
 *
 * A guard's `enabled` usually tracks session state, which changes with no
 * editor event to hang off.
 */
const pasteSyncers = new Set<() => void>();

/**
 * Re-evaluate whether typing guards should currently own paste.
 *
 * Call it when a guard's `enabled` result changes — starting or finishing a
 * session, typically. Without it the paste override can stay registered after
 * a guard goes inactive, which breaks Cmd+V in webviews and the terminal.
 */
export function refreshTypingGuards(): void {
  for (const sync of pasteSyncers) {
    try {
      sync();
    } catch {
      // One bad guard must not stop the others being re-evaluated.
    }
  }
}

/** Manual refresh handles, keyed by decoration id — see `refreshDecoration`. */
const decorationRefreshers = new Map<string, () => void>();

/**
 * Force a decoration to recompute. Works for any def, and is the only way to
 * redraw one declared with `on: ['manual']`.
 */
export function refreshDecoration(id: string): void {
  decorationRefreshers.get(id)?.();
}

function toDecorationRenderOptions(style: DecorationStyle, context: vscode.ExtensionContext): vscode.DecorationRenderOptions {
  const path = require('path') as typeof import('path');
  const toUri = (p: string) =>
    path.isAbsolute(p) ? vscode.Uri.file(p) : vscode.Uri.joinPath(context.extensionUri, p);
  return {
    color: style.color,
    backgroundColor: style.backgroundColor,
    border: style.border,
    borderRadius: style.borderRadius,
    fontStyle: style.fontStyle,
    fontWeight: style.fontWeight,
    textDecoration: style.textDecoration,
    opacity: style.opacity,
    isWholeLine: style.isWholeLine,
    ...(style.after ? { after: style.after } : {}),
    ...(style.before ? { before: style.before } : {}),
    ...(style.gutterIconPath ? { gutterIconPath: toUri(style.gutterIconPath) } : {}),
    ...(style.gutterIconSize ? { gutterIconSize: style.gutterIconSize } : {}),
    ...(style.overviewRulerColor
      ? {
          overviewRulerColor: style.overviewRulerColor,
          overviewRulerLane: vscode.OverviewRulerLane.Right,
        }
      : {}),
  };
}

function registerDecoration(
  context: vscode.ExtensionContext,
  registry: Registry,
  id: string,
  def: DecorationDef,
) {
  const defId = def.id ?? id;
  const base = vscode.window.createTextEditorDecorationType(
    toDecorationRenderOptions(def.style, context),
  );
  context.subscriptions.push(base);

  // Spans carrying their own style need their own decoration type; they're
  // created lazily and cached by serialised style so we don't leak one per redraw.
  const variants = new Map<string, vscode.TextEditorDecorationType>();
  const variantFor = (style: DecorationStyle) => {
    const key = JSON.stringify(style);
    let t = variants.get(key);
    if (!t) {
      t = vscode.window.createTextEditorDecorationType(
        toDecorationRenderOptions({ ...def.style, ...style }, context),
      );
      variants.set(key, t);
      context.subscriptions.push(t);
    }
    return t;
  };

  let timer: NodeJS.Timeout | undefined;
  const apply = async (editor: vscode.TextEditor | undefined) => {
    if (!editor || !matchesSelector(editor.document, def.selector)) return;
    let spans: DecorationSpan[];
    try {
      spans = await def.compute(editor, vscode, context);
    } catch (err) {
      console.error(`[vsceasy decoration:${defId}] compute failed:`, err);
      return;
    }
    // The editor may have been closed while compute was awaiting.
    if (!vscode.window.visibleTextEditors.includes(editor)) return;

    const grouped = new Map<vscode.TextEditorDecorationType, vscode.DecorationOptions[]>();
    grouped.set(base, []);
    for (const t of variants.values()) grouped.set(t, []);

    for (const s of spans) {
      // A span past the end of the document would be silently relocated by
      // VS Code, so clamp both axes to something that actually exists — the
      // decoration then lands where the caller can predict.
      const line = Math.max(0, Math.min(s.line, editor.document.lineCount - 1));
      const lineText = editor.document.lineAt(line).text;
      const startChar = Math.max(0, Math.min(s.startChar ?? 0, lineText.length));
      const endChar = Math.max(startChar, Math.min(s.endChar ?? lineText.length, lineText.length));
      const range = new vscode.Range(line, startChar, line, endChar);
      const opt: vscode.DecorationOptions = { range };
      if (s.hover) opt.hoverMessage = new vscode.MarkdownString(s.hover);
      const target = s.style ? variantFor(s.style) : base;
      (grouped.get(target) ?? grouped.set(target, []).get(target)!).push(opt);
    }
    // Every type must be set — including the empty ones, which is how stale
    // decorations get cleared.
    for (const [type, opts] of grouped) editor.setDecorations(type, opts);
  };

  const refresh = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => void apply(vscode.window.activeTextEditor), def.debounceMs ?? 50);
  };
  decorationRefreshers.set(defId, refresh);
  context.subscriptions.push({
    dispose: () => {
      if (timer) clearTimeout(timer);
      decorationRefreshers.delete(defId);
    },
  });

  const on = def.on ?? ['changeActiveEditor', 'changeDocument'];
  if (on.includes('changeActiveEditor')) {
    context.subscriptions.push(
      vscode.window.onDidChangeActiveTextEditor((e) => void apply(e)),
    );
  }
  if (on.includes('changeDocument')) {
    context.subscriptions.push(
      vscode.workspace.onDidChangeTextDocument((e) => {
        if (e.document === vscode.window.activeTextEditor?.document) refresh();
      }),
    );
  }
  if (on.includes('changeSelection')) {
    context.subscriptions.push(
      vscode.window.onDidChangeTextEditorSelection((e) => {
        if (e.textEditor === vscode.window.activeTextEditor) refresh();
      }),
    );
  }
  if (def.watch) {
    const off = def.watch(refresh, vscode, context);
    if (off) context.subscriptions.push({ dispose: off });
  }

  void apply(vscode.window.activeTextEditor);
}

// --- Terminals ---

const terminalHandles = new Map<string, TerminalHandle>();

/**
 * Get the handle for a terminal declared in `src/terminals/`. Returns undefined
 * before activate has run, or when no such terminal exists.
 */
export function useTerminal(id: string): TerminalHandle | undefined {
  return terminalHandles.get(id);
}

function defaultCwd(): string | undefined {
  return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
}

function registerTerminal(context: vscode.ExtensionContext, id: string, def: TerminalDef) {
  const defId = def.id ?? id;
  const name = def.title ?? defId;
  let visible: vscode.Terminal | undefined;

  const ensureVisible = () => {
    // A terminal the user closed is disposed but our reference survives.
    if (!visible || visible.exitStatus !== undefined) {
      // Deliberately NOT `def.env`: that carries parsing-friendly settings like
      // NO_COLOR, which would strip the colour the user relies on to read a
      // failing test run.
      visible = vscode.window.createTerminal({
        name,
        cwd: def.cwd ?? defaultCwd(),
        env: def.terminalEnv,
      });
    }
    return visible;
  };

  const handle: TerminalHandle = {
    exec: (command, opts = {}) =>
      execCommand(command, {
        cwd: opts.cwd ?? def.cwd ?? defaultCwd(),
        env: { ...def.env, ...opts.env },
        timeoutMs: opts.timeoutMs ?? def.timeoutMs ?? 60_000,
        shell: def.shell,
        onData: opts.onData,
      }),
    send: (command, opts = {}) => {
      const t = ensureVisible();
      if (opts.show !== false) t.show(true);
      t.sendText(command, true);
    },
    show: () => ensureVisible().show(true),
    dispose: () => {
      visible?.dispose();
      visible = undefined;
    },
  };

  terminalHandles.set(defId, handle);
  context.subscriptions.push({
    dispose: () => {
      visible?.dispose();
      terminalHandles.delete(defId);
    },
  });

  if (def.run) {
    void Promise.resolve(def.run(handle, vscode, context)).catch((err) => {
      console.error(`[vsceasy terminal:${defId}] run failed:`, err);
    });
  }
}

function execCommand(
  command: string,
  opts: {
    cwd?: string;
    env?: Record<string, string>;
    timeoutMs: number;
    shell?: string;
    onData?: (chunk: string, stream: 'stdout' | 'stderr') => void;
  },
): Promise<TerminalRunResult> {
  const { spawn } = require('child_process') as typeof import('child_process');
  const startedAt = Date.now();
  return new Promise<TerminalRunResult>((resolve) => {
    const child = spawn(command, {
      cwd: opts.cwd,
      env: { ...process.env, ...opts.env },
      shell: opts.shell ?? true,
    });

    let stdout = '';
    let stderr = '';
    let timedOut = false;
    let settled = false;

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGKILL');
    }, opts.timeoutMs);

    const finish = (code: number | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ stdout, stderr, code, timedOut, durationMs: Date.now() - startedAt });
    };

    child.stdout?.on('data', (d: Buffer) => {
      const s = d.toString();
      stdout += s;
      opts.onData?.(s, 'stdout');
    });
    child.stderr?.on('data', (d: Buffer) => {
      const s = d.toString();
      stderr += s;
      opts.onData?.(s, 'stderr');
    });
    child.on('error', (err: Error) => {
      stderr += String(err.message);
      finish(null);
    });
    child.on('close', (code: number | null) => finish(code));
  });
}

// --- Jobs (recurring / event-triggered) ---

function registerJob(
  context: vscode.ExtensionContext,
  registry: Registry,
  id: string,
  def: JobDef,
) {
  const jobId = def.id ?? id;
  const lastRunKey = `vsceasy.job.${jobId}.lastRun`;

  const exec = async (reason: string) => {
    if (def.minIntervalMs) {
      const last = (context.globalState.get<number>(lastRunKey) ?? 0);
      if (Date.now() - last < def.minIntervalMs) return;
    }
    try {
      await def.run(vscode, context);
      await context.globalState.update(lastRunKey, Date.now());
    } catch (err) {
      console.error(`[vsceasy job:${jobId}] (${reason}) failed:`, err);
    }
  };

  const sched = def.schedule;
  if ('every' in sched) {
    const ms = parseDuration(sched.every);
    if (ms <= 0) throw new Error(`Job "${jobId}": invalid every=${sched.every}`);
    if (sched.runOnStart !== false) void exec('startup');
    const handle = setInterval(() => void exec('interval'), ms);
    context.subscriptions.push({ dispose: () => clearInterval(handle) });
    return;
  }
  if ('dailyAt' in sched) {
    const [hStr, mStr] = sched.dailyAt.split(':');
    const h = Number(hStr);
    const m = Number(mStr ?? '0');
    if (!Number.isFinite(h) || !Number.isFinite(m)) {
      throw new Error(`Job "${jobId}": invalid dailyAt=${sched.dailyAt} (expected "HH:MM")`);
    }
    let timer: NodeJS.Timeout | undefined;
    const scheduleNext = () => {
      const next = new Date();
      next.setHours(h, m, 0, 0);
      if (next.getTime() <= Date.now()) next.setDate(next.getDate() + 1);
      timer = setTimeout(async () => {
        await exec('dailyAt');
        scheduleNext();
      }, next.getTime() - Date.now());
    };
    scheduleNext();
    context.subscriptions.push({ dispose: () => { if (timer) clearTimeout(timer); } });
    return;
  }
  if ('on' in sched) {
    let sub: vscode.Disposable;
    switch (sched.on) {
      case 'startup':
        void exec('startup');
        return;
      case 'saveDocument':
        sub = vscode.workspace.onDidSaveTextDocument(() => void exec('saveDocument'));
        break;
      case 'openDocument':
        sub = vscode.workspace.onDidOpenTextDocument(() => void exec('openDocument'));
        break;
      case 'changeActiveEditor':
        sub = vscode.window.onDidChangeActiveTextEditor(() => void exec('changeActiveEditor'));
        break;
      case 'changeConfig':
        sub = vscode.workspace.onDidChangeConfiguration(() => void exec('changeConfig'));
        break;
      default:
        throw new Error(`Job "${jobId}": unknown on=${(sched as { on: string }).on}`);
    }
    context.subscriptions.push(sub);
    return;
  }
  if ('onFile' in sched) {
    const watcher = vscode.workspace.createFileSystemWatcher(sched.onFile);
    watcher.onDidChange(() => void exec('onFile:change'));
    watcher.onDidCreate(() => void exec('onFile:create'));
    watcher.onDidDelete(() => void exec('onFile:delete'));
    context.subscriptions.push(watcher);
    return;
  }
}

const DURATION_RE = /^(\d+)\s*(ms|s|m|h|d)?$/;

function parseDuration(input: string | number): number {
  if (typeof input === 'number') return input;
  const m = DURATION_RE.exec(input.trim());
  if (!m) return -1;
  const n = Number(m[1]);
  switch (m[2] ?? 'ms') {
    case 'ms': return n;
    case 's': return n * 1000;
    case 'm': return n * 60_000;
    case 'h': return n * 3_600_000;
    case 'd': return n * 86_400_000;
    default: return -1;
  }
}

// --- Tree Views (data-driven) ---

function registerTreeView(
  context: vscode.ExtensionContext,
  registry: Registry,
  id: string,
  def: TreeViewDef,
) {
  const viewId = `${registry.prefix}-${def.menu}-${def.id ?? id}`;
  const provider = new DataTreeProvider(def, context);
  const view = vscode.window.createTreeView(viewId, {
    treeDataProvider: provider,
    showCollapseAll: def.showCollapseAll !== false,
  });
  context.subscriptions.push(view);

  const refreshCmd = `${registry.prefix}._tree.${def.id ?? id}.refresh`;
  context.subscriptions.push(
    vscode.commands.registerCommand(refreshCmd, () => provider.refresh()),
  );

  // Keep the tree live: let the def subscribe to a data source and re-run
  // getChildren on change. The unsubscribe is disposed on deactivate.
  if (def.watch) {
    const off = def.watch(() => provider.refresh(), vscode, context);
    if (off) context.subscriptions.push({ dispose: off });
  }

  const dispatchCmd = `${registry.prefix}._tree.${def.id ?? id}.run`;
  context.subscriptions.push(
    vscode.commands.registerCommand(dispatchCmd, async (node: TreeNode) => {
      if (node.run) return node.run(vscode, context);
      if (node.panel) {
        const p = registry.panels[node.panel];
        if (p) return openPanel(context, registry.prefix, node.panel, p);
      }
      if (node.command) {
        const found = lookupCommand(registry, node.command);
        // Forward the node: a data-driven tree's command is almost always
        // about *which* item was clicked, and dropping it here would make
        // `TreeNode.command` useless for anything but a fixed action.
        if (found) return found.def.run(vscode, context, node);
      }
    }),
  );
  provider.setDispatchCommand(dispatchCmd);
}

class DataTreeProvider implements vscode.TreeDataProvider<TreeNode> {
  private _onDidChange = new vscode.EventEmitter<TreeNode | undefined>();
  readonly onDidChangeTreeData = this._onDidChange.event;
  private dispatchCmd = '';

  constructor(private readonly def: TreeViewDef, private readonly context: vscode.ExtensionContext) {}

  setDispatchCommand(cmd: string) {
    this.dispatchCmd = cmd;
  }

  refresh() {
    this._onDidChange.fire(undefined);
  }

  getTreeItem(node: TreeNode): vscode.TreeItem {
    // A node is collapsible only if it actually has children, or says it will
    // load them lazily. Treating an absent `children` as lazy would decorate
    // every leaf with an expand arrow that opens nothing.
    const collapsible = !!node.children?.length || node.expandable === true;
    const state = collapsible
      ? node.collapsed === 'expanded'
        ? vscode.TreeItemCollapsibleState.Expanded
        : vscode.TreeItemCollapsibleState.Collapsed
      : vscode.TreeItemCollapsibleState.None;
    const item = new vscode.TreeItem(node.label, state);
    item.id = node.id;
    item.tooltip = node.tooltip;
    item.description = node.description;
    item.contextValue = node.contextValue;
    item.iconPath = resolveIcon(this.context, node.icon);
    if (this.dispatchCmd && (node.run || node.panel || node.command)) {
      item.command = { command: this.dispatchCmd, title: node.label, arguments: [node] };
    }
    return item;
  }

  async getChildren(node?: TreeNode): Promise<TreeNode[]> {
    if (node?.children) return node.children;
    return Promise.resolve(this.def.getChildren(node, vscode, this.context));
  }
}

// --- Webview Views (sidebar inline) ---

function registerSubpanel(
  context: vscode.ExtensionContext,
  registry: Registry,
  id: string,
  def: SubpanelDef,
) {
  // Must match the view id gen.ts writes into package.json#views.<container>.
  const viewId = `${registry.prefix}-${def.menu}-${def.id ?? id}`;
  const provider: vscode.WebviewViewProvider = {
    resolveWebviewView(view) {
      view.webview.options = {
        enableScripts: true,
        localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, 'dist', 'webview')],
      };
      const ui = def.ui ?? `subpanels/${def.id ?? id}`;
      view.webview.html = renderHtml(view.webview, context, ui, def.title);
      if (def.rpc) {
        let server: ReturnType<typeof createRpcServer> | undefined;
        const emit = (topic: string, payload?: unknown) => server?.emit(topic, payload);
        const handlers = def.rpc(vscode, context, emit);
        server = createRpcServer(webviewTransport(view.webview), handlers);
        view.onDidDispose(() => server!.dispose());
      }
    },
  };
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(viewId, provider, {
      webviewOptions: { retainContextWhenHidden: def.retainContext ?? true },
    }),
  );
}

// --- Status bar items ---

function registerStatusBar(
  context: vscode.ExtensionContext,
  registry: Registry,
  id: string,
  def: StatusBarDef,
) {
  const alignment = def.alignment === 'right'
    ? vscode.StatusBarAlignment.Right
    : vscode.StatusBarAlignment.Left;
  const item = vscode.window.createStatusBarItem(alignment, def.priority ?? 100);

  const setTooltip = (plain?: string, markdown?: string) => {
    // Tooltip: markdown takes precedence over plain string
    if (markdown) {
      const md = new vscode.MarkdownString(markdown, true);
      md.supportHtml = true;
      md.isTrusted = true;
      item.tooltip = md;
    } else if (plain) {
      item.tooltip = plain;
    } else {
      item.tooltip = undefined;
    }
  };

  /** Paint the item from the static def, overlaid with `render`'s live state. */
  const paint = () => {
    let state: StatusBarState | undefined;
    if (def.render) {
      try {
        state = def.render(vscode, context);
      } catch (err) {
        console.error(`[vsceasy statusBar:${def.id ?? id}] render failed:`, err);
      }
    }
    const text = state?.text ?? def.text;
    item.text = def.icon ? `$(${def.icon}) ${text}` : text;
    setTooltip(state?.tooltip ?? def.tooltip, state?.tooltipMarkdown ?? def.tooltipMarkdown);
    const bg = state?.backgroundColor ?? def.backgroundColor;
    item.backgroundColor = bg ? new vscode.ThemeColor(bg) : undefined;
    if (state?.visible === false) item.hide();
    else item.show();
  };

  // Click behaviour priority: menu > panel > command
  if (def.menu && def.menu.length > 0) {
    const dispatchCmd = `${registry.prefix}._statusBar.${id}.click`;
    context.subscriptions.push(
      vscode.commands.registerCommand(dispatchCmd, () => openStatusBarMenu(context, registry, def.menu!)),
    );
    item.command = dispatchCmd;
  } else if (def.panel) {
    const panelDef = registry.panels[def.panel];
    if (panelDef) {
      const suffix = capitalize(panelDef.id ?? def.panel);
      item.command = `${registry.prefix}.open${suffix}`;
    } else {
      console.warn(`[vsceasy] statusBar "${id}" references unknown panel "${def.panel}"`);
    }
  } else if (def.command) {
    const found = lookupCommand(registry, def.command);
    item.command = found ? `${registry.prefix}.${found.def.id ?? found.key}` : def.command;
  }

  paint();
  if (def.watch) {
    const off = def.watch(paint, vscode, context);
    if (off) context.subscriptions.push({ dispose: off });
  }
  context.subscriptions.push(item);
}

async function openStatusBarMenu(
  context: vscode.ExtensionContext,
  registry: Registry,
  items: StatusBarMenuItem[],
) {
  type QP = vscode.QuickPickItem & { __item: StatusBarMenuItem };
  const picks: QP[] = items.map((it) => ({
    label: it.label,
    description: it.description,
    detail: it.detail,
    __item: it,
  }));
  const selected = await vscode.window.showQuickPick(picks, { placeHolder: 'Choose action' });
  if (!selected) return;
  const it = selected.__item;
  if (it.url) {
    await vscode.env.openExternal(vscode.Uri.parse(it.url));
    return;
  }
  if (it.panel) {
    const panelDef = registry.panels[it.panel];
    if (panelDef) {
      const cmd = `${registry.prefix}.open${capitalize(panelDef.id ?? it.panel)}`;
      await vscode.commands.executeCommand(cmd);
    }
    return;
  }
  if (it.command) {
    const found = lookupCommand(registry, it.command);
    await vscode.commands.executeCommand(
      found ? `${registry.prefix}.${found.def.id ?? found.key}` : it.command,
    );
  }
}

// --- Menus ---

function registerMenu(
  context: vscode.ExtensionContext,
  registry: Registry,
  id: string,
  def: MenuDef,
) {
  // Must match the id gen.ts writes into package.json#viewsContainers/views.
  // VS Code disallows '.' in view ids, so we use '-' as separator.
  const viewId = `${registry.prefix}-${def.id ?? id}`;
  const provider = new MenuTreeDataProvider(def.items, context);
  const view = vscode.window.createTreeView(viewId, {
    treeDataProvider: provider,
    showCollapseAll: true,
  });
  context.subscriptions.push(view);

  // Single dispatch command per menu — passes the item through arguments[0] of contributes.commands.
  const dispatchCmd = `${registry.prefix}._menu.${def.id ?? id}.run`;
  context.subscriptions.push(
    vscode.commands.registerCommand(dispatchCmd, (item: MenuItem) =>
      dispatchMenuItem(context, registry, item),
    ),
  );

  provider.setDispatchCommand(dispatchCmd);
}

/**
 * Find a command by the key the registry uses (its filename) or by the `id`
 * declared on the def. A menu that references the declared id would otherwise
 * fail at runtime with "unknown command", because the registry is keyed by
 * filename and the two are free to differ.
 */
function lookupCommand(
  registry: Registry,
  ref: string,
): { key: string; def: CommandDef } | undefined {
  const direct = registry.commands[ref];
  if (direct) return { key: ref, def: direct };
  for (const [key, def] of Object.entries(registry.commands)) {
    if (def.id === ref) return { key, def };
  }
  return undefined;
}

async function dispatchMenuItem(
  context: vscode.ExtensionContext,
  registry: Registry,
  item: MenuItem,
) {
  if (item.url) {
    await vscode.env.openExternal(vscode.Uri.parse(item.url));
    return;
  }
  if (item.panel) {
    const panel = registry.panels[item.panel];
    if (!panel) {
      vscode.window.showErrorMessage(`Menu item references unknown panel: ${item.panel}`);
      return;
    }
    openPanel(context, registry.prefix, item.panel, panel);
    return;
  }
  if (item.command) {
    const found = lookupCommand(registry, item.command);
    if (!found) {
      vscode.window.showErrorMessage(`Menu item references unknown command: ${item.command}`);
      return;
    }
    await found.def.run(vscode, context);
    return;
  }
  if (item.run) {
    await item.run(vscode, context);
    return;
  }
}

class MenuTreeDataProvider implements vscode.TreeDataProvider<MenuItem> {
  private _onDidChange = new vscode.EventEmitter<MenuItem | undefined>();
  readonly onDidChangeTreeData = this._onDidChange.event;
  private dispatchCmd = '';

  constructor(private readonly items: MenuItem[], private readonly context: vscode.ExtensionContext) {}

  setDispatchCommand(cmd: string) {
    this.dispatchCmd = cmd;
    this._onDidChange.fire(undefined);
  }

  getTreeItem(item: MenuItem): vscode.TreeItem {
    const hasChildren = !!item.children?.length;
    const collapsibleState = hasChildren
      ? item.collapsed === 'collapsed'
        ? vscode.TreeItemCollapsibleState.Collapsed
        : vscode.TreeItemCollapsibleState.Expanded
      : vscode.TreeItemCollapsibleState.None;
    const node = new vscode.TreeItem(item.label, collapsibleState);
    node.tooltip = item.description ?? item.label;
    node.description = item.description;
    node.iconPath = resolveIcon(this.context, item.icon);
    if (!hasChildren && this.dispatchCmd) {
      node.command = {
        command: this.dispatchCmd,
        title: item.label,
        arguments: [item],
      };
    }
    return node;
  }

  getChildren(item?: MenuItem): MenuItem[] {
    if (!item) return this.items;
    return item.children ?? [];
  }
}

function resolveIcon(
  context: vscode.ExtensionContext,
  icon: MenuItem['icon'],
): vscode.TreeItem['iconPath'] {
  if (!icon) return undefined;
  if (typeof icon === 'string') return new vscode.ThemeIcon(icon);
  const path = require('path') as typeof import('path');
  const toUri = (p: string) =>
    path.isAbsolute(p) ? vscode.Uri.file(p) : vscode.Uri.joinPath(context.extensionUri, p);
  if ('path' in icon) return toUri(icon.path);
  return { light: toUri(icon.light), dark: toUri(icon.dark) };
}

function openPanel(context: vscode.ExtensionContext, prefix: string, id: string, def: PanelDef) {
  const key = `${prefix}.${def.id ?? id}`;
  const existing = openPanels.get(key);
  const column = resolveColumn(def.column);
  if (existing) {
    existing.reveal(column);
    return existing;
  }

  const panel = vscode.window.createWebviewPanel(
    key,
    def.title,
    column,
    {
      enableScripts: true,
      retainContextWhenHidden: def.retainContext ?? true,
      localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, 'dist', 'webview')],
    },
  );

  const ui = def.ui ?? `panels/${def.id ?? id}`;
  panel.webview.html = renderHtml(panel.webview, context, ui, def.title);

  if (def.rpc) {
    // `emit` is wired lazily: the rpc factory may call watch()/watchEntity()
    // immediately, but the server (and thus the real emit) only exists after.
    let server: ReturnType<typeof createRpcServer> | undefined;
    const emit = (topic: string, payload?: unknown) => server?.emit(topic, payload);
    const handlers = def.rpc(vscode, context, emit);
    server = createRpcServer(webviewTransport(panel.webview), handlers);
    panel.onDidDispose(() => server!.dispose());
  }

  openPanels.set(key, panel);
  panel.onDidDispose(() => openPanels.delete(key));
  return panel;
}

interface ViteManifestEntry {
  file: string;
  css?: string[];
  assets?: string[];
  imports?: string[];
}
type ViteManifest = Record<string, ViteManifestEntry>;

let cachedManifest: { mtime: number; data: ViteManifest } | null = null;

function loadManifest(extensionUri: vscode.Uri): ViteManifest | null {
  const fs = require('fs') as typeof import('fs');
  const path = require('path') as typeof import('path');
  // Vite manifest can land at either `manifest.json` (new) or `.vite/manifest.json` (default).
  const webviewRoot = vscode.Uri.joinPath(extensionUri, 'dist', 'webview').fsPath;
  for (const rel of ['manifest.json', '.vite/manifest.json']) {
    const p = path.join(webviewRoot, rel);
    if (!fs.existsSync(p)) continue;
    const mtime = fs.statSync(p).mtimeMs;
    if (cachedManifest?.mtime === mtime) return cachedManifest.data;
    cachedManifest = { mtime, data: JSON.parse(fs.readFileSync(p, 'utf8')) };
    return cachedManifest.data;
  }
  return null;
}

function resolveAssets(extensionUri: vscode.Uri, ui: string): { js: string[]; css: string[] } {
  const manifest = loadManifest(extensionUri);
  if (!manifest) {
    // Fallback to convention: <ui>/index.js + <ui>/index.css
    return { js: [`${ui}/index.js`], css: [`${ui}/index.css`] };
  }
  // Manifest keys for HTML entries look like `<ui>/index.html`.
  const key = `${ui}/index.html`;
  const entry = manifest[key];
  if (!entry) return { js: [`${ui}/index.js`], css: [] };
  const js = [entry.file];
  const css = [...(entry.css ?? [])];
  // Recursively pull CSS from imported chunks.
  const seen = new Set<string>();
  const walk = (imp: string) => {
    if (seen.has(imp)) return;
    seen.add(imp);
    const e = manifest[imp];
    if (!e) return;
    if (e.css) css.push(...e.css);
    e.imports?.forEach(walk);
  };
  entry.imports?.forEach(walk);
  return { js, css };
}

function renderHtml(webview: vscode.Webview, context: vscode.ExtensionContext, ui: string, title: string): string {
  const root = vscode.Uri.joinPath(context.extensionUri, 'dist', 'webview');
  const { js, css } = resolveAssets(context.extensionUri, ui);
  const toUri = (rel: string) =>
    webview.asWebviewUri(vscode.Uri.joinPath(root, ...rel.split('/'))).toString();
  const scriptTags = js
    .map((f) => `<script type="module" nonce="{{NONCE}}" src="${toUri(f)}"></script>`)
    .join('\n    ');
  const styleTags = css.map((f) => `<link rel="stylesheet" href="${toUri(f)}" />`).join('\n    ');
  const nonce = Array.from({ length: 16 }, () => Math.random().toString(36)[2]).join('');
  const csp = [
    `default-src 'none'`,
    `style-src ${webview.cspSource} 'unsafe-inline'`,
    `script-src 'nonce-${nonce}'`,
    `img-src ${webview.cspSource} https: data:`,
    `font-src ${webview.cspSource}`,
  ].join('; ');

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta http-equiv="Content-Security-Policy" content="${csp}" />
    ${styleTags}
    <title>${escapeHtml(title)}</title>
  </head>
  <body><div id="root"></div>
    ${scriptTags.replace(/\{\{NONCE\}\}/g, nonce)}
  </body>
</html>`;
}

function resolveColumn(c: PanelDef['column']): vscode.ViewColumn {
  switch (c) {
    case 'beside': return vscode.ViewColumn.Beside;
    case 'one': return vscode.ViewColumn.One;
    case 'two': return vscode.ViewColumn.Two;
    case 'three': return vscode.ViewColumn.Three;
    default: return vscode.window.activeTextEditor?.viewColumn ?? vscode.ViewColumn.One;
  }
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}
