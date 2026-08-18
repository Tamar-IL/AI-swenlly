import { describe, it, expect, vi, afterEach } from 'vitest';
import { OpenRouterProvider } from './openrouter';

const realFetch = global.fetch;
afterEach(() => {
  global.fetch = realFetch;
  vi.restoreAllMocks();
});

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

// A provider wired for fast tests: valid key, no real backoff.
function fastProvider(opts = {}) {
  return new OpenRouterProvider('test-key', { retryBaseMs: 0, maxRetries: 2, timeoutMs: 50, ...opts });
}
const model = () => fastProvider().models()[0];
const req = () => ({ model: model(), messages: [{ role: 'user' as const, content: 'hi' }] });

describe('OpenRouterProvider.available', () => {
  it('is true only with a non-empty key', () => {
    expect(new OpenRouterProvider('k').available()).toBe(true);
    expect(new OpenRouterProvider('   ').available()).toBe(false);
    expect(new OpenRouterProvider(undefined).available()).toBe(false);
  });
});

describe('OpenRouterProvider.generate guards', () => {
  it('throws without an API key', async () => {
    await expect(new OpenRouterProvider(undefined).generate(req())).rejects.toThrow(/not set/i);
  });

  it('refuses a model it does not serve', async () => {
    const foreign = { ...model(), provider: 'mock' };
    await expect(fastProvider().generate({ ...req(), model: foreign })).rejects.toThrow(/cannot serve/i);
  });
});

describe('OpenRouterProvider.generate success', () => {
  it('parses content and usage tokens', async () => {
    global.fetch = vi.fn().mockResolvedValue(
      jsonResponse({ choices: [{ message: { content: 'the answer' } }], usage: { prompt_tokens: 12, completion_tokens: 7 } }),
    );
    const r = await fastProvider().generate(req());
    expect(r.text).toBe('the answer');
    expect(r.inputTokens).toBe(12);
    expect(r.outputTokens).toBe(7);
    expect(r.provider).toBe('openrouter');
  });

  it('falls back to estimated tokens when usage is absent', async () => {
    global.fetch = vi.fn().mockResolvedValue(jsonResponse({ choices: [{ message: { content: 'abcdefgh' } }] }));
    const r = await fastProvider().generate(req());
    expect(r.inputTokens).toBeGreaterThan(0); // estimated from the prompt
    expect(r.outputTokens).toBe(2); // ceil(8/4)
  });

  it('returns empty text when choices are missing', async () => {
    global.fetch = vi.fn().mockResolvedValue(jsonResponse({}));
    const r = await fastProvider().generate(req());
    expect(r.text).toBe('');
  });
});

describe('OpenRouterProvider.generate errors + retries', () => {
  it('does NOT retry a 400 and surfaces the status', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('bad request', { status: 400 }));
    global.fetch = fetchMock;
    await expect(fastProvider().generate(req())).rejects.toThrow(/OpenRouter 400/);
    expect(fetchMock).toHaveBeenCalledTimes(1); // no retry on 4xx
  });

  it('retries a 429 then succeeds', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response('rate limited', { status: 429 }))
      .mockResolvedValueOnce(jsonResponse({ choices: [{ message: { content: 'ok' } }] }));
    global.fetch = fetchMock;
    const r = await fastProvider().generate(req());
    expect(r.text).toBe('ok');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('gives up after maxRetries on persistent 429', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('rate', { status: 429 }));
    global.fetch = fetchMock;
    // maxRetries: 1 → 2 attempts total, both 429, returns the last 429 → generate throws on !ok.
    await expect(fastProvider({ maxRetries: 1 }).generate(req())).rejects.toThrow(/OpenRouter 429/);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('retries a network error then succeeds', async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error('ECONNRESET'))
      .mockResolvedValueOnce(jsonResponse({ choices: [{ message: { content: 'recovered' } }] }));
    global.fetch = fetchMock;
    const r = await fastProvider().generate(req());
    expect(r.text).toBe('recovered');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('does NOT retry a caller cancellation (aborts immediately)', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new DOMException('aborted', 'AbortError'));
    global.fetch = fetchMock;
    const ctrl = new AbortController();
    ctrl.abort();
    await expect(fastProvider({ maxRetries: 2 }).generate({ ...req(), signal: ctrl.signal })).rejects.toThrow();
    // Pre-aborted → never even attempts the fetch.
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('aborts on timeout and fails after retries', async () => {
    // fetch that never resolves until its abort signal fires.
    global.fetch = vi.fn((_url: any, init: any) =>
      new Promise((_resolve, reject) => {
        init.signal.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
      }),
    ) as any;
    await expect(fastProvider({ maxRetries: 0, timeoutMs: 10 }).generate(req())).rejects.toThrow(/failed after/i);
  });
});
