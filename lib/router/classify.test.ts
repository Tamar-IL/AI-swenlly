import { describe, it, expect } from 'vitest';
import { classifyPrompt } from './classify';

describe('classifyPrompt', () => {
  it('routes simple greetings/factuals to the cheap tier', () => {
    expect(classifyPrompt('hi there').tier).toBe('cheap');
    expect(classifyPrompt('What is the capital of France?').tier).toBe('cheap');
    expect(classifyPrompt('define entropy').tier).toBe('cheap');
  });

  it('routes coding tasks to the strong tier', () => {
    expect(classifyPrompt('Write a python function to reverse a linked list').tier).toBe('strong');
    expect(classifyPrompt('debug this stack trace').tier).toBe('strong');
    expect(classifyPrompt('```js\nconst x = 1\n```').tier).toBe('strong');
  });

  it('routes complex reasoning to the strong tier', () => {
    expect(classifyPrompt('Analyze the tradeoffs between REST and GraphQL').tier).toBe('strong');
    expect(classifyPrompt('Prove that sqrt(2) is irrational').tier).toBe('strong');
  });

  it('routes long, information-dense prompts (no hard signal) to the mid tier', () => {
    expect(classifyPrompt('a '.repeat(400)).tier).toBe('mid');
  });

  it('routes generation tasks to the mid tier', () => {
    expect(classifyPrompt('Write me a short poem about the sea').tier).toBe('mid');
    expect(classifyPrompt('create a landing page headline').tier).toBe('mid');
  });

  it('defaults unknown prompts to the mid tier', () => {
    expect(classifyPrompt('The weather seems nice today.').tier).toBe('mid');
  });

  // --- adversarial regression cases (AI red team / critic) ---
  it('does NOT over-escalate trivial prompts with a lone tech keyword', () => {
    expect(classifyPrompt("What does 'git gud' mean?").tier).toBe('cheap');
    expect(classifyPrompt('define an API in one line').tier).toBe('cheap');
    expect(classifyPrompt('what is sql?').tier).toBe('cheap');
  });

  it('does NOT slip hard questions phrased as simple lookups to the free tier', () => {
    expect(classifyPrompt('What is the worst-case time complexity of quicksort and why?').tier).toBe('strong');
    expect(classifyPrompt('What is a Nash equilibrium and how do I compute one?').tier).toBe('strong');
  });

  it('escalates only when weak tech signals corroborate', () => {
    expect(classifyPrompt('how do I use git?').tier).toBe('cheap'); // lone weak, short lookup
    expect(classifyPrompt('set up a CI pipeline with git, npm and docker for my api').tier).toBe('strong'); // several
  });

  it('handles empty / whitespace / emoji without crashing', () => {
    for (const p of ['', '   ', '😀🎉🔥']) {
      expect(['cheap', 'mid', 'strong']).toContain(classifyPrompt(p).tier);
    }
  });

  it('is deterministic', () => {
    const p = 'Analyze the performance of quicksort';
    expect(classifyPrompt(p)).toEqual(classifyPrompt(p));
  });
});
