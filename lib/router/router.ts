import type { ModelInfo, Tier } from '../providers/types';
import { TIERS } from '../providers/types';
import { modelForTier, modelById } from '../providers/catalog';
import { classifyPrompt, reasonFor, type Classification } from './classify';
import { costOf } from '../cost/cost';
import { estimateTokens } from '../cost/tokens';

export interface RouteInput {
  prompt: string;
  catalog: ModelInfo[];
  /** Manual model override (by model id). When set, the router honours it. */
  overrideModelId?: string;
  /** Remaining budget in USD for this session (cap - already spent). */
  remainingBudgetUsd?: number;
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
  /** True if even the cheapest model cannot fit the remaining budget. */
  blocked: boolean;
  /** Estimated cost of the chosen model for this prompt (output guessed). */
  estimatedCostUsd: number;
}

// Assumed output length for pre-call budgeting (we don't know it yet).
const ASSUMED_OUTPUT_TOKENS = 400;

/**
 * The rules-based router. Ordered decision:
 *   1. Manual override wins (respect the user's choice).
 *   2. Classify the prompt → a target tier.
 *   3. Cost-aware clamp: if the target tier can't fit the remaining budget,
 *      downgrade toward cheaper tiers; if nothing fits, block.
 */
export function route(input: RouteInput): RouteDecision {
  const { prompt, catalog, overrideModelId, remainingBudgetUsd } = input;
  const inputTokens = estimateTokens(prompt);
  const estCost = (m: ModelInfo) => costOf(m, inputTokens, ASSUMED_OUTPUT_TOKENS);

  // 1. Manual override.
  if (overrideModelId) {
    const forced = modelById(catalog, overrideModelId);
    if (forced) {
      const classification = classifyPrompt(prompt);
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

  // 2. Classify.
  const classification = classifyPrompt(prompt);
  let chosen = modelForTier(catalog, classification.tier) ?? cheapest(catalog);
  let downgraded = false;

  // 3. Cost-aware clamp.
  if (typeof remainingBudgetUsd === 'number') {
    if (estCost(chosen) > remainingBudgetUsd) {
      const affordable = affordableDowngrade(catalog, classification.tier, remainingBudgetUsd, estCost);
      if (affordable) {
        downgraded = affordable.id !== chosen.id;
        chosen = affordable;
      } else {
        // Nothing fits — block this turn.
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

/** Walk from the target tier down to cheaper tiers, returning the first that fits. */
function affordableDowngrade(
  catalog: ModelInfo[],
  targetTier: Tier,
  budget: number,
  estCost: (m: ModelInfo) => number,
): ModelInfo | undefined {
  const order = tiersFrom(targetTier); // e.g. strong -> [strong, mid, cheap]
  for (const tier of order) {
    const m = modelForTier(catalog, tier);
    if (m && estCost(m) <= budget) return m;
  }
  // Last resort: the globally cheapest model if it fits (covers free = $0).
  const cheap = cheapest(catalog);
  return estCost(cheap) <= budget ? cheap : undefined;
}

/** Tier list starting at `from` and descending in capability/cost. */
function tiersFrom(from: Tier): Tier[] {
  const idx = TIERS.indexOf(from); // TIERS = [cheap, mid, strong]
  const descending = [...TIERS].reverse(); // [strong, mid, cheap]
  const start = descending.indexOf(from);
  return start >= 0 ? descending.slice(start) : descending.slice(descending.length - 1 - idx);
}

function cheapest(catalog: ModelInfo[]): ModelInfo {
  return [...catalog].sort(
    (a, b) => a.inputCostPer1k + a.outputCostPer1k - (b.inputCostPer1k + b.outputCostPer1k),
  )[0];
}
