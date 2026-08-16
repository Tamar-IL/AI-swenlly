import type { ModelInfo, Tier } from './types';

/**
 * The model catalog: the three tiers the MVP routes across, one model each.
 *
 * Pricing is expressed per 1,000 tokens in USD and mirrors real-world orders of
 * magnitude (a free open model, a cheap mid model, a strong frontier model), so
 * the "cost saved" receipt and the eval economics are realistic. The `strong`
 * model is the baseline the receipt compares every answer against.
 *
 * "Cheap" is a genuinely FREE open-weights / free-inference model — the product's
 * core cost thesis is "lean on free models first, escalate only when needed".
 */
export const MOCK_CATALOG: ModelInfo[] = [
  {
    id: 'mock-cheap',
    label: 'Conductor Free · open weights',
    tier: 'cheap',
    provider: 'mock',
    inputCostPer1k: 0,
    outputCostPer1k: 0,
    free: true,
    capability: 0.62,
  },
  {
    id: 'mock-mid',
    label: 'Conductor Balanced',
    tier: 'mid',
    provider: 'mock',
    inputCostPer1k: 0.00025,
    outputCostPer1k: 0.00075,
    free: false,
    capability: 0.8,
  },
  {
    id: 'mock-strong',
    label: 'Conductor Max · frontier',
    tier: 'strong',
    provider: 'mock',
    inputCostPer1k: 0.0025,
    outputCostPer1k: 0.0075,
    free: false,
    capability: 0.97,
  },
];

/** The tier the receipt uses as the "what a single strong model would cost" baseline. */
export const BASELINE_TIER: Tier = 'strong';

/** First model of a tier within a catalog, or undefined. */
export function modelForTier(catalog: ModelInfo[], tier: Tier): ModelInfo | undefined {
  return catalog.find((m) => m.tier === tier);
}

/** The baseline (strong) model for a catalog — used for the savings comparison. */
export function baselineModel(catalog: ModelInfo[]): ModelInfo {
  const m = modelForTier(catalog, BASELINE_TIER);
  if (!m) throw new Error(`catalog has no "${BASELINE_TIER}" tier model to use as baseline`);
  return m;
}

export function modelById(catalog: ModelInfo[], id: string): ModelInfo | undefined {
  return catalog.find((m) => m.id === id);
}
