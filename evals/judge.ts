import type { ModelInfo } from '../lib/providers/types';
import type { GoldenCase } from './golden';

/**
 * Answer-quality judge — PLUGGABLE.
 *
 * Offline default: a deterministic simulation. A model answers a prompt well when
 * its `capability` meets the prompt's `difficulty`; beyond that, quality decays
 * linearly. This encodes the honest prior "stronger models handle harder prompts
 * better" without any network or keys, so the go/no-go gate runs anywhere.
 *
 * To make the gate authoritative, replace `simulatedJudge` with an LLM-as-judge
 * (or reference-based scorer) that reads the ACTUAL answer text. The harness only
 * depends on the `Judge` type, so that swap is local.
 */
export type Judge = (params: {
  model: ModelInfo;
  case: GoldenCase;
  answer: string;
}) => number; // quality in [0,1]

const DECAY = 2.0; // how fast quality falls when a model is under-powered for a prompt

export const simulatedJudge: Judge = ({ model, case: c }) => {
  const deficit = Math.max(0, c.difficulty - model.capability);
  const quality = 1 - deficit * DECAY;
  return clamp01(round(quality, 4));
};

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}
function round(n: number, dp: number): number {
  const f = 10 ** dp;
  return Math.round(n * f) / f;
}
