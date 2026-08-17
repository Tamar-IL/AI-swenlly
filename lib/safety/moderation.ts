/**
 * Content moderation — the trust-safety guardrail on inputs and outputs.
 *
 * Offline default: a conservative rules-based classifier for a few unambiguous,
 * high-harm request patterns. It is deliberately narrow (low false-positive) and is
 * a PLACEHOLDER seam — a real deployment swaps `classify` for a moderation model /
 * hosted endpoint. The interface (text -> verdict) is what callers depend on, so the
 * swap is local.
 *
 * Fail-safe principle (trust-safety role): if the classifier itself errors, we REFUSE
 * rather than pass the content through.
 */

export interface ModerationVerdict {
  allowed: boolean;
  category?: string;
  /** User-facing, non-preachy reason shown when content is refused. */
  reason?: string;
}

const ALLOWED: ModerationVerdict = { allowed: true };

// Narrow, high-harm patterns. Specific phrasings keep benign chat from tripping.
const RULES: { category: string; re: RegExp }[] = [
  {
    category: 'self-harm',
    re: /\b(how\s+(to|do\s+i)\s+(kill|hurt|harm)\s+myself|commit\s+suicide|end\s+my\s+life|ways?\s+to\s+kill\s+myself)\b/i,
  },
  {
    category: 'violence',
    re: /\bhow\s+to\s+(make|build|construct)\s+(a\s+)?(bomb|explosive|pipe\s*bomb|nerve\s*agent)\b|\bhow\s+to\s+(kill|murder)\s+(someone|a\s+person|people)\b/i,
  },
  {
    category: 'weapons',
    re: /\bhow\s+to\s+(make|synthesize|produce)\s+(meth|methamphetamine|sarin|ricin|anthrax)\b/i,
  },
];

const REFUSAL: Record<string, string> = {
  'self-harm':
    "I can't help with this. If you're struggling, please reach out to a crisis line — in the US you can call or text 988.",
  violence: "I can't help with that request.",
  weapons: "I can't help with that request.",
};

/** The pluggable core. Returns the first matching category, or allowed. */
function classify(text: string): ModerationVerdict {
  const t = text ?? '';
  for (const rule of RULES) {
    if (rule.re.test(t)) {
      return { allowed: false, category: rule.category, reason: REFUSAL[rule.category] ?? "I can't help with that." };
    }
  }
  return ALLOWED;
}

function safeModerate(text: string): ModerationVerdict {
  try {
    return classify(text);
  } catch {
    // Fail closed: a broken classifier must not become an open door.
    return { allowed: false, category: 'error', reason: 'Content could not be safety-checked — please retry.' };
  }
}

/** Screen a user prompt before it reaches a model. */
export function moderateInput(text: string): ModerationVerdict {
  return safeModerate(text);
}

/** Screen a model's answer before it reaches the user. */
export function moderateOutput(text: string): ModerationVerdict {
  return safeModerate(text);
}
