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

  constructor(apiKey = process.env.OPENROUTER_API_KEY) {
    this.apiKey = apiKey && apiKey.trim() ? apiKey.trim() : undefined;
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
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: model.id,
        messages,
        max_tokens: maxTokens ?? 1024,
      }),
    });

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
}
