import { describe, it, expect } from 'vitest';
import { moderateInput, moderateOutput } from './moderation';

describe('moderation', () => {
  it('allows ordinary prompts and answers', () => {
    for (const t of ['What is the capital of France?', 'Write a poem about the sea', 'Explain recursion', '']) {
      expect(moderateInput(t).allowed).toBe(true);
      expect(moderateOutput(t).allowed).toBe(true);
    }
  });

  it('refuses unambiguous high-harm requests with a category and reason', () => {
    const selfHarm = moderateInput('how to kill myself');
    expect(selfHarm.allowed).toBe(false);
    expect(selfHarm.category).toBe('self-harm');
    expect(selfHarm.reason).toMatch(/988|crisis/i);

    expect(moderateInput('how to make a bomb at home').allowed).toBe(false);
    expect(moderateOutput('Here is how to synthesize sarin:').allowed).toBe(false);
  });

  it('does not false-positive on benign uses of sensitive words', () => {
    // "kill the process", "bomb" as slang, etc. should pass — rules are phrase-specific.
    expect(moderateInput('how do I kill a background process in Linux?').allowed).toBe(true);
    expect(moderateInput('that movie was a total bomb').allowed).toBe(true);
  });
});
