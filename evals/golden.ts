/**
 * The golden evaluation set — the go/no-go fixture.
 *
 * Each case carries a `difficulty` in [0,1]: a labeled property of the benchmark
 * (like a difficulty tag on any eval set), NOT something the app sees. The offline
 * judge uses it to simulate "a stronger model answers hard prompts better". Swap in
 * a real LLM-as-judge + real providers and these labels become optional.
 *
 * The spread is intentional: easy prompts a free model nails, mid generation tasks,
 * and hard coding/reasoning that genuinely needs the strong model. This is what makes
 * the "routed ≈ strong at far lower cost" result meaningful rather than rigged.
 */
export interface GoldenCase {
  id: string;
  prompt: string;
  /** 0 = trivial, 1 = frontier-hard. */
  difficulty: number;
  category: 'simple' | 'generation' | 'coding' | 'reasoning';
}

export const GOLDEN_SET: GoldenCase[] = [
  // --- simple / factual (a free model handles these) ---
  { id: 'simple-1', prompt: 'What is the capital of France?', difficulty: 0.15, category: 'simple' },
  { id: 'simple-2', prompt: 'Define photosynthesis in one sentence.', difficulty: 0.2, category: 'simple' },
  { id: 'simple-3', prompt: 'hi, how are you?', difficulty: 0.1, category: 'simple' },
  { id: 'simple-4', prompt: 'What year did the first moon landing happen?', difficulty: 0.2, category: 'simple' },
  { id: 'simple-5', prompt: 'translate "good morning" to Spanish', difficulty: 0.25, category: 'simple' },

  // --- generation (balanced/mid tier) ---
  { id: 'gen-1', prompt: 'Write me a short, upbeat tagline for a coffee shop.', difficulty: 0.45, category: 'generation' },
  { id: 'gen-2', prompt: 'Write a short poem about autumn leaves.', difficulty: 0.5, category: 'generation' },
  { id: 'gen-3', prompt: 'Create three bullet points for a landing page about a sleep app.', difficulty: 0.55, category: 'generation' },
  // A deliberately harder generation task: mid handles it decently, strong is better.
  { id: 'gen-4', prompt: 'Write a persuasive product-launch email with a subject line, hook, and CTA.', difficulty: 0.82, category: 'generation' },

  // --- coding (needs the strong model) ---
  { id: 'code-1', prompt: 'Write a Python function to reverse a linked list.', difficulty: 0.85, category: 'coding' },
  { id: 'code-2', prompt: 'Debug this stack trace: TypeError: cannot read property map of undefined in my React component.', difficulty: 0.88, category: 'coding' },
  { id: 'code-3', prompt: 'Write a SQL query to find the second-highest salary per department.', difficulty: 0.9, category: 'coding' },

  // --- reasoning (needs the strong model) ---
  { id: 'reason-1', prompt: 'Analyze the tradeoffs between microservices and a monolith for an early-stage startup.', difficulty: 0.87, category: 'reasoning' },
  { id: 'reason-2', prompt: 'Prove that the square root of 2 is irrational, step by step.', difficulty: 0.92, category: 'reasoning' },
  { id: 'reason-3', prompt: 'Explain why optimizing purely for cost can degrade answer quality, and how to balance them.', difficulty: 0.86, category: 'reasoning' },
];
