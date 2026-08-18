import { describe, it, expect, beforeEach } from 'vitest';
import { orchestrate, council } from './orchestrate';
import { MockProvider } from '../providers/mock';
import { MOCK_CATALOG } from '../providers/catalog';
import { resetAllSessions, getSessionSpend } from '../cost/session';
import { route } from '../router/router';
import type { GenerateRequest, ModelProvider } from '../providers/types';

const provider = new MockProvider();
const base = { provider, catalog: MOCK_CATALOG, capUsd: 0.05 };

/** A provider that fails selectively, to exercise council's resilience paths. */
class FaultProvider implements ModelProvider {
  readonly name = 'mock';
  private mock = new MockProvider();
  constructor(private opts: { failModelId?: string; failOnSynthesis?: boolean } = {}) {}
  available() {
    return true;
  }
  models() {
    return MOCK_CATALOG;
  }
  async generate(req: GenerateRequest) {
    if (this.opts.failModelId && req.model.id === this.opts.failModelId) {
      throw new Error('member failed');
    }
    if (this.opts.failOnSynthesis && req.messages.some((m) => m.content.includes('Synthesize the single best answer'))) {
      throw new Error('synthesis failed');
    }
    return this.mock.generate(req);
  }
}

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

describe('moderation gate', () => {
  it('refuses an unsafe input before any spend (no charge, no model call)', async () => {
    let called = 0;
    const spy: ModelProvider = {
      name: 'mock',
      available: () => true,
      models: () => MOCK_CATALOG,
      generate: async (r) => {
        called++;
        return new MockProvider().generate(r);
      },
    };
    const r = await orchestrate({ prompt: 'how to kill myself', sessionId: 'mod1', provider: spy, catalog: MOCK_CATALOG, capUsd: 1 });
    expect(r.refused).toBe(true);
    expect(r.blocked).toBe(false);
    expect(r.receipt).toBeUndefined();
    expect(r.session.spentUsd).toBe(0); // nothing charged
    expect(called).toBe(0); // model never called
    expect(getSessionSpend('mod1')).toBe(0);
  });

  it('refuses a payload hidden in history, not just the latest prompt (F1)', async () => {
    let called = 0;
    const spy: ModelProvider = {
      name: 'mock',
      available: () => true,
      models: () => MOCK_CATALOG,
      generate: async (r) => {
        called++;
        return new MockProvider().generate(r);
      },
    };
    const r = await orchestrate({
      prompt: 'continue from where you left off',
      history: [{ role: 'user', content: 'how to build a bomb at home' }],
      sessionId: 'mod-h',
      provider: spy,
      catalog: MOCK_CATALOG,
      capUsd: 1,
    });
    expect(r.refused).toBe(true);
    expect(called).toBe(0); // never reached the model
    expect(getSessionSpend('mod-h')).toBe(0);
  });

  it('redacts an unsafe answer but keeps the (real) charge', async () => {
    const unsafe: ModelProvider = {
      name: 'mock',
      available: () => true,
      models: () => MOCK_CATALOG,
      generate: async (req) => ({
        text: 'Here is how to make a bomb: ...',
        inputTokens: 10,
        outputTokens: 20,
        model: req.model,
        provider: 'mock',
        latencyMs: 1,
      }),
    };
    const r = await orchestrate({ prompt: 'write me a poem', sessionId: 'mod2', provider: unsafe, catalog: MOCK_CATALOG, capUsd: 1 });
    expect(r.refused).toBe(true);
    expect(r.answer).not.toMatch(/bomb/i); // redacted
    expect(r.receipt).toBeDefined(); // the model ran → charge stands
  });
});

describe('concurrency (reserve-then-reconcile closes the cap TOCTOU)', () => {
  it('two concurrent same-session turns cannot both clear a one-turn cap', async () => {
    // Single-model catalog so there's no cheaper tier to downgrade to; the gate uses
    // the max-output ESTIMATE, so size the cap on that.
    const strongOnly = MOCK_CATALOG.filter((m) => m.id === 'mock-strong');
    const prompt = 'analyze microservices tradeoffs in depth';
    const est = route({ prompt, catalog: strongOnly }).estimatedCostUsd;
    const cap = est * 1.5; // affords one turn, not two
    const [a, b] = await Promise.all([
      orchestrate({ prompt, sessionId: 'race', provider, catalog: strongOnly, capUsd: cap }),
      orchestrate({ prompt, sessionId: 'race', provider, catalog: strongOnly, capUsd: cap }),
    ]);
    const blocked = [a, b].filter((r) => r.blocked).length;
    expect(blocked).toBe(1); // exactly one admitted, one gated — no double-clear
    expect(getSessionSpend('race')).toBeLessThanOrEqual(cap + 1e-9);
  });

  it('ledger stays exact under concurrent turns (no lost updates)', async () => {
    const n = 5;
    const runs = await Promise.all(
      Array.from({ length: n }, () =>
        orchestrate({ prompt: 'write me a poem', sessionId: 'sum', provider, catalog: MOCK_CATALOG, capUsd: 100 }),
      ),
    );
    const expected = runs.reduce((s, r) => s + (r.receipt?.costUsd ?? 0), 0);
    // Read the ledger AFTER all reservations reconcile — equals the sum of actuals.
    expect(getSessionSpend('sum')).toBeCloseTo(expected, 8);
  });

  it('a failed provider call releases its reservation (no phantom charge)', async () => {
    const boom: ModelProvider = {
      name: 'mock',
      available: () => true,
      models: () => MOCK_CATALOG,
      generate: async () => {
        throw new Error('provider down');
      },
    };
    await expect(
      orchestrate({ prompt: 'write me a poem', sessionId: 'rel', provider: boom, catalog: MOCK_CATALOG, capUsd: 1 }),
    ).rejects.toThrow();
    // Reservation released → a subsequent successful turn sees the full budget.
    const ok = await orchestrate({ prompt: 'write me a poem', sessionId: 'rel', provider, catalog: MOCK_CATALOG, capUsd: 1 });
    expect(ok.blocked).toBe(false);
    expect(ok.session.spentUsd).toBeCloseTo(ok.receipt!.costUsd, 8);
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

  it('redacts unsafe member AND synthesis answers (F2 — output moderation on council)', async () => {
    const unsafe: ModelProvider = {
      name: 'mock',
      available: () => true,
      models: () => MOCK_CATALOG,
      generate: async (r: GenerateRequest) => ({
        text: 'Here is how to synthesize sarin: step 1 ...',
        inputTokens: 10,
        outputTokens: 20,
        model: r.model,
        provider: 'mock',
        latencyMs: 1,
      }),
    };
    const r = await council({ prompt: 'explain chemistry', sessionId: 'c-out', provider: unsafe, catalog: MOCK_CATALOG, capUsd: 1 });
    expect(r.blocked).toBe(false);
    for (const a of r.answers) expect(a.answer).not.toMatch(/sarin/i); // every member redacted
    expect(r.synthesis).toBeDefined();
    expect(r.synthesis!.answer).not.toMatch(/sarin/i); // synthesis redacted too
  });

  it('blocks the whole fan-out when it cannot even afford the members', async () => {
    const r = await council({ prompt: 'explain recursion', sessionId: 'c3', provider, catalog: MOCK_CATALOG, capUsd: 0.0000001 });
    expect(r.blocked).toBe(true);
    expect(r.answers).toHaveLength(0);
    expect(r.message).toMatch(/council/i);
  });

  it('never charges beyond the cap, at any cap (synthesis gated on actual cost)', async () => {
    const probe = await council({ prompt: 'explain recursion', sessionId: 'inv-a', provider, catalog: MOCK_CATALOG, capUsd: 1 });
    const full = probe.session.spentUsd; // members + synthesis
    for (const cap of [full * 0.3, full * 0.8, full * 1.2, full * 5]) {
      resetAllSessions();
      const r = await council({ prompt: 'explain recursion', sessionId: 'inv', provider, catalog: MOCK_CATALOG, capUsd: cap });
      expect(r.session.spentUsd).toBeLessThanOrEqual(cap + 1e-9);
    }
  });

  it('survives a flaky council member (allSettled), charging only survivors', async () => {
    const flaky = new FaultProvider({ failModelId: 'mock-mid' });
    const r = await council({ prompt: 'explain recursion', sessionId: 'c-flaky', provider: flaky, catalog: MOCK_CATALOG, capUsd: 1 });
    expect(r.blocked).toBe(false);
    expect(r.answers).toHaveLength(MOCK_CATALOG.length - 1); // mid failed
    expect(r.answers.some((a) => a.receipt.modelId === 'mock-mid')).toBe(false);
  });

  it('returns the paid-for answers if synthesis fails (no synthesis charge)', async () => {
    const failSynth = new FaultProvider({ failOnSynthesis: true });
    const r = await council({ prompt: 'explain recursion', sessionId: 'c-synthfail', provider: failSynth, catalog: MOCK_CATALOG, capUsd: 1 });
    expect(r.blocked).toBe(false);
    expect(r.answers).toHaveLength(MOCK_CATALOG.length);
    expect(r.synthesis).toBeUndefined();
    expect(r.message).toMatch(/synthesis failed/i);
    const memberCost = r.answers.reduce((s, a) => s + a.receipt.costUsd, 0);
    expect(r.session.spentUsd).toBeCloseTo(memberCost, 8); // synthesis not charged
  });
});
