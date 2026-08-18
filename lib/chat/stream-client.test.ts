import { describe, it, expect, vi } from 'vitest';
import { consumeChatStream } from './stream-client';

function handlers() {
  return {
    deltas: [] as string[],
    done: null as any,
    blocked: null as any,
    errors: [] as string[],
    h: {} as any,
  };
}
function make() {
  const s = handlers();
  s.h = {
    onDelta: (t: string) => s.deltas.push(t),
    onDone: (e: any) => (s.done = e),
    onBlocked: (e: any) => (s.blocked = e),
    onError: (m: string) => s.errors.push(m),
  };
  return s;
}

function ndjson(lines: unknown[]): Response {
  return new Response(lines.map((l) => JSON.stringify(l)).join('\n') + '\n', { status: 200 });
}

describe('consumeChatStream', () => {
  it('dispatches delta events then done', async () => {
    const s = make();
    await consumeChatStream(
      ndjson([
        { type: 'delta', text: 'Hello ' },
        { type: 'delta', text: 'world' },
        { type: 'done', receipt: { modelId: 'm' }, session: { spentUsd: 1, capUsd: 5, remainingUsd: 4 } },
      ]),
      s.h,
    );
    expect(s.deltas.join('')).toBe('Hello world');
    expect(s.done.session.spentUsd).toBe(1);
    expect(s.errors).toHaveLength(0);
  });

  it('surfaces a non-2xx JSON error via onError (does NOT hang)', async () => {
    const s = make();
    const res = new Response(JSON.stringify({ error: 'rate limit exceeded — slow down' }), { status: 429 });
    await consumeChatStream(res, s.h);
    expect(s.errors).toEqual(['rate limit exceeded — slow down']);
    expect(s.done).toBeNull();
    expect(s.deltas).toHaveLength(0);
  });

  it('reports a generic message when the error body is not JSON', async () => {
    const s = make();
    await consumeChatStream(new Response('gateway timeout', { status: 502 }), s.h);
    expect(s.errors[0]).toMatch(/failed \(502\)/);
  });

  it('routes a blocked event to onBlocked', async () => {
    const s = make();
    await consumeChatStream(ndjson([{ type: 'blocked', message: 'cap reached', session: { spentUsd: 5, capUsd: 5, remainingUsd: 0 } }]), s.h);
    expect(s.blocked.message).toBe('cap reached');
  });

  it('flushes an unterminated final line', async () => {
    const s = make();
    // No trailing newline after the done event.
    const res = new Response('{"type":"delta","text":"hi"}\n{"type":"done"}', { status: 200 });
    await consumeChatStream(res, s.h);
    expect(s.deltas).toEqual(['hi']);
    expect(s.done).not.toBeNull();
  });

  it('ignores malformed lines without throwing', async () => {
    const s = make();
    const res = new Response('not-json\n{"type":"delta","text":"ok"}\n', { status: 200 });
    await consumeChatStream(res, s.h);
    expect(s.deltas).toEqual(['ok']);
    expect(s.errors).toHaveLength(0);
  });
});
