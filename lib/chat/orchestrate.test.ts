import { describe, it, expect, beforeEach } from 'vitest';
import { orchestrate, council } from './orchestrate';
import { MockProvider } from '../providers/mock';
import { MOCK_CATALOG } from '../providers/catalog';
import { resetAllSessions } from '../cost/session';

const provider = new MockProvider();
const base = { provider, catalog: MOCK_CATALOG, capUsd: 0.05 };

beforeEach(() => resetAllSessions());

describe('orchestrate', () => {
  it('answers a simple prompt with the free model and a full receipt', async () => {
    const r = await orchestrate({ prompt: 'hi', sessionId: 's1', ...base });
    expect(r.blocked).toBe(false);
    expect(r.answer).toBeTruthy();
    expect(r.receipt?.tier).toBe('cheap');
    expect(r.receipt?.free).toBe(true);
    expect(r.receipt?.savedPct).toBe(100);
  });

  it('routes a coding prompt to the strong model', async () => {
    const r = await orchestrate({ prompt: 'debug this python stack trace', sessionId: 's2', ...base });
    expect(r.receipt?.tier).toBe('strong');
    expect(r.receipt?.savedPct).toBe(0); // strong == baseline
  });

  it('accumulates session spend across turns', async () => {
    await orchestrate({ prompt: 'write me a poem', sessionId: 's3', ...base }); // mid, costs > 0
    const r2 = await orchestrate({ prompt: 'write me another poem', sessionId: 's3', ...base });
    expect(r2.session.spentUsd).toBeGreaterThan(0);
    expect(r2.session.remainingUsd).toBeLessThan(base.capUsd);
  });

  it('respects a manual override', async () => {
    const r = await orchestrate({
      prompt: 'hi',
      sessionId: 's4',
      overrideModelId: 'mock-strong',
      ...base,
    });
    expect(r.receipt?.modelId).toBe('mock-strong');
  });

  it('blocks a paid-only catalog once the cap is exhausted', async () => {
    const paidOnly = MOCK_CATALOG.filter((m) => !m.free);
    // Tiny cap so one strong answer blows through it.
    const tight = { provider, catalog: paidOnly, capUsd: 0.0001 };
    await orchestrate({ prompt: 'analyze microservices tradeoffs in depth', sessionId: 's5', ...tight });
    const r2 = await orchestrate({ prompt: 'analyze more tradeoffs in depth', sessionId: 's5', ...tight });
    expect(r2.blocked).toBe(true);
    expect(r2.message).toMatch(/cost cap/i);
  });
});

describe('council', () => {
  it('returns one answer per catalog model, each with a receipt', async () => {
    const r = await council({ prompt: 'explain recursion', sessionId: 'c1', provider, catalog: MOCK_CATALOG, capUsd: 1 });
    expect(r.blocked).toBe(false);
    expect(r.answers).toHaveLength(MOCK_CATALOG.length);
    for (const a of r.answers) {
      expect(a.answer).toBeTruthy();
      expect(a.receipt.modelId).toBeTruthy();
    }
  });

  it('synthesizes a fused answer from the strong model and charges it', async () => {
    const r = await council({ prompt: 'explain recursion', sessionId: 'c-syn', provider, catalog: MOCK_CATALOG, capUsd: 1 });
    expect(r.synthesis).toBeDefined();
    expect(r.synthesis!.answer).toBeTruthy();
    expect(r.synthesis!.receipt.tier).toBe('strong'); // aggregator = strong model
    expect(r.synthesis!.receipt.reason).toMatch(/mixture-of-agents/i);
    // Session spend includes members + synthesis.
    const expected = r.answers.reduce((s, a) => s + a.receipt.costUsd, 0) + r.synthesis!.receipt.costUsd;
    expect(r.session.spentUsd).toBeCloseTo(expected, 8);
  });

  it('can skip synthesis when asked (side-by-side only)', async () => {
    const r = await council({ prompt: 'explain recursion', sessionId: 'c-nosyn', provider, catalog: MOCK_CATALOG, capUsd: 1, synthesize: false });
    expect(r.synthesis).toBeUndefined();
    const expected = r.answers.reduce((s, a) => s + a.receipt.costUsd, 0);
    expect(r.session.spentUsd).toBeCloseTo(expected, 8);
  });

  it('blocks the whole fan-out (incl. synthesis) when it would exceed the remaining budget', async () => {
    const r = await council({ prompt: 'explain recursion', sessionId: 'c3', provider, catalog: MOCK_CATALOG, capUsd: 0.0000001 });
    expect(r.blocked).toBe(true);
    expect(r.answers).toHaveLength(0);
    expect(r.message).toMatch(/council/i);
  });
});
