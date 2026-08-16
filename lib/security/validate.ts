import type { ChatMessage } from '../providers/types';

export const MAX_HISTORY_TURNS = 20;
export const MAX_HISTORY_BYTES = 24_000;
export const MAX_PROMPT_CHARS = 8000;

export interface ValidationError {
  error: string;
  status: number;
}

/**
 * Validate client-supplied conversation history before it reaches a provider.
 *
 * Threats closed:
 *  - Role confusion / prompt injection: clients may NOT forge `system` (or any
 *    non user/assistant) turns — only the server authors trusted instructions.
 *  - Cost/context bypass: `history` is not covered by the prompt-length cap, so an
 *    attacker could hide a huge workload there. We bound turn count and total bytes.
 */
export function validateHistory(raw: unknown): { history: ChatMessage[] } | ValidationError {
  if (raw == null) return { history: [] };
  if (!Array.isArray(raw)) return { error: 'history must be an array', status: 400 };
  if (raw.length > MAX_HISTORY_TURNS) {
    return { error: `history too long (max ${MAX_HISTORY_TURNS} turns)`, status: 400 };
  }

  const history: ChatMessage[] = [];
  let bytes = 0;
  for (const item of raw) {
    if (typeof item !== 'object' || item === null) {
      return { error: 'each history item must be an object', status: 400 };
    }
    const role = (item as Record<string, unknown>).role;
    const content = (item as Record<string, unknown>).content;
    if (role !== 'user' && role !== 'assistant') {
      return { error: 'history roles must be "user" or "assistant"', status: 400 };
    }
    if (typeof content !== 'string') {
      return { error: 'history content must be a string', status: 400 };
    }
    bytes += content.length;
    if (bytes > MAX_HISTORY_BYTES) {
      return { error: `history too large (max ${MAX_HISTORY_BYTES} bytes)`, status: 413 };
    }
    history.push({ role, content });
  }
  return { history };
}

export function isValidationError(x: unknown): x is ValidationError {
  return typeof x === 'object' && x !== null && 'error' in x && 'status' in x;
}
