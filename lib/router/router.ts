import type { ModelInfo, Tier } from '../providers/types';
import { TIERS } from '../providers/types';
import { modelForTier, modelById } from '../providers/catalog';
import { classifyPrompt, reasonFor, type Classification } from './classify';
import { costOf } from '../cost/cost';
import { estimateTokens } from '../cost/tokens';

export interface RouteInput {
  prompt: string;
  catalog: ModelInfo[];
  /** Manual model override (by model id). When set, the router honours it — but
   *  still enforces the remaining budget so override cannot bypass the cost cap. */
  overrideModelId?: string;
  /** Remaining budget in USD for this session (cap - already spent). */
  remainingBudgetUsd?: number;
  /** Estimated input tokens beyond the prompt (e.g. conversation history), so the
   *  budget gate accounts for the FULL billed context, not just the prompt. */
  extraInputTokens?: number;
}

export interface RouteDecision {
  model: ModelInfo;
  tier: Tier;
  reason: string;
  classification: Classification;
  /** True if a manual override selected the model. */
  overridden: boolean;
  /** True if the router downgraded the tier to fit the remaining budget. */
  downgraded: boolean;
  /** True if nothing fits the remaining budget (including an over-budget override). */
  blocked: boolean;
  /** Estimated cost of the chosen model for this prompt (output assumed at max). */
  estimatedCostUsd: number;
}

/**
 * Output tokens assumed when budgeting a call BEFORE it runs. We budget against the
 * provider's MAX output, not an average, so the actual charge can never exceed the
 * pre-call estimate — the cap is a real ceiling, not an average-case guess.
 */
export const MAX_OUTPUT_TOKENS = 1024;

/**
 * The rules-based router. Ordered decision:
 *   1. Manual override — honoured, but still budget-checked (blocks if unaffordable).
 *   2. Classify the prompt → a target tier → the best AVAILABLE model at/below it.
 *   3. Cost-aware clamp: if the target can't fit the remaining budget, downgrade
 *      toward cheaper tiers; if nothing fits, block.
 */
export function route(input: RouteInput): RouteDecision {
  const { prompt, catalog, overrideModelId, remainingBudgetUsd, extraInputTokens = 0 } = input;
  if (!catalog || catalog.length === 0) {
    throw new Error('route(): empty catalog — no models to route to');
  }
  const inputTokens = estimateTokens(prompt) + Math.max(0, extraInputTokens);
  const estCost = (m: ModelInfo) => costOf(m, inputTokens, MAX_OUTPUT_TOKENS);
  const budgeted = typeof remainingBudgetUsd === 'number';

  // 1. Manual override — honoured, but never allowed to bypass the cost cap.
  if (overrideModelId) {
    const forced = modelById(catalog, overrideModelId);
    if (forced) {
      const classification = classifyPrompt(prompt);
      if (budgeted && estCost(forced) > (remainingBudgetUsd as number)) {
        return {
          model: forced,
          tier: forced.tier,
          reason: `Pinned model ${forced.label} costs more than the remaining budget — blocked to protect the cap.`,
          classification,
          overridden: true,
          downgraded: false,
          blocked: true,
          estimatedCostUsd: estCost(forced),
        };
      }
      return {
        model: forced,
        tier: forced.tier,
        reason: `Manual override → ${forced.label}.`,
        classification,
        overridden: true,
        downgraded: false,
        blocked: false,
        estimatedCostUsd: estCost(forced),
      };
    }
    // Unknown override id → ignore and route normally.
  }

  // 2. Classify → best available model at/below the target tier.
  const classification = classifyPrompt(prompt);
  let chosen = bestAvailableForTier(catalog, classification.tier);
  let downgraded = false;

  // 3. Cost-aware clamp.
  if (budgeted && estCost(chosen) > (remainingBudgetUsd as number)) {
    const affordable = affordableDowngrade(catalog, classification.tier, remainingBudgetUsd as number, estCost);
    if (affordable) {
      downgraded = affordable.id !== chosen.id;
      chosen = affordable;
    } else {
      const cheap = cheapest(catalog);
      return {
        model: cheap,
        tier: cheap.tier,
        reason: 'Session cost cap reached — no model fits the remaining budget.',
        classification,
        overridden: false,
        downgraded: false,
        blocked: true,
        estimatedCostUsd: estCost(cheap),
      };
    }
  }

  return {
    model: chosen,
    tier: chosen.tier,
    reason: reasonFor(classification, chosen.tier),
    classification,
    overridden: false,
    downgraded,
    blocked: false,
    estimatedCostUsd: estCost(chosen),
  };
}

/** Best model at the target tier, else the next-best AVAILABLE lower tier (not the
 *  globally cheapest — a strong-intent prompt on a {cheap,mid} catalog gets mid). */
function bestAvailableForTier(catalog: ModelInfo[], tier: Tier): ModelInfo {
  for (const t of tiersFrom(tier)) {
    const m = modelForTier(catalog, t);
    if (m) return m;
  }
  return cheapest(catalog);
}

/** Walk from the target tier down to cheaper tiers, returning the first that fits. */
function affordableDowngrade(
  catalog: ModelInfo[],
  targetTier: Tier,
  budget: number,
  estCost: (m: ModelInfo) => number,
): ModelInfo | undefined {
  for (const tier of tiersFrom(targetTier)) {
    const m = modelForTier(catalog, tier);
    if (m && estCost(m) <= budget) return m;
  }
  const cheap = cheapest(catalog);
  return estCost(cheap) <= budget ? cheap : undefined;
}

/** Tier list starting at `from` and descending in capability/cost, e.g. strong -> [strong, mid, cheap]. */
function tiersFrom(from: Tier): Tier[] {
  const descending = [...TIERS].reverse(); // [strong, mid, cheap]
  return descending.slice(descending.indexOf(from));
}

function cheapest(catalog: ModelInfo[]): ModelInfo {
  return [...catalog].sort(
    (a, b) => a.inputCostPer1k + a.outputCostPer1k - (b.inputCostPer1k + b.outputCostPer1k),
  )[0];
}
