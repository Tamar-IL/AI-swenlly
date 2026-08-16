import { describe, it, expect } from 'vitest';
import { simulatedScore } from './judge';
import { MOCK_CATALOG, baselineModel } from '../lib/providers/catalog';
import type { GoldenCase } from './golden';

const strong = baselineModel(MOCK_CATALOG);
const cheap = MOCK_CATALOG.find((m) => m.tier === 'cheap')!;

const easy: GoldenCase = { id: 't-easy', prompt: 'hi', difficulty: 0.1, category: 'simple', expectedTier: 'cheap' };
const hard: GoldenCase = { id: 't-hard', prompt: 'prove X', difficulty: 0.95, category: 'reasoning', expectedTier: 'strong' };

describe('simulatedScore (anti-circularity guard)', () => {
  it('DROPS to 0 when the answer is empty/degenerate — it actually reads the answer', () => {
    const good = simulatedScore({ model: strong, case: hard, answer: 'A full, structured answer to the question.' });
    const empty = simulatedScore({ model: strong, case: hard, answer: '' });
    const tiny = simulatedScore({ model: strong, case: hard, answer: 'ok' });
    expect(good).toBeGreaterThan(0.9);
    expect(empty).toBe(0);
    expect(tiny).toBe(0);
    // The score is NOT a pure function of (model, case): the answer matters.
    expect(good).not.toEqual(empty);
  });

  it('reflects the capability-vs-difficulty prior on a real answer', () => {
    const answer = 'A complete answer with reasoning and examples.';
    expect(simulatedScore({ model: strong, case: hard, answer })).toBeGreaterThan(
      simulatedScore({ model: cheap, case: hard, answer }),
    );
    // On an easy case, cheap ties strong.
    expect(simulatedScore({ model: cheap, case: easy, answer })).toBe(
      simulatedScore({ model: strong, case: easy, answer }),
    );
  });
});
