import type { ModelInfo } from '../providers/types';
import { safeTokenCount } from './tokens';

/**
 * USD cost of a call given token counts and a model's per-1k pricing.
 * Token counts are sanitised first: a non-finite/negative count (e.g. a malformed
 * provider usage payload) must never produce NaN cost, which would poison the
 * session ledger and silently uncap spend.
 */
export function costOf(model: ModelInfo, inputTokens: number, outputTokens: number): number {
  const inTok = safeTokenCount(inputTokens);
  const outTok = safeTokenCount(outputTokens);
  const cost = (inTok / 1000) * model.inputCostPer1k + (outTok / 1000) * model.outputCostPer1k;
  // Guard against tiny floating-point noise; round to sub-cent micro-dollars.
  return round(cost, 8);
}

/**
 * The trust "receipt" attached to every answer: which AI answered, what it cost,
 * and how much was saved versus routing everything to the strong baseline model.
 */
export interface Receipt {
  modelId: string;
  modelLabel: string;
  tier: ModelInfo['tier'];
  provider: string;
  free: boolean;
  inputTokens: number;
  outputTokens: number;
  /** Actual USD cost of the model that answered. */
  costUsd: number;
  /** USD it would have cost to answer with the strong baseline model. */
  baselineUsd: number;
  /** baselineUsd - costUsd (never negative). */
  savedUsd: number;
  /** Percent saved vs baseline, 0..100. 0 when the strong model itself answered. */
  savedPct: number;
  /** Human-readable one-liner explaining why this model was chosen. */
  reason: string;
}

export function buildReceipt(params: {
  model: ModelInfo;
  baseline: ModelInfo;
  inputTokens: number;
  outputTokens: number;
  reason: string;
}): Receipt {
  const { model, baseline, inputTokens, outputTokens, reason } = params;
  const costUsd = costOf(model, inputTokens, outputTokens);
  // Compare against the baseline pricing on the SAME usage — no second call needed.
  const baselineUsd = costOf(baseline, inputTokens, outputTokens);
  const savedUsd = round(Math.max(0, baselineUsd - costUsd), 8);
  const savedPct = baselineUsd > 0 ? round((savedUsd / baselineUsd) * 100, 1) : 0;

  return {
    modelId: model.id,
    modelLabel: model.label,
    tier: model.tier,
    provider: model.provider,
    free: model.free,
    inputTokens,
    outputTokens,
    costUsd,
    baselineUsd,
    savedUsd,
    savedPct,
    reason,
  };
}

function round(n: number, dp: number): number {
  const f = 10 ** dp;
  return Math.round(n * f) / f;
}
