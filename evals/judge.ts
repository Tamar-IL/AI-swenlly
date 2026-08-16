import type { ModelInfo } from '../lib/providers/types';
import type { GoldenCase } from './golden';

/**
 * Answer-quality scoring — PLUGGABLE, and honest about what it is.
 *
 * ── The real target interface ────────────────────────────────────────────────
 * A trustworthy judge reads the ACTUAL answer and is BLIND to which model wrote it
 * (otherwise it just re-derives "stronger model → higher score", the very thing we
 * want to test independently). That interface is `Judge` below. Wiring a real
 * LLM-as-judge or reference scorer means implementing this and running a subset
 * through a real provider — see docs/progress.md.
 *
 * ── The offline default ──────────────────────────────────────────────────────
 * `simulatedScore` is a deterministic SIMULATION for the fast, keyless CI gate.
 * It is NOT a measurement of real quality — it blends a capability-vs-difficulty
 * prior (authored labels) with a real read of the answer text (a degenerate/empty
 * answer scores ~0). The answer-read is what stops the gate from being purely
 * circular: a model that returns nothing now fails, where before the score was a
 * pure function of hand-set numbers. Treat its output as "routing/economics
 * consistency", captioned as such — never as a proven quality percentage.
 */

/** The real, blind judge interface a production scorer implements. */
export interface JudgeInput {
  prompt: string;
  answer: string;
  /** Optional reference answer / rubric for reference-based scoring. */
  reference?: string;
}
export type Judge = (input: JudgeInput) => Promise<number>; // quality in [0,1]

/** Not implemented offline — a real judge needs a provider/network. */
export const unimplementedRealJudge: Judge = async () => {
  throw new Error(
    'Real LLM-as-judge not wired. Implement JudgeInput->quality against a provider, ' +
      'then run the gate with real answers. See docs/progress.md.',
  );
};

const DECAY = 2.0; // how fast the prior falls when a model is under-powered for a prompt
const MIN_ANSWER_CHARS = 12; // below this, an answer is treated as degenerate

/**
 * Offline simulated score. Reads `answer` (so it is not purely circular) and
 * combines it with the capability/difficulty prior. Deterministic, no network.
 */
export function simulatedScore(params: {
  model: ModelInfo;
  case: GoldenCase;
  answer: string;
}): number {
  const { model, case: c, answer } = params;

  // Real read of the artifact: an empty/degenerate answer cannot be high quality,
  // no matter what the labels say. This is the anti-circularity guard.
  const responsiveness = answerResponsiveness(answer, c);
  if (responsiveness === 0) return 0;

  const deficit = Math.max(0, c.difficulty - model.capability);
  const prior = 1 - deficit * DECAY;
  return clamp01(round(prior * responsiveness, 4));
}

/** 0 if the answer is missing/degenerate; else 1 (optionally reference-weighted). */
function answerResponsiveness(answer: string, c: GoldenCase): number {
  const text = (answer ?? '').trim();
  if (text.length < MIN_ANSWER_CHARS) return 0;
  // If a reference keyword set is provided, require at least partial coverage.
  if (c.reference && c.reference.length > 0) {
    const hay = text.toLowerCase();
    const hits = c.reference.filter((k) => hay.includes(k.toLowerCase())).length;
    return hits > 0 ? 1 : 0.5; // partial credit; the mock text won't carry domain terms
  }
  return 1;
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}
function round(n: number, dp: number): number {
  const f = 10 ** dp;
  return Math.round(n * f) / f;
}
