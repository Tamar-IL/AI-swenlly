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

  it('routes long prompts to the strong tier', () => {
    expect(classifyPrompt('a '.repeat(400)).tier).toBe('strong');
  });

  it('routes generation tasks to the mid tier', () => {
    expect(classifyPrompt('Write me a short poem about the sea').tier).toBe('mid');
    expect(classifyPrompt('create a landing page headline').tier).toBe('mid');
  });

  it('defaults unknown prompts to the mid tier', () => {
    expect(classifyPrompt('The weather seems nice today.').tier).toBe('mid');
  });

  it('is deterministic', () => {
    const p = 'Analyze the performance of quicksort';
    expect(classifyPrompt(p)).toEqual(classifyPrompt(p));
  });
});
