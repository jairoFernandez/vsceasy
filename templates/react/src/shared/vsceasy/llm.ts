/**
 * Minimal LLM client for extensions — Ollama first, any OpenAI-compatible
 * endpoint second. No SDK dependency: everything goes through `fetch`, which
 * the extension host has had natively since VS Code 1.82 (Node 18).
 *
 *   const llm = createLlm({ provider: 'ollama', model: 'qwen2.5-coder' });
 *   const text = await llm.chat([{ role: 'user', content: 'hi' }]);
 *
 * `initLlm(context)` reads `<prefix>.llm.*` from VS Code settings instead, so
 * the host and model stay user-configurable, and `useLlm()` hands the shared
 * client to any module that needs it.
 */

export type LlmProvider = 'ollama' | 'openai';

export interface LlmOptions {
  /** Which wire protocol to speak. Default: 'ollama'. */
  provider?: LlmProvider;
  /** Base URL. Default: 'http://localhost:11434' (ollama) / 'https://api.openai.com/v1' (openai). */
  baseUrl?: string;
  /** Model name, e.g. 'qwen2.5-coder:7b' or 'gpt-4o-mini'. */
  model: string;
  /** Bearer token. Ignored by Ollama unless it sits behind a proxy. */
  apiKey?: string;
  /** Sampling temperature. Default: provider default. */
  temperature?: number;
  /** Cap on generated tokens. */
  maxTokens?: number;
  /** Abort a request after this many ms. Default: 60_000. */
  timeoutMs?: number;
}

export interface LlmMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LlmChatOptions {
  /** Per-call override of the configured model. */
  model?: string;
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
  /** Ask the model for strict JSON. Ollama: format=json. OpenAI: response_format. */
  json?: boolean;
  /** Stop sequences. */
  stop?: string[];
  /** Called with each token as it arrives. Presence enables streaming. */
  onToken?: (chunk: string) => void;
  /** Cancel an in-flight request. */
  signal?: AbortSignal;
}

export interface LlmModel {
  name: string;
  /** Size in bytes, when the provider reports it. */
  size?: number;
}

export interface LlmClient {
  /** The model this client defaults to. */
  readonly model: string;
  /** Full chat turn. Returns the assistant message content. */
  chat: (messages: LlmMessage[], opts?: LlmChatOptions) => Promise<string>;
  /** Single-prompt shorthand; `system` becomes a system message. */
  complete: (prompt: string, opts?: LlmChatOptions & { system?: string }) => Promise<string>;
  /** Chat that parses the reply as JSON. Throws if the model returns non-JSON. */
  json: <T = unknown>(messages: LlmMessage[], opts?: LlmChatOptions) => Promise<T>;
  /** List models the endpoint has available. */
  models: () => Promise<LlmModel[]>;
  /**
   * Reachability probe — never throws. Also checks that the configured model is
   * actually installed, reporting the one that will really be used.
   */
  ping: () => Promise<{ ok: boolean; model?: string; warning?: string; error?: string }>;
  /**
   * The model name requests will really use. On Ollama a configured name
   * without a tag resolves to an installed `name:tag`, and a missing model
   * falls back to an installed one.
   */
  resolveModel: () => Promise<string>;
}

const DEFAULT_BASE: Record<LlmProvider, string> = {
  ollama: 'http://localhost:11434',
  openai: 'https://api.openai.com/v1',
};

export function createLlm(options: LlmOptions): LlmClient {
  const provider = options.provider ?? 'ollama';
  const baseUrl = (options.baseUrl ?? DEFAULT_BASE[provider]).replace(/\/+$/, '');
  const defaultTimeout = options.timeoutMs ?? 60_000;

  const headers = (): Record<string, string> => ({
    'Content-Type': 'application/json',
    ...(options.apiKey ? { Authorization: `Bearer ${options.apiKey}` } : {}),
  });

  /** Merge the caller's signal with our own timeout so either can abort. */
  const withTimeout = (ms: number, external?: AbortSignal) => {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), ms);
    const onAbort = () => ctl.abort();
    external?.addEventListener('abort', onAbort);
    return {
      signal: ctl.signal,
      done: () => {
        clearTimeout(timer);
        external?.removeEventListener('abort', onAbort);
      },
    };
  };

  /**
   * Cache of the resolved model name, so the tag lookup happens once per client
   * rather than on every request.
   */
  let resolvedModel: string | undefined;

  /**
   * Ollama addresses models by their full `name:tag`. A configured
   * `qwen2.5-coder` does NOT match an installed `qwen2.5-coder:0.5b` — the
   * request 404s. Resolve the configured name against what's actually
   * installed, so a missing tag (or a model the user never pulled) degrades to
   * something that works instead of failing every call.
   */
  async function resolveModel(requested: string): Promise<string> {
    if (provider !== 'ollama') return requested;
    if (resolvedModel) return resolvedModel;

    let installed: LlmModel[];
    try {
      installed = await models();
    } catch {
      // Server unreachable — let the request itself produce the real error.
      return requested;
    }
    const names = installed.map((m) => m.name);
    if (!names.length) return requested;

    // Empty means "auto" — the user hasn't chosen, so pick something usable.
    if (!requested.trim()) {
      resolvedModel = pickFallback(names);
      return resolvedModel;
    }

    // Exact match wins.
    if (names.includes(requested)) {
      resolvedModel = requested;
      return resolvedModel;
    }
    // Configured without a tag: take the first installed tag of that model.
    if (!requested.includes(':')) {
      const tagged = names.find((n) => n.split(':')[0] === requested);
      if (tagged) {
        resolvedModel = tagged;
        console.warn(`[vsceasy llm] "${requested}" is not installed; using "${tagged}".`);
        return resolvedModel;
      }
    }
    // Nothing close — fall back to an installed model rather than 404ing.
    const fallback = pickFallback(names);
    console.warn(
      `[vsceasy llm] "${requested}" is not installed; falling back to "${fallback}". ` +
        `Installed: ${names.join(', ')}`,
    );
    resolvedModel = fallback;
    return resolvedModel;
  }

  async function chat(messages: LlmMessage[], opts: LlmChatOptions = {}): Promise<string> {
    const model = await resolveModel(opts.model ?? options.model);
    // Resolution may have to fetch the model list first; a caller who aborted
    // during that window must still get a rejection rather than a live request.
    if (opts.signal?.aborted) throw new Error('Request aborted');
    const stream = typeof opts.onToken === 'function';
    const t = withTimeout(opts.timeoutMs ?? defaultTimeout, opts.signal);

    const url = provider === 'ollama' ? `${baseUrl}/api/chat` : `${baseUrl}/chat/completions`;
    const body =
      provider === 'ollama'
        ? {
            model,
            messages,
            stream,
            ...(opts.json ? { format: 'json' } : {}),
            options: {
              ...(opts.temperature ?? options.temperature !== undefined
                ? { temperature: opts.temperature ?? options.temperature }
                : {}),
              ...(opts.maxTokens ?? options.maxTokens
                ? { num_predict: opts.maxTokens ?? options.maxTokens }
                : {}),
              ...(opts.stop ? { stop: opts.stop } : {}),
            },
          }
        : {
            model,
            messages,
            stream,
            ...(opts.temperature ?? options.temperature !== undefined
              ? { temperature: opts.temperature ?? options.temperature }
              : {}),
            ...(opts.maxTokens ?? options.maxTokens
              ? { max_tokens: opts.maxTokens ?? options.maxTokens }
              : {}),
            ...(opts.stop ? { stop: opts.stop } : {}),
            ...(opts.json ? { response_format: { type: 'json_object' } } : {}),
          };

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify(body),
        signal: t.signal,
      });
      if (!res.ok) {
        throw new Error(`LLM ${provider} ${res.status}: ${(await res.text()).slice(0, 400)}`);
      }
      if (!stream) {
        const data: any = await res.json();
        return provider === 'ollama'
          ? (data.message?.content ?? '')
          : (data.choices?.[0]?.message?.content ?? '');
      }
      return await readStream(res, provider, opts.onToken!);
    } finally {
      t.done();
    }
  }

  async function models(): Promise<LlmModel[]> {
    const t = withTimeout(10_000);
    try {
      const url = provider === 'ollama' ? `${baseUrl}/api/tags` : `${baseUrl}/models`;
      const res = await fetch(url, { headers: headers(), signal: t.signal });
      if (!res.ok) throw new Error(`LLM ${provider} ${res.status}: ${await res.text()}`);
      const data: any = await res.json();
      return provider === 'ollama'
        ? (data.models ?? []).map((m: any) => ({ name: m.name, size: m.size }))
        : (data.data ?? []).map((m: any) => ({ name: m.id }));
    } finally {
      t.done();
    }
  }

  return {
    model: options.model,
    chat,
    complete: (prompt, opts = {}) => {
      const { system, ...rest } = opts;
      const messages: LlmMessage[] = system
        ? [{ role: 'system', content: system }, { role: 'user', content: prompt }]
        : [{ role: 'user', content: prompt }];
      return chat(messages, rest);
    },
    json: async <T,>(messages: LlmMessage[], opts: LlmChatOptions = {}) => {
      const raw = await chat(messages, { ...opts, json: true });
      return parseJson<T>(raw);
    },
    models,
    resolveModel: () => resolveModel(options.model),
    ping: async () => {
      try {
        const installed = await models();
        // Reaching the server isn't enough: the configured model has to exist,
        // or every call 404s while `ping` cheerfully reports OK.
        if (provider === 'ollama' && installed.length) {
          const names = installed.map((m) => m.name);
          const actual = await resolveModel(options.model);
          // An empty setting is "auto", not a mismatch — don't warn about it.
          if (options.model.trim() && !names.includes(options.model)) {
            return {
              ok: true,
              model: actual,
              warning: `"${options.model}" is not installed — using "${actual}".`,
            };
          }
          return { ok: true, model: actual };
        }
        return { ok: true, model: options.model };
      } catch (err) {
        return { ok: false, error: (err as Error).message };
      }
    },
  };
}

/**
 * Choose the most useful installed model when the configured one is missing.
 * Prefers coding models, then general chat models; never picks an embedding
 * model (it can't chat) or a `:cloud` alias (it needs credentials).
 */
function pickFallback(names: string[]): string {
  const usable = names.filter((n) => !/embed/i.test(n) && !/:cloud$/i.test(n));
  const pool = usable.length ? usable : names;
  return pool.find((n) => /cod(er|e)/i.test(n)) ?? pool[0];
}

/** Read an NDJSON (ollama) or SSE (openai) stream, feeding tokens to `onToken`. */
async function readStream(
  res: Response,
  provider: LlmProvider,
  onToken: (chunk: string) => void,
): Promise<string> {
  const reader = res.body?.getReader();
  if (!reader) return '';
  const decoder = new TextDecoder();
  let buffer = '';
  let full = '';

  const handleLine = (line: string) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    let payload = trimmed;
    if (provider === 'openai') {
      if (!trimmed.startsWith('data:')) return;
      payload = trimmed.slice(5).trim();
      if (payload === '[DONE]') return;
    }
    let obj: any;
    try {
      obj = JSON.parse(payload);
    } catch {
      // Partial frame — the next chunk completes it.
      return;
    }
    const piece =
      provider === 'ollama' ? (obj.message?.content ?? '') : (obj.choices?.[0]?.delta?.content ?? '');
    if (piece) {
      full += piece;
      onToken(piece);
    }
  };

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    for (const line of lines) handleLine(line);
  }
  if (buffer) handleLine(buffer);
  return full;
}

/**
 * Parse a model's reply as JSON, tolerating the ```json fences and stray prose
 * small local models still emit even in JSON mode.
 */
function parseJson<T>(raw: string): T {
  const text = raw.trim();
  const attempts = [text];

  const fenced = /```(?:json)?\s*([\s\S]*?)```/.exec(text);
  if (fenced) attempts.push(fenced[1].trim());

  // Last resort: the outermost {...} or [...] in the reply.
  const first = text.search(/[[{]/);
  const lastObj = text.lastIndexOf('}');
  const lastArr = text.lastIndexOf(']');
  const last = Math.max(lastObj, lastArr);
  if (first !== -1 && last > first) attempts.push(text.slice(first, last + 1));

  for (const candidate of attempts) {
    try {
      return JSON.parse(candidate) as T;
    } catch {
      // try the next shape
    }
  }
  throw new Error(`LLM did not return valid JSON. Got: ${text.slice(0, 300)}`);
}

// --- Shared instance, configured from VS Code settings ---

let shared: LlmClient | undefined;

/**
 * Build the shared client from `<section>.llm.*` settings and hand it back.
 * Call from `bootstrap`'s `onActivate`:
 *
 *   export const activate = bootstrap(registry, { onActivate: [initLlm] });
 *
 * Settings read (declare them in contributes.extra.json):
 *   <section>.llm.provider   'ollama' | 'openai'
 *   <section>.llm.baseUrl    string
 *   <section>.llm.model      string
 *   <section>.llm.apiKey     string
 *   <section>.llm.temperature number
 *
 * The client is rebuilt automatically when any of those change.
 */
export function initLlm(
  context: { subscriptions: Array<{ dispose(): unknown }> },
  vscodeApi?: typeof import('vscode'),
  section?: string,
): LlmClient {
  // `bootstrap` calls activate hooks as `(context, vscode)`, so a hook written
  // as `initLlm` gets no section and falls back to inference. Pass one
  // explicitly with `(ctx) => initLlm(ctx, undefined, 'myExt')` when the
  // settings prefix is known — it removes the guesswork entirely.
  // Resolve `vscode` lazily so this module stays importable from a webview.
  const vs: typeof import('vscode') = vscodeApi ?? (require('vscode') as typeof import('vscode'));
  const key = section ?? inferSection(vs);

  const build = () => {
    const cfg = vs.workspace.getConfiguration(`${key}.llm`);
    shared = createLlm({
      provider: cfg.get<LlmProvider>('provider') ?? 'ollama',
      baseUrl: cfg.get<string>('baseUrl') || undefined,
      // Empty means "auto": `resolveModel` picks an installed model rather
      // than guessing a name the user may never have pulled.
      model: cfg.get<string>('model') || '',
      apiKey: cfg.get<string>('apiKey') || undefined,
      temperature: cfg.get<number>('temperature'),
      timeoutMs: cfg.get<number>('timeoutMs'),
    });
    return shared;
  };

  const client = build();
  context.subscriptions.push(
    vs.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration(`${key}.llm`)) build();
    }),
  );
  return client;
}

/** The client built by `initLlm`. Throws if called before activate. */
export function useLlm(): LlmClient {
  if (!shared) {
    throw new Error('LLM not initialised — add `initLlm` to bootstrap({ onActivate: [initLlm] }).');
  }
  return shared;
}

/**
 * Settings live under the extension's command prefix. Find it by locating the
 * extension whose `contributes.configuration` declares an `<x>.llm.*` block —
 * that's unambiguous, and falls back to the vsceasy prefix in package.json.
 */
function inferSection(vs: typeof import('vscode')): string {
  // Derive the section from the *declared settings themselves*. Keying off
  // `vsceasy.commandPrefix` was wrong: that field is optional, and without it
  // this silently fell back to reading `vsceasy.llm.*` while the extension
  // wrote to `<its own prefix>.llm.*` — so changing the model did nothing.
  for (const ext of vs.extensions.all) {
    const pkg: any = ext.packageJSON;
    const config = pkg?.contributes?.configuration;
    if (!config) continue;
    const blocks = Array.isArray(config) ? config : [config];
    for (const block of blocks) {
      for (const key of Object.keys(block?.properties ?? {})) {
        const match = /^(.+)\.llm\.(model|provider|baseUrl)$/.exec(key);
        if (match) return match[1];
      }
    }
  }
  return 'vsceasy';
}
