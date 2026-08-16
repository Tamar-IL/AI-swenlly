import type { Tier } from '../lib/providers/types';

/**
 * The golden evaluation set — the go/no-go fixture.
 *
 * Each case carries:
 *  - `difficulty` [0,1]: a labeled benchmark property the offline judge uses to
 *    simulate "a stronger model answers hard prompts better". NOT seen by the app.
 *  - `expectedTier`: the tier the router SHOULD pick — lets the gate report ROUTING
 *    ACCURACY separately from quality, so a router regression is visible on its own.
 *  - `reference` (optional): keywords a good answer would contain (for a future
 *    reference-based/real judge; the offline sim uses them only lightly).
 *
 * The set deliberately includes ADVERSARIAL cases — hard questions disguised as
 * simple lookups, and trivial questions carrying technical keywords — because a
 * gate that only contains prompts the router already gets right proves nothing.
 * Grow this toward 40–60 grounded cases over time (see docs/progress.md).
 */
export interface GoldenCase {
  id: string;
  prompt: string;
  difficulty: number;
  category: 'simple' | 'generation' | 'coding' | 'reasoning';
  expectedTier: Tier;
  reference?: string[];
}

export const GOLDEN_SET: GoldenCase[] = [
  // --- simple / factual (a free model handles these) ---
  { id: 'simple-1', prompt: 'What is the capital of France?', difficulty: 0.15, category: 'simple', expectedTier: 'cheap' },
  { id: 'simple-2', prompt: 'Define photosynthesis in one sentence.', difficulty: 0.2, category: 'simple', expectedTier: 'cheap' },
  { id: 'simple-3', prompt: 'hi, how are you?', difficulty: 0.1, category: 'simple', expectedTier: 'cheap' },
  { id: 'simple-4', prompt: 'What year did the first moon landing happen?', difficulty: 0.2, category: 'simple', expectedTier: 'cheap' },
  { id: 'simple-5', prompt: 'translate "good morning" to Spanish', difficulty: 0.25, category: 'simple', expectedTier: 'cheap' },

  // --- generation (balanced/mid tier) ---
  { id: 'gen-1', prompt: 'Write me a short, upbeat tagline for a coffee shop.', difficulty: 0.45, category: 'generation', expectedTier: 'mid' },
  { id: 'gen-2', prompt: 'Write a short poem about autumn leaves.', difficulty: 0.5, category: 'generation', expectedTier: 'mid' },
  { id: 'gen-3', prompt: 'Create three bullet points for a landing page about a sleep app.', difficulty: 0.55, category: 'generation', expectedTier: 'mid' },
  { id: 'gen-4', prompt: 'Write a persuasive product-launch email with a subject line, hook, and CTA.', difficulty: 0.82, category: 'generation', expectedTier: 'mid' },

  // --- coding (needs the strong model) ---
  { id: 'code-1', prompt: 'Write a Python function to reverse a linked list.', difficulty: 0.85, category: 'coding', expectedTier: 'strong' },
  { id: 'code-2', prompt: 'Debug this stack trace: TypeError: cannot read property map of undefined in my React component.', difficulty: 0.88, category: 'coding', expectedTier: 'strong' },
  { id: 'code-3', prompt: 'Write a SQL query to find the second-highest salary per department.', difficulty: 0.9, category: 'coding', expectedTier: 'strong' },

  // --- reasoning (needs the strong model) ---
  { id: 'reason-1', prompt: 'Analyze the tradeoffs between microservices and a monolith for an early-stage startup.', difficulty: 0.87, category: 'reasoning', expectedTier: 'strong' },
  { id: 'reason-2', prompt: 'Prove that the square root of 2 is irrational, step by step.', difficulty: 0.92, category: 'reasoning', expectedTier: 'strong' },
  { id: 'reason-3', prompt: 'Explain why optimizing purely for cost can degrade answer quality, and how to balance them.', difficulty: 0.86, category: 'reasoning', expectedTier: 'strong' },

  // --- ADVERSARIAL: hard questions disguised as simple lookups (must NOT go cheap) ---
  { id: 'adv-hard-1', prompt: 'What is the worst-case time complexity of quicksort and why?', difficulty: 0.83, category: 'reasoning', expectedTier: 'strong' },
  { id: 'adv-hard-2', prompt: 'What is a Nash equilibrium and how do I compute one for a 2-player game?', difficulty: 0.85, category: 'reasoning', expectedTier: 'strong' },

  // --- ADVERSARIAL: trivial questions carrying technical keywords (must NOT go strong) ---
  { id: 'adv-easy-1', prompt: "What does 'git gud' mean?", difficulty: 0.15, category: 'simple', expectedTier: 'cheap' },
  { id: 'adv-easy-2', prompt: 'define an API in one line', difficulty: 0.2, category: 'simple', expectedTier: 'cheap' },
];
