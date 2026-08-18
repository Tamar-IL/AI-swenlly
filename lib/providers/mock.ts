import type {
  GenerateRequest,
  GenerateResult,
  ModelInfo,
  ModelProvider,
} from './types';
import { MOCK_CATALOG } from './catalog';
import { estimateTokens } from '../cost/tokens';

/**
 * Deterministic, offline provider. Same input → same output, no network, no keys.
 *
 * This is a first-class provider, not a test stub: it is the default that lets the
 * whole product run for free. Its text is synthetic but shaped per tier (stronger
 * models write longer, more structured answers) so the UI and receipts feel real.
 * Answer *quality* is never asserted here — the eval harness judges that.
 */
export class MockProvider implements ModelProvider {
  readonly name = 'mock';

  available(): boolean {
    return true; // always — that's the whole point
  }

  models(): ModelInfo[] {
    return MOCK_CATALOG;
  }

  async generate(req: GenerateRequest): Promise<GenerateResult> {
    const { model, messages } = req;
    if (req.signal?.aborted) throw new DOMException('aborted', 'AbortError');
    if (model.provider !== this.name) {
      throw new Error(`MockProvider cannot serve model "${model.id}" (provider=${model.provider})`);
    }

    const prompt = messages.map((m) => m.content).join('\n');
    const inputTokens = estimateTokens(prompt);
    const text = this.synthesize(model, prompt);
    const outputTokens = estimateTokens(text);

    // Deterministic pseudo-latency: stronger models are "slower", but no real wait.
    const latencyMs = 40 + Math.round(model.capability * 60);

    return { text, inputTokens, outputTokens, model, provider: this.name, latencyMs };
  }

  /** Build a synthetic answer whose shape scales with the model's tier. */
  private synthesize(model: ModelInfo, prompt: string): string {
    const topic = firstLine(prompt).slice(0, 80).trim() || 'your question';
    const lead = `Here's a response to "${topic}".`;
    if (model.tier === 'cheap') {
      return `${lead} A concise take from the free open-weights model.`;
    }
    if (model.tier === 'mid') {
      return (
        `${lead}\n\n` +
        `A balanced answer with the key points and a short example, from the mid-tier model.`
      );
    }
    return (
      `${lead}\n\n` +
      `A thorough, structured answer from the frontier model:\n` +
      `1. The direct answer.\n` +
      `2. Why it holds, with the important caveats.\n` +
      `3. A worked example and the edge cases to watch.`
    );
  }
}

function firstLine(s: string): string {
  const i = s.indexOf('\n');
  return i === -1 ? s : s.slice(0, i);
}
