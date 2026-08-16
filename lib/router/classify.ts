import type { Tier } from '../providers/types';

/**
 * Lightweight, rules-based prompt classification. Deliberately NOT an ML model
 * (that's a later, evidence-gated step) — transparent, free, deterministic, testable.
 *
 * Hardened against the two gaming vectors the AI red team / critic found:
 *  - A lone weak tech keyword ("git", "api", "sql", "java"…) no longer forces the
 *    expensive strong model onto a trivial prompt — weak signals need corroboration.
 *  - A hard question phrased as a short "what is…" lookup no longer slips to the
 *    free model — complexity terms (complexity, equilibrium, theorem…) escalate.
 */

export interface Classification {
  tier: Tier;
  /** Which signal decided it — surfaced in the receipt's reason. */
  signal: string;
  /** Every signal that fired, for debugging/eval transparency. */
  matched: string[];
  chars: number;
}

// Structural / unambiguous "this is hard" signals — any one → strong.
const STRONG_RE =
  /```|=>|\bdef\s|\bclass\s|\bfunction\b|\bdebug\b|stack\s?trace|\bregex\b|\bcompile\b|\brefactor\b|\balgorithm\b|\bcomplexity\b|\bequilibrium\b|\bderivative\b|\bintegral\b|\btheorem\b|\brecursion\b|\bnp-?hard\b|\bbig-?o\b|\bprove\b|\bderive\b|\banaly[sz]e\b|\barchitect\b|\boptimi[sz]e\b|\btrade[- ]?offs?\b|\bimplications\b|\bstrategy\b|\bevaluate\b|explain\s+why|why\s+(does|do|is|are)|step[- ]by[- ]step|pros\s+and\s+cons|write\s+(a|an|me)?\s*\w*\s*(function|query|program|script|regex|sql|method|algorithm|class)/i;

// Weak technical tokens — escalate ONLY with corroboration (2+, or with length).
const WEAK_TECH_RE = /\b(api|git|sql|java|rust|javascript|typescript|python|c\+\+|npm|async|http|json|kubernetes|docker)\b/gi;

// Content-generation tasks → mid.
const BUILDER_RE =
  /\b(write|create|generate|make|build|website|landing\s?page|component|app|persona|draft|compose|design\s+a|email|blog|article|story|essay)\b/i;

// Simple lookups / chit-chat → cheap (when short and not strong).
const GREETING_RE = /^\s*(hi|hey|hello|thanks|thank\s+you|yo|sup|good\s+(morning|evening|afternoon))\b/i;
const DEFINE_RE = /^\s*(define|translate|convert|spell)\b/i;
const SIMPLE_LEAD_RE = /^\s*(what|who|when|where|which|how|is|are|do|does|did|can|could|would|should)\b/i;

const LONG_CHARS = 600;
const SHORT_CHARS = 120;

/** Classify a prompt into a suggested tier via ordered, corroborated rules. */
export function classifyPrompt(prompt: string): Classification {
  const text = prompt ?? '';
  const chars = text.length;
  const matched: string[] = [];

  const isStrong = STRONG_RE.test(text);
  const weakCount = (text.match(WEAK_TECH_RE) ?? []).length;
  const isBuilder = BUILDER_RE.test(text);
  const isLong = chars >= LONG_CHARS;
  const isShort = chars <= SHORT_CHARS;
  const looksSimple = GREETING_RE.test(text) || DEFINE_RE.test(text) || SIMPLE_LEAD_RE.test(text);

  if (isStrong) matched.push('strong-signal');
  if (weakCount > 0) matched.push(`weak-tech×${weakCount}`);
  if (isBuilder) matched.push('generation');
  if (isLong) matched.push('long');
  if (looksSimple) matched.push('simple');

  // 1. Unambiguous hard signal → strong.
  if (isStrong) return { tier: 'strong', signal: 'strong-signal', matched, chars };

  // 2. Weak tech signals only escalate with corroboration (multiple, or long+technical).
  if (weakCount >= 2 || (weakCount >= 1 && isLong)) {
    return { tier: 'strong', signal: 'corroborated-technical', matched, chars };
  }

  // 3. Short, simple-looking lookup with at most an incidental tech word → cheap.
  if (looksSimple && isShort && weakCount <= 1) {
    return { tier: 'cheap', signal: 'simple', matched, chars };
  }

  // 4. Content generation → mid.
  if (isBuilder) return { tier: 'mid', signal: 'generation', matched, chars };

  // 5. Long, information-dense prompt with no hard signal → balanced tier.
  if (isLong) return { tier: 'mid', signal: 'long-prompt', matched, chars };

  // 6. Unknown/medium prompts default to the balanced tier.
  return { tier: 'mid', signal: 'default', matched, chars };
}

/** A short human explanation for the receipt, given a classification + chosen tier. */
export function reasonFor(c: Classification, chosenTier: Tier): string {
  const map: Record<string, string> = {
    'strong-signal': 'Detected a coding/complex-reasoning task → routed to the strong model.',
    'corroborated-technical': 'Multiple technical signals → routed to the strong model.',
    generation: 'Content-generation task → routed to the balanced model.',
    'long-prompt': 'Long, information-dense prompt → routed to the balanced model.',
    simple: 'Simple question → routed to the free model.',
    default: 'General question → routed to the balanced model.',
  };
  const base = map[c.signal] ?? 'Routed by the rules-based router.';
  if (chosenTier !== c.tier) {
    return `${base} (Adjusted to the ${chosenTier} tier to stay within the cost cap.)`;
  }
  return base;
}
