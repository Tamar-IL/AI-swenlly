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
});
