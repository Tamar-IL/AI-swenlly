import type { Tier } from '../providers/types';

/**
 * Lightweight, rules-based prompt classification. Deliberately NOT an ML model
 * (that's a later, evidence-gated step) — this is transparent, free, deterministic,
 * and unit-testable. It reads a handful of cheap signals off the prompt and maps
 * them to a suggested tier.
 */

export interface Classification {
  tier: Tier;
  /** Which signal decided it — surfaced in the receipt's reason. */
  signal: string;
  /** Every signal that fired, for debugging/eval transparency. */
  matched: string[];
  chars: number;
}

const CODING_RE =
  /\b(code|function|bug|debug|stack\s?trace|regex|sql|api|compile|refactor|typescript|python|javascript|rust|java|c\+\+|async|npm|git)\b|```|=>|\bdef\s|\bclass\s|\bimport\s/i;

const COMPLEX_RE =
  /\b(prove|derive|analyze|analyse|architect|design|optimi[sz]e|trade[- ]?off|explain\s+why|step[- ]by[- ]step|reason|strategy|compare|evaluate|implications|why\s+does|how\s+would|pros\s+and\s+cons)\b/i;

const BUILDER_RE =
  /\b(build|create|generate|make|website|landing\s?page|component|app|persona|write\s+(a|an|me)\b|draft|compose|design\s+a)\b/i;

const SIMPLE_RE =
  /^\s*(hi|hey|hello|thanks|thank\s+you|yo|sup|good\s+(morning|evening))\b|^\s*(what|who|when|where)\s+(is|are|was|were)\b|^\s*(define|translate|convert|spell)\b/i;

const LONG_CHARS = 600; // long prompts tend to carry more complexity

/** Classify a prompt into a suggested tier via ordered, first-match rules. */
export function classifyPrompt(prompt: string): Classification {
  const text = prompt ?? '';
  const chars = text.length;
  const matched: string[] = [];

  const isCoding = CODING_RE.test(text);
  const isComplex = COMPLEX_RE.test(text);
  const isBuilder = BUILDER_RE.test(text);
  const isSimple = SIMPLE_RE.test(text);
  const isLong = chars >= LONG_CHARS;

  if (isCoding) matched.push('coding');
  if (isComplex) matched.push('complex-reasoning');
  if (isBuilder) matched.push('generation');
  if (isSimple) matched.push('simple');
  if (isLong) matched.push('long');

  // Ordered precedence: hardest signals win.
  if (isCoding) return { tier: 'strong', signal: 'coding', matched, chars };
  if (isComplex) return { tier: 'strong', signal: 'complex-reasoning', matched, chars };
  if (isLong) return { tier: 'strong', signal: 'long-prompt', matched, chars };
  if (isBuilder) return { tier: 'mid', signal: 'generation', matched, chars };
  if (isSimple) return { tier: 'cheap', signal: 'simple', matched, chars };

  // Unknown/medium prompts: default to the balanced tier.
  return { tier: 'mid', signal: 'default', matched, chars };
}

/** A short human explanation for the receipt, given a classification + chosen tier. */
export function reasonFor(c: Classification, chosenTier: Tier): string {
  const map: Record<string, string> = {
    coding: 'Detected a coding/technical task → routed to the strong model.',
    'complex-reasoning': 'Detected complex reasoning → routed to the strong model.',
    'long-prompt': 'Long, information-dense prompt → routed to the strong model.',
    generation: 'Content-generation task → routed to the balanced model.',
    simple: 'Simple question → routed to the free model.',
    default: 'General question → routed to the balanced model.',
  };
  const base = map[c.signal] ?? 'Routed by the rules-based router.';
  if (chosenTier !== c.tier) {
    return `${base} (Adjusted to the ${chosenTier} tier to stay within the cost cap.)`;
  }
  return base;
}
