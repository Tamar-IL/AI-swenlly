import type { ChatMessage, ModelInfo, ModelProvider } from '../providers/types';
import { getProvider, getCatalog } from '../providers';
import { baselineModel } from '../providers/catalog';
import { route } from '../router/router';
import { buildReceipt, type Receipt } from '../cost/cost';
import {
  getSessionSpend,
  addSessionSpend,
  sessionCapUsd,
} from '../cost/session';

/**
 * The one seam every surface calls: the chat API route AND the eval harness both
 * go through `orchestrate`, so what we prove offline is exactly what ships.
 */

export interface OrchestrateInput {
  prompt: string;
  sessionId: string;
  /** Manual model override (model id). Optional. */
  overrideModelId?: string;
  /** Prior conversation turns (optional). */
  history?: ChatMessage[];
  /** Dependency injection for tests/eval. Defaults read from env. */
  provider?: ModelProvider;
  catalog?: ModelInfo[];
  capUsd?: number;
}

export interface OrchestrateResult {
  blocked: boolean;
  /** Present unless blocked. */
  answer?: string;
  receipt?: Receipt;
  /** Session accounting snapshot. */
  session: { spentUsd: number; capUsd: number; remainingUsd: number };
  /** User-facing message when blocked. */
  message?: string;
}

export async function orchestrate(input: OrchestrateInput): Promise<OrchestrateResult> {
  const provider = input.provider ?? getProvider();
  const catalog = input.catalog ?? getCatalog();
  const capUsd = input.capUsd ?? sessionCapUsd();
  const baseline = baselineModel(catalog);

  const spentUsd = getSessionSpend(input.sessionId);
  const remainingUsd = Math.max(0, capUsd - spentUsd);

  const decision = route({
    prompt: input.prompt,
    catalog,
    overrideModelId: input.overrideModelId,
    remainingBudgetUsd: remainingUsd,
  });

  // Cost gate: refuse the turn if nothing fits the remaining budget.
  if (decision.blocked) {
    return {
      blocked: true,
      session: { spentUsd, capUsd, remainingUsd },
      message:
        `You've reached this session's ${formatUsd(capUsd)} cost cap. ` +
        `Start a new session or raise CONDUCTOR_SESSION_CAP_USD to continue.`,
    };
  }

  const messages: ChatMessage[] = [
    ...(input.history ?? []),
    { role: 'user', content: input.prompt },
  ];

  const gen = await provider.generate({ model: decision.model, messages });

  const receipt = buildReceipt({
    model: decision.model,
    baseline,
    inputTokens: gen.inputTokens,
    outputTokens: gen.outputTokens,
    reason: decision.reason,
  });

  const newSpent = addSessionSpend(input.sessionId, receipt.costUsd);

  return {
    blocked: false,
    answer: gen.text,
    receipt,
    session: {
      spentUsd: round(newSpent, 8),
      capUsd,
      remainingUsd: round(Math.max(0, capUsd - newSpent), 8),
    },
  };
}

/**
 * Council mode (v1 stub): ask one model per tier and return the answers side by
 * side. No fusion/synthesis yet — that's the v2 headline. Council calls are NOT
 * charged against the session cap in this stub (they're a compare view); wire
 * them into the ledger when council ships for real.
 */
export interface CouncilAnswer {
  answer: string;
  receipt: Receipt;
}

export async function council(input: {
  prompt: string;
  history?: ChatMessage[];
  provider?: ModelProvider;
  catalog?: ModelInfo[];
}): Promise<CouncilAnswer[]> {
  const provider = input.provider ?? getProvider();
  const catalog = input.catalog ?? getCatalog();
  const baseline = baselineModel(catalog);
  const messages: ChatMessage[] = [
    ...(input.history ?? []),
    { role: 'user', content: input.prompt },
  ];

  const results = await Promise.all(
    catalog.map(async (model) => {
      const gen = await provider.generate({ model, messages });
      const receipt = buildReceipt({
        model,
        baseline,
        inputTokens: gen.inputTokens,
        outputTokens: gen.outputTokens,
        reason: `Council member (${model.tier}).`,
      });
      return { answer: gen.text, receipt };
    }),
  );

  return results;
}

function formatUsd(n: number): string {
  return `$${n.toFixed(n < 0.01 ? 4 : 2)}`;
}

function round(n: number, dp: number): number {
  const f = 10 ** dp;
  return Math.round(n * f) / f;
}
