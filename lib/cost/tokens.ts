/**
 * Token estimation. Real providers report exact usage; when they don't (and the
 * Mock never calls out), we approximate with ~4 chars/token and round UP, so the
 * cost cap always over-charges rather than under-charges (fail safe for the wallet).
 */
export function estimateTokens(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}

/** Estimate tokens for a set of chat messages (role tokens are negligible here). */
export function estimateMessagesTokens(contents: string[]): number {
  return contents.reduce((sum, c) => sum + estimateTokens(c), 0);
}

/**
 * Coerce a provider-reported token count into a safe, finite, non-negative integer.
 * A malformed usage payload (NaN, Infinity, a stray string, a negative) must never
 * reach the cost math — a single NaN would poison the session ledger and silently
 * disable the cost cap for the rest of the session. (QA gate finding.)
 */
export function safeTokenCount(n: unknown): number {
  const num = typeof n === 'number' ? n : Number(n);
  if (!Number.isFinite(num) || num < 0) return 0;
  return Math.floor(num);
}
