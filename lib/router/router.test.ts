import { describe, it, expect } from 'vitest';
import { route } from './router';
import { MOCK_CATALOG } from '../providers/catalog';

describe('route', () => {
  it('honours a manual override', () => {
    const d = route({ prompt: 'hi', catalog: MOCK_CATALOG, overrideModelId: 'mock-strong' });
    expect(d.model.id).toBe('mock-strong');
    expect(d.overridden).toBe(true);
  });

  it('ignores an unknown override id and routes normally', () => {
    const d = route({ prompt: 'hi', catalog: MOCK_CATALOG, overrideModelId: 'does-not-exist' });
    expect(d.overridden).toBe(false);
    expect(d.model.tier).toBe('cheap'); // "hi" is simple
  });

  it('routes a coding prompt to strong', () => {
    const d = route({ prompt: 'write a python function', catalog: MOCK_CATALOG });
    expect(d.tier).toBe('strong');
    expect(d.blocked).toBe(false);
  });

  it('downgrades to fit a tight remaining budget', () => {
    // A coding prompt wants strong, but only a tiny budget remains → downgrade.
    const d = route({
      prompt: 'write a python function to sort a list',
      catalog: MOCK_CATALOG,
      remainingBudgetUsd: 0.00001, // only the free model fits
    });
    expect(d.downgraded).toBe(true);
    expect(d.model.free).toBe(true);
    expect(d.blocked).toBe(false);
  });

  it('never blocks when a free ($0) model exists', () => {
    const d = route({
      prompt: 'analyze the tradeoffs of microservices',
      catalog: MOCK_CATALOG,
      remainingBudgetUsd: 0,
    });
    // Free model costs $0, so even a $0 budget is not blocked.
    expect(d.blocked).toBe(false);
    expect(d.model.free).toBe(true);
  });

  it('blocks when no model fits the budget (no free model in catalog)', () => {
    const paidOnly = MOCK_CATALOG.filter((m) => !m.free);
    const d = route({
      prompt: 'analyze this',
      catalog: paidOnly,
      remainingBudgetUsd: 0,
    });
    expect(d.blocked).toBe(true);
  });

  it('blocks an over-budget manual override instead of bypassing the cap', () => {
    const paidOnly = MOCK_CATALOG.filter((m) => !m.free);
    const d = route({
      prompt: 'hi',
      catalog: paidOnly,
      overrideModelId: 'mock-strong',
      remainingBudgetUsd: 0, // cap exhausted
    });
    expect(d.overridden).toBe(true);
    expect(d.blocked).toBe(true);
    expect(d.reason).toMatch(/budget|cap/i);
  });

  it('honours an affordable manual override', () => {
    const d = route({
      prompt: 'hi',
      catalog: MOCK_CATALOG,
      overrideModelId: 'mock-strong',
      remainingBudgetUsd: 1,
    });
    expect(d.overridden).toBe(true);
    expect(d.blocked).toBe(false);
    expect(d.model.id).toBe('mock-strong');
  });

  it('downgrades a strong-intent prompt to the best AVAILABLE tier, not the cheapest', () => {
    // Catalog with cheap + mid only; a coding prompt wants strong.
    const noStrong = MOCK_CATALOG.filter((m) => m.tier !== 'strong');
    const d = route({ prompt: 'write a python function', catalog: noStrong });
    expect(d.tier).toBe('mid'); // best available <= strong, NOT cheap
  });

  it('throws on an empty catalog instead of a raw TypeError', () => {
    expect(() => route({ prompt: 'hi', catalog: [] })).toThrow(/empty catalog/i);
  });

  it('admits at target tier when budget exactly equals the estimate (strict >)', () => {
    // Compute the exact estimate for the mid model on a short prompt.
    const prompt = 'write me a poem';
    const probe = route({ prompt, catalog: MOCK_CATALOG });
    const est = probe.estimatedCostUsd;
    const exact = route({ prompt, catalog: MOCK_CATALOG, remainingBudgetUsd: est });
    expect(exact.downgraded).toBe(false); // exactly-at-budget is admitted
    const under = route({ prompt, catalog: MOCK_CATALOG, remainingBudgetUsd: est - 1e-9 });
    expect(under.model.free).toBe(true); // one epsilon under → downgrade to free
  });

  it('accounts for history tokens in the budget (cannot hide workload in history)', () => {
    const paidOnly = MOCK_CATALOG.filter((m) => !m.free);
    // Tiny prompt, but a large extra-token load should push cost over a small budget.
    const d = route({
      prompt: 'hi',
      catalog: paidOnly,
      remainingBudgetUsd: 0.0002,
      extraInputTokens: 100000,
    });
    expect(d.blocked).toBe(true);
  });
});
