import type {
  GenerateRequest,
  GenerateResult,
  ModelInfo,
  ModelProvider,
} from './types';
import { estimateTokens } from '../cost/tokens';

/**
 * Optional real provider backed by OpenRouter's FREE model tier.
 *
 * Activated only when OPENROUTER_API_KEY is set AND CONDUCTOR_PROVIDER=openrouter.
 * Free models genuinely cost $0, keeping the "runs without paid keys" promise:
 * the only key needed is a free OpenRouter key, and the app still works with none
 * (it falls back to Mock). Model ids below are open-weights free endpoints.
 */
const OPENROUTER_CATALOG: ModelInfo[] = [
  {
    id: 'meta-llama/llama-3.2-3b-instruct:free',
    label: 'Llama 3.2 3B · free',
    tier: 'cheap',
    provider: 'openrouter',
    inputCostPer1k: 0,
    outputCostPer1k: 0,
    free: true,
    capability: 0.6,
  },
  {
    id: 'meta-llama/llama-3.3-70b-instruct:free',
    label: 'Llama 3.3 70B · free',
    tier: 'mid',
    provider: 'openrouter',
    inputCostPer1k: 0,
    outputCostPer1k: 0,
    free: true,
    capability: 0.82,
  },
  {
    id: 'deepseek/deepseek-r1:free',
    label: 'DeepSeek R1 · free',
    tier: 'strong',
    provider: 'openrouter',
    inputCostPer1k: 0,
    outputCostPer1k: 0,
    free: true,
    capability: 0.9,
  },
];

const ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';

export class OpenRouterProvider implements ModelProvider {
  readonly name = 'openrouter';
  private readonly apiKey: string | undefined;
  private readonly timeoutMs: number;
  private readonly maxRetries: number;
  private readonly retryBaseMs: number;

  constructor(
    apiKey = process.env.OPENROUTER_API_KEY,
    opts: { timeoutMs?: number; maxRetries?: number; retryBaseMs?: number } = {},
  ) {
    this.apiKey = apiKey && apiKey.trim() ? apiKey.trim() : undefined;
    this.timeoutMs = opts.timeoutMs ?? 30_000;
    this.maxRetries = opts.maxRetries ?? 2;
    this.retryBaseMs = opts.retryBaseMs ?? 400;
  }

  available(): boolean {
    return this.apiKey !== undefined;
  }

  models(): ModelInfo[] {
    return OPENROUTER_CATALOG;
  }

  async generate(req: GenerateRequest): Promise<GenerateResult> {
    const { model, messages, maxTokens } = req;
    if (model.provider !== this.name) {
      throw new Error(`OpenRouterProvider cannot serve model "${model.id}"`);
    }
    if (!this.apiKey) {
      throw new Error('OPENROUTER_API_KEY is not set');
    }

    const started = Date.now();
    const res = await this.fetchWithRetry(
      {
        model: model.id,
        messages,
        max_tokens: maxTokens ?? 1024,
      },
      req.signal,
    );

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`OpenRouter ${res.status}: ${body.slice(0, 200)}`);
    }

    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    };

    const text = data.choices?.[0]?.message?.content ?? '';
    const inputTokens =
      data.usage?.prompt_tokens ?? estimateTokens(messages.map((m) => m.content).join('\n'));
    const outputTokens = data.usage?.completion_tokens ?? estimateTokens(text);

    return {
      text,
      inputTokens,
      outputTokens,
      model,
      provider: this.name,
      latencyMs: Date.now() - started,
    };
  }

  /**
   * POST with a per-attempt timeout and a bounded retry on transient failures
   * (429 + 5xx + network/timeout errors). OpenRouter's free tier rate-limits
   * aggressively, so a single flaky response shouldn't fail the whole turn.
   * Non-transient responses (e.g. 400/401/403) are returned as-is for the caller
   * to surface — no point retrying an auth or bad-request error.
   */
  private async fetchWithRetry(body: unknown, external?: AbortSignal): Promise<Response> {
    if (external?.aborted) throw new DOMException('aborted', 'AbortError');
    let lastErr: unknown;
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeoutMs);
      // Abort on EITHER our per-attempt timeout OR the caller's cancellation.
      const signal = external ? AbortSignal.any([controller.signal, external]) : controller.signal;
      try {
        const res = await fetch(ENDPOINT, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
          signal,
        });
        clearTimeout(timer);
        if (isTransient(res.status) && attempt < this.maxRetries) {
          await sleep(this.retryBaseMs * 2 ** attempt);
          continue;
        }
        return res;
      } catch (err) {
        clearTimeout(timer);
        lastErr = err;
        // A caller cancellation is final — never retry it (only timeouts/network do).
        if (external?.aborted) throw new DOMException('aborted', 'AbortError');
        if (attempt < this.maxRetries) {
          await sleep(this.retryBaseMs * 2 ** attempt);
          continue;
        }
      }
    }
    throw new Error(`OpenRouter request failed after ${this.maxRetries + 1} attempts: ${String(lastErr)}`);
  }
}

/** 429 (rate limit) and 5xx are worth retrying; 4xx (auth/bad request) are not. */
function isTransient(status: number): boolean {
  return status === 429 || status >= 500;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, Math.max(0, ms)));
}
