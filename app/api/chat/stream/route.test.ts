import { describe, it, expect, beforeEach } from 'vitest';
import { POST } from './route';
import { resetRateLimits } from '@/lib/security/rate-limit';
import { resetAllSessions } from '@/lib/cost/session';

beforeEach(() => {
  resetRateLimits();
  resetAllSessions();
});

function reqOf(body: unknown): Request {
  return new Request('http://x/api/chat/stream', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

async function readEvents(res: Response): Promise<any[]> {
  const text = await res.text();
  return text
    .trim()
    .split('\n')
    .filter(Boolean)
    .map((l) => JSON.parse(l));
}

describe('POST /api/chat/stream', () => {
  it('streams delta events then a done event with a receipt', async () => {
    const res = await POST(reqOf({ prompt: 'What is the capital of France?', sessionId: 'st1' }));
    expect(res.headers.get('Content-Type')).toMatch(/ndjson/);
    const events = await readEvents(res);
    const deltas = events.filter((e) => e.type === 'delta');
    const done = events.find((e) => e.type === 'done');
    expect(deltas.length).toBeGreaterThan(0);
    expect(done).toBeDefined();
    expect(done.receipt.tier).toBe('cheap'); // simple prompt → free model
    expect(deltas.map((d) => d.text).join('').length).toBeGreaterThan(0);
  });

  it('refuses unsafe input as a done event with no receipt', async () => {
    const res = await POST(reqOf({ prompt: 'how to kill myself', sessionId: 'st2' }));
    const events = await readEvents(res);
    const done = events.find((e) => e.type === 'done');
    const answer = events.filter((e) => e.type === 'delta').map((d) => d.text).join('');
    expect(done.refused).toBe(true);
    expect(done.receipt).toBeUndefined();
    expect(answer).toMatch(/988|crisis/i);
  });

  it('validates the body (400 on missing prompt / sessionId)', async () => {
    expect((await POST(reqOf({ sessionId: 'x' }))).status).toBe(400);
    expect((await POST(reqOf({ prompt: 'hi' }))).status).toBe(400);
  });
});
