import type { ChatMessage, ModelInfo, ModelProvider } from '../providers/types';
import { getProvider, getCatalog } from '../providers';
import { baselineModel } from '../providers/catalog';
import { route, MAX_OUTPUT_TOKENS } from '../router/router';
import { buildReceipt, costOf, type Receipt } from '../cost/cost';
import { estimateMessagesTokens, safeTokenCount } from '../cost/tokens';
import { getSessionSpend, addSessionSpend, sessionCapUsd } from '../cost/session';

/**
 * The one seam every surface calls: the chat API route AND the eval harness both
 * go through `orchestrate`, so what we prove offline is exactly what ships.
 */

export interface OrchestrateInput {
  prompt: string;
  sessionId: string;
  /** Manual model override (model id). Optional. */
  overrideModelId?: string;
  /** Prior conversation turns (optional). Validated by the API layer. */
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
  const history = input.history ?? [];

  const spentUsd = getSessionSpend(input.sessionId);
  const remainingUsd = Math.max(0, capUsd - spentUsd);

  // Budget against the FULL billed context (history + prompt), not the prompt alone —
  // otherwise a caller could hide the workload in `history` and blow past the cap.
  const extraInputTokens = estimateMessagesTokens(history.map((m) => m.content));

  const decision = route({
    prompt: input.prompt,
    catalog,
    overrideModelId: input.overrideModelId,
    remainingBudgetUsd: remainingUsd,
    extraInputTokens,
  });

  // Cost gate: refuse the turn if nothing fits the remaining budget (incl. an
  // over-budget manual override).
  if (decision.blocked) {
    return {
      blocked: true,
      session: { spentUsd, capUsd, remainingUsd },
      message: decision.overridden
        ? decision.reason
        : `You've reached this session's ${formatUsd(capUsd)} cost cap. ` +
          `Start a new session or raise CONDUCTOR_SESSION_CAP_USD to continue.`,
    };
  }

  const messages: ChatMessage[] = [...history, { role: 'user', content: input.prompt }];

  const gen = await provider.generate({
    model: decision.model,
    messages,
    maxTokens: MAX_OUTPUT_TOKENS,
  });

  const inputTokens = safeTokenCount(gen.inputTokens);
  const outputTokens = safeTokenCount(gen.outputTokens);

  const receipt = buildReceipt({
    model: decision.model,
    baseline,
    inputTokens,
    outputTokens,
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
 * Council mode (Mixture-of-Agents): ask one model per tier, then a SYNTHESIZER (the
 * strong model as aggregator) fuses the candidates into one better answer. Both the
 * member calls AND the synthesis are metered against the session cap, and the whole
 * thing is refused up front if it can't fit the remaining budget (it costs N+1 calls).
 */
export interface CouncilAnswer {
  answer: string;
  receipt: Receipt;
}

export interface CouncilResult {
  blocked: boolean;
  /** The per-model candidate answers (the "many minds"). */
  answers: CouncilAnswer[];
  /** The fused answer (the "one answer"), present unless synthesis was skipped. */
  synthesis?: CouncilAnswer;
  session: { spentUsd: number; capUsd: number; remainingUsd: number };
  message?: string;
}

export async function council(input: {
  prompt: string;
  sessionId: string;
  history?: ChatMessage[];
  provider?: ModelProvider;
  catalog?: ModelInfo[];
  capUsd?: number;
  /** Set false to get side-by-side candidates without the fusion step. */
  synthesize?: boolean;
}): Promise<CouncilResult> {
  const provider = input.provider ?? getProvider();
  const catalog = input.catalog ?? getCatalog();
  const capUsd = input.capUsd ?? sessionCapUsd();
  const baseline = baselineModel(catalog);
  const history = input.history ?? [];
  const doSynthesis = input.synthesize !== false;
  const messages: ChatMessage[] = [...history, { role: 'user', content: input.prompt }];

  const spentUsd = getSessionSpend(input.sessionId);
  const remainingUsd = Math.max(0, capUsd - spentUsd);

  // Pre-flight: N member calls + (optionally) the synthesis call, priced at max output.
  const inputTokens = estimateMessagesTokens(messages.map((m) => m.content));
  let projected = catalog.reduce((sum, m) => sum + costOf(m, inputTokens, MAX_OUTPUT_TOKENS), 0);
  if (doSynthesis) {
    // The synthesizer's prompt carries the question + all candidate answers (each up to MAX).
    const synthInput = inputTokens + catalog.length * MAX_OUTPUT_TOKENS;
    projected += costOf(baseline, synthInput, MAX_OUTPUT_TOKENS);
  }
  if (projected > remainingUsd) {
    return {
      blocked: true,
      answers: [],
      session: { spentUsd, capUsd, remainingUsd },
      message:
        `Convening the council would cost about ${formatUsd(projected)}, over the remaining ` +
        `${formatUsd(remainingUsd)} in this session's cap. Start a new session to continue.`,
    };
  }

  const answers = await Promise.all(
    catalog.map(async (model) => {
      const gen = await provider.generate({ model, messages, maxTokens: MAX_OUTPUT_TOKENS });
      const receipt = buildReceipt({
        model,
        baseline,
        inputTokens: safeTokenCount(gen.inputTokens),
        outputTokens: safeTokenCount(gen.outputTokens),
        reason: `Council member (${model.tier}).`,
      });
      return { answer: gen.text, receipt };
    }),
  );

  // Charge every member against the session ledger.
  let newSpent = spentUsd;
  for (const a of answers) newSpent = addSessionSpend(input.sessionId, a.receipt.costUsd);

  // Synthesis: the strong model fuses the candidates into one better answer.
  let synthesis: CouncilAnswer | undefined;
  if (doSynthesis) {
    synthesis = await synthesizeAnswers({ prompt: input.prompt, answers, provider, baseline });
    newSpent = addSessionSpend(input.sessionId, synthesis.receipt.costUsd);
  }

  return {
    blocked: false,
    answers,
    synthesis,
    session: {
      spentUsd: round(newSpent, 8),
      capUsd,
      remainingUsd: round(Math.max(0, capUsd - newSpent), 8),
    },
  };
}

/**
 * The Mixture-of-Agents aggregator: the strong model reads all candidate answers and
 * produces one consolidated answer. Offline the aggregator is the Mock; with a real
 * provider it genuinely fuses. Its cost is a real receipt charged to the session.
 */
async function synthesizeAnswers(params: {
  prompt: string;
  answers: CouncilAnswer[];
  provider: ModelProvider;
  baseline: ModelInfo;
}): Promise<CouncilAnswer> {
  const { prompt, answers, provider, baseline } = params;
  const fusion =
    `Synthesize the single best answer to: "${prompt}"\n\n` +
    `Candidate answers from ${answers.length} models:\n` +
    answers.map((a, i) => `[${i + 1}] ${a.answer}`).join('\n\n') +
    `\n\nProduce one consolidated, higher-quality answer that combines their strengths.`;

  const gen = await provider.generate({
    model: baseline,
    messages: [{ role: 'user', content: fusion }],
    maxTokens: MAX_OUTPUT_TOKENS,
  });
  const receipt = buildReceipt({
    model: baseline,
    baseline,
    inputTokens: safeTokenCount(gen.inputTokens),
    outputTokens: safeTokenCount(gen.outputTokens),
    reason: `Synthesized from ${answers.length} models (Mixture-of-Agents).`,
  });
  return { answer: gen.text, receipt };
}

function formatUsd(n: number): string {
  return `$${n.toFixed(n < 0.01 ? 4 : 2)}`;
}

function round(n: number, dp: number): number {
  const f = 10 ** dp;
  return Math.round(n * f) / f;
}
