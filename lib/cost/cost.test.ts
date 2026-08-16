import { describe, it, expect } from 'vitest';
import { costOf, buildReceipt } from './cost';
import { MOCK_CATALOG, baselineModel, modelForTier } from '../providers/catalog';

const strong = baselineModel(MOCK_CATALOG);
const cheap = modelForTier(MOCK_CATALOG, 'cheap')!;
const mid = modelForTier(MOCK_CATALOG, 'mid')!;

describe('costOf', () => {
  it('is zero for free models', () => {
    expect(costOf(cheap, 1000, 1000)).toBe(0);
  });

  it('prices input and output separately', () => {
    // mid: in 0.00025/1k, out 0.00075/1k
    expect(costOf(mid, 1000, 0)).toBeCloseTo(0.00025, 8);
    expect(costOf(mid, 0, 1000)).toBeCloseTo(0.00075, 8);
    expect(costOf(mid, 2000, 2000)).toBeCloseTo(0.002, 8);
  });

  it('never returns NaN/Infinity/negative for malformed token counts (would uncap the wallet)', () => {
    for (const bad of [NaN, Infinity, -100, -1]) {
      expect(Number.isFinite(costOf(mid, bad, 100))).toBe(true);
      expect(costOf(mid, bad, 100)).toBeGreaterThanOrEqual(0);
      expect(Number.isFinite(costOf(mid, 100, bad))).toBe(true);
    }
    // A NaN input is treated as 0 tokens, so cost is just the other side.
    expect(costOf(mid, NaN, 0)).toBe(0);
  });
});

describe('buildReceipt', () => {
  it('shows full savings when a free model answers', () => {
    const r = buildReceipt({
      model: cheap,
      baseline: strong,
      inputTokens: 1000,
      outputTokens: 1000,
      reason: 'simple',
    });
    expect(r.costUsd).toBe(0);
    expect(r.baselineUsd).toBeGreaterThan(0);
    expect(r.savedUsd).toBe(r.baselineUsd);
    expect(r.savedPct).toBe(100);
    expect(r.free).toBe(true);
  });

  it('shows zero savings when the strong model itself answers', () => {
    const r = buildReceipt({
      model: strong,
      baseline: strong,
      inputTokens: 500,
      outputTokens: 500,
      reason: 'coding',
    });
    expect(r.savedUsd).toBe(0);
    expect(r.savedPct).toBe(0);
    expect(r.costUsd).toBe(r.baselineUsd);
  });

  it('never reports negative savings', () => {
    const r = buildReceipt({
      model: mid,
      baseline: strong,
      inputTokens: 100,
      outputTokens: 100,
      reason: 'default',
    });
    expect(r.savedUsd).toBeGreaterThanOrEqual(0);
  });
});
