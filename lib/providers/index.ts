import type { ModelInfo, ModelProvider } from './types';
import { MockProvider } from './mock';
import { OpenRouterProvider } from './openrouter';

/**
 * Provider registry. Selects the active provider from env, with Mock as the
 * always-available fallback so the product never hard-depends on a key.
 *
 *   CONDUCTOR_PROVIDER=mock        -> deterministic offline (default)
 *   CONDUCTOR_PROVIDER=openrouter  -> real free models, IF OPENROUTER_API_KEY is set
 *
 * If a real provider is requested but unavailable, we degrade to Mock rather than
 * crash — the app keeps working with zero keys.
 */
export function getProvider(env: NodeJS.ProcessEnv = process.env): ModelProvider {
  const requested = (env.CONDUCTOR_PROVIDER ?? 'mock').toLowerCase();

  if (requested === 'openrouter') {
    const or = new OpenRouterProvider(env.OPENROUTER_API_KEY);
    if (or.available()) return or;
    // Requested but no key — fall back, don't break.
    return new MockProvider();
  }

  return new MockProvider();
}

/** The active provider's catalog — the models the router may choose from. */
export function getCatalog(env: NodeJS.ProcessEnv = process.env): ModelInfo[] {
  return getProvider(env).models();
}

export type { ModelProvider, ModelInfo };
export { MockProvider, OpenRouterProvider };
