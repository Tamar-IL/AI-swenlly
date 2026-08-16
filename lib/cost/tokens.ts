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
