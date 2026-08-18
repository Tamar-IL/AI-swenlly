/**
 * Core types for the Conductor's model layer.
 *
 * The whole product is an orchestrator over MANY models. Everything below the
 * router talks to a single `ModelProvider` interface, so a deterministic offline
 * Mock and a real free-inference backend are interchangeable. This is what lets
 * the app, the tests, and the eval harness all run with ZERO keys and ZERO network.
 */

/** Capability/cost tier. Router picks a tier; the receipt colour-codes it. */
export type Tier = 'cheap' | 'mid' | 'strong';

export const TIERS: Tier[] = ['cheap', 'mid', 'strong'];

/** A single model the Conductor can route to. */
export interface ModelInfo {
  /** Canonical id used in APIs and receipts, e.g. "mock-cheap". */
  id: string;
  /** Human display name shown in the UI, e.g. "Conductor Free (open weights)". */
  label: string;
  tier: Tier;
  /** Which provider backend serves this model, e.g. "mock" | "openrouter". */
  provider: string;
  /** USD per 1,000 input tokens. Free models are 0. */
  inputCostPer1k: number;
  /** USD per 1,000 output tokens. Free models are 0. */
  outputCostPer1k: number;
  /** True for genuinely free (open-weights / free-inference) models. */
  free: boolean;
  /**
   * Intrinsic answer-quality capability in [0,1]. NOT used by the production
   * router (which only reasons about tiers); it is the honest quality prior the
   * offline eval judge uses to simulate "stronger model → better hard answers".
   * A real LLM-as-judge replaces this at eval time.
   */
  capability: number;
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface GenerateRequest {
  model: ModelInfo;
  messages: ChatMessage[];
  /** Soft cap on output tokens. Providers may approximate. */
  maxTokens?: number;
  /** Aborts an in-flight call (e.g. the client disconnected) so we don't keep
   *  spending on an answer nobody will read. Providers should honour it. */
  signal?: AbortSignal;
}

export interface GenerateResult {
  text: string;
  inputTokens: number;
  outputTokens: number;
  model: ModelInfo;
  provider: string;
  latencyMs: number;
}

/**
 * The one interface every backend implements. Add a real provider by
 * implementing this and registering it in `providers/index.ts`.
 */
export interface ModelProvider {
  readonly name: string;
  /** True when the provider is usable in this environment (keys/config present). */
  available(): boolean;
  /** The models this provider serves, as a catalog slice. */
  models(): ModelInfo[];
  /** Produce a completion. MUST reject if the model isn't served by this provider. */
  generate(req: GenerateRequest): Promise<GenerateResult>;
}
