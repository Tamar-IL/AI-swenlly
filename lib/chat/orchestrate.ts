import type { ChatMessage, ModelInfo, ModelProvider } from '../providers/types';
import { getProvider, getCatalog } from '../providers';
import { baselineModel } from '../providers/catalog';
import { route, MAX_OUTPUT_TOKENS } from '../router/router';
import { buildReceipt, costOf, type Receipt } from '../cost/cost';
import { estimateMessagesTokens, estimateTokens, safeTokenCount } from '../cost/tokens';
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

  // Pre-flight: refuse if we can't even afford the N member calls (priced at max output).
  const inputTokens = estimateMessagesTokens(messages.map((m) => m.content));
  const memberProjected = catalog.reduce((sum, m) => sum + costOf(m, inputTokens, MAX_OUTPUT_TOKENS), 0);
  if (memberProjected > remainingUsd) {
    return {
      blocked: true,
      answers: [],
      session: { spentUsd, capUsd, remainingUsd },
      message:
        `Convening the council would cost about ${formatUsd(memberProjected)}, over the remaining ` +
        `${formatUsd(remainingUsd)} in this session's cap. Start a new session to continue.`,
    };
  }

  // Fan out. allSettled so one flaky model doesn't discard the others' answers.
  const settled = await Promise.allSettled(
    catalog.map(async (model) => {
      const gen = await provider.generate({ model, messages, maxTokens: MAX_OUTPUT_TOKENS });
      const receipt = buildReceipt({
        model,
        baseline,
        inputTokens: safeTokenCount(gen.inputTokens),
        outputTokens: safeTokenCount(gen.outputTokens),
        reason: `Council member (${model.tier}).`,
      });
      return { answer: gen.text, receipt } as CouncilAnswer;
    }),
  );
  const answers: CouncilAnswer[] = settled
    .filter((s): s is PromiseFulfilledResult<CouncilAnswer> => s.status === 'fulfilled')
    .map((s) => s.value);

  if (answers.length === 0) {
    return {
      blocked: true,
      answers: [],
      session: { spentUsd, capUsd, remainingUsd },
      message: 'Every council model failed to answer — please retry.',
    };
  }

  // Charge only the members that actually answered.
  let newSpent = spentUsd;
  for (const a of answers) newSpent = addSessionSpend(input.sessionId, a.receipt.costUsd);

  // Synthesis: gated on its ACTUAL fusion cost (not the pre-flight heuristic) so it can
  // never breach the cap, and wrapped so a synthesis failure never loses the answers
  // the user already paid for.
  let synthesis: CouncilAnswer | undefined;
  let note: string | undefined;
  if (doSynthesis) {
    const fusion = buildFusionPrompt(input.prompt, answers);
    const synthCostEst = costOf(baseline, estimateTokens(fusion), MAX_OUTPUT_TOKENS);
    const remainingNow = Math.max(0, capUsd - newSpent);
    if (synthCostEst > remainingNow) {
      note = 'Synthesis skipped — it would exceed the remaining session budget. Showing the sources.';
    } else {
      try {
        synthesis = await synthesizeAnswers({ fusion, answers, provider, baseline });
        newSpent = addSessionSpend(input.sessionId, synthesis.receipt.costUsd);
      } catch {
        note = 'Synthesis failed — showing the sources. You were not charged for the synthesis.';
      }
    }
  }

  return {
    blocked: false,
    answers,
    synthesis,
    message: note,
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
function buildFusionPrompt(prompt: string, answers: CouncilAnswer[]): string {
  return (
    `Synthesize the single best answer to: "${prompt}"\n\n` +
    `Candidate answers from ${answers.length} models:\n` +
    answers.map((a, i) => `[${i + 1}] ${a.answer}`).join('\n\n') +
    `\n\nProduce one consolidated, higher-quality answer that combines their strengths.`
  );
}

async function synthesizeAnswers(params: {
  fusion: string;
  answers: CouncilAnswer[];
  provider: ModelProvider;
  baseline: ModelInfo;
}): Promise<CouncilAnswer> {
  const { fusion, answers, provider, baseline } = params;

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
