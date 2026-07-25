import { describe, test, expect, afterEach } from 'bun:test';
import { createLlm } from '../../../packages/vsceasy-runtime/src/llm';

/**
 * The LLM client talks to Ollama and OpenAI-compatible endpoints over plain
 * `fetch`, so the wire format, the streaming decoder and the JSON repair are
 * all testable by stubbing `fetch`.
 */
describe('llm client', () => {
  const realFetch = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  /** Capture the outgoing request and reply with a canned JSON body. */
  function stubJson(body: unknown) {
    const calls: Array<{ url: string; init: RequestInit; body: any }> = [];
    globalThis.fetch = (async (url: string, init: RequestInit) => {
      calls.push({ url, init, body: init?.body ? JSON.parse(String(init.body)) : undefined });
      return new Response(JSON.stringify(body), { status: 200 });
    }) as unknown as typeof fetch;
    return calls;
  }

  /** Reply with a chunked stream, the way a real streaming endpoint does. */
  function stubStream(chunks: string[]) {
    globalThis.fetch = (async () =>
      new Response(
        new ReadableStream({
          start(controller) {
            const enc = new TextEncoder();
            for (const c of chunks) controller.enqueue(enc.encode(c));
            controller.close();
          },
        }),
        { status: 200 },
      )) as unknown as typeof fetch;
  }

  test('ollama chat posts to /api/chat and reads message.content', async () => {
    const calls = stubJson({ message: { content: 'hi there' } });
    const llm = createLlm({ model: 'qwen' });
    expect(await llm.chat([{ role: 'user', content: 'yo' }])).toBe('hi there');
    expect(calls[0].url).toBe('http://localhost:11434/api/chat');
    expect(calls[0].body.model).toBe('qwen');
    expect(calls[0].body.stream).toBe(false);
  });

  test('openai chat posts to /chat/completions and reads choices[0]', async () => {
    const calls = stubJson({ choices: [{ message: { content: 'hello' } }] });
    const llm = createLlm({ provider: 'openai', model: 'gpt-x', apiKey: 'sk-test' });
    expect(await llm.chat([{ role: 'user', content: 'yo' }])).toBe('hello');
    expect(calls[0].url).toBe('https://api.openai.com/v1/chat/completions');
    expect((calls[0].init.headers as any).Authorization).toBe('Bearer sk-test');
  });

  test('json mode sets the provider-specific flag', async () => {
    let calls = stubJson({ message: { content: '{"a":1}' } });
    expect(await createLlm({ model: 'm' }).json([{ role: 'user', content: 'x' }])).toEqual({ a: 1 });
    expect(calls[0].body.format).toBe('json');

    calls = stubJson({ choices: [{ message: { content: '{"a":1}' } }] });
    await createLlm({ provider: 'openai', model: 'm' }).json([{ role: 'user', content: 'x' }]);
    expect(calls[0].body.response_format).toEqual({ type: 'json_object' });
  });

  test('json survives markdown fences and surrounding prose', async () => {
    stubJson({ message: { content: 'Sure!\n```json\n{"ok":true}\n```\nHope that helps.' } });
    expect(await createLlm({ model: 'm' }).json([{ role: 'user', content: 'x' }])).toEqual({ ok: true });
  });

  test('json throws a useful error on unparseable output', async () => {
    stubJson({ message: { content: 'I cannot do that.' } });
    await expect(
      createLlm({ model: 'm' }).json([{ role: 'user', content: 'x' }]),
    ).rejects.toThrow(/did not return valid JSON/);
  });

  test('ollama stream reassembles ndjson chunks in order', async () => {
    stubStream([
      '{"message":{"content":"he"}}\n',
      '{"message":{"content":"llo"}}\n{"message":{"content":" world"}}\n',
    ]);
    const seen: string[] = [];
    const out = await createLlm({ model: 'm' }).chat([{ role: 'user', content: 'x' }], {
      onToken: (t) => seen.push(t),
    });
    expect(out).toBe('hello world');
    expect(seen).toEqual(['he', 'llo', ' world']);
  });

  test('stream tolerates a frame split across chunk boundaries', async () => {
    // The second chunk completes a JSON object begun in the first.
    stubStream(['{"message":{"con', 'tent":"ok"}}\n']);
    const out = await createLlm({ model: 'm' }).chat([{ role: 'user', content: 'x' }], {
      onToken: () => {},
    });
    expect(out).toBe('ok');
  });

  test('openai stream decodes SSE and stops at [DONE]', async () => {
    stubStream([
      'data: {"choices":[{"delta":{"content":"a"}}]}\n',
      'data: {"choices":[{"delta":{"content":"b"}}]}\n',
      'data: [DONE]\n',
    ]);
    const out = await createLlm({ provider: 'openai', model: 'm' }).chat(
      [{ role: 'user', content: 'x' }],
      { onToken: () => {} },
    );
    expect(out).toBe('ab');
  });

  test('models() normalises both provider shapes', async () => {
    stubJson({ models: [{ name: 'qwen', size: 42 }] });
    expect(await createLlm({ model: 'm' }).models()).toEqual([{ name: 'qwen', size: 42 }]);

    stubJson({ data: [{ id: 'gpt-x' }] });
    expect(await createLlm({ provider: 'openai', model: 'm' }).models()).toEqual([{ name: 'gpt-x' }]);
  });

  test('a non-2xx response throws with the status and body', async () => {
    globalThis.fetch = (async () =>
      new Response('model not found', { status: 404 })) as unknown as typeof fetch;
    await expect(createLlm({ model: 'nope' }).chat([{ role: 'user', content: 'x' }])).rejects.toThrow(
      /404.*model not found/,
    );
  });

  test('ping reports failure instead of throwing', async () => {
    globalThis.fetch = (async () => {
      throw new Error('ECONNREFUSED');
    }) as unknown as typeof fetch;
    expect(await createLlm({ model: 'm' }).ping()).toEqual({ ok: false, error: 'ECONNREFUSED' });
  });

  test('complete() prepends the system message when given', async () => {
    const calls = stubJson({ message: { content: 'ok' } });
    await createLlm({ model: 'm' }).complete('do it', { system: 'be terse' });
    expect(calls[0].body.messages).toEqual([
      { role: 'system', content: 'be terse' },
      { role: 'user', content: 'do it' },
    ]);
  });

  test('an aborted signal rejects the request', async () => {
    globalThis.fetch = ((_url: string, init: RequestInit) =>
      new Promise((_resolve, reject) => {
        init.signal?.addEventListener('abort', () => reject(new Error('aborted')));
      })) as unknown as typeof fetch;
    const ctl = new AbortController();
    const p = createLlm({ model: 'm' }).chat([{ role: 'user', content: 'x' }], { signal: ctl.signal });
    ctl.abort();
    await expect(p).rejects.toThrow(/aborted/);
  });
});
