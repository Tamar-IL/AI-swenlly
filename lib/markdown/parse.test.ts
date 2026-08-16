import { describe, it, expect } from 'vitest';
import { parseMarkdown, parseInline, safeHref } from './parse';

describe('parseMarkdown blocks', () => {
  it('extracts a fenced code block with its language', () => {
    const blocks = parseMarkdown('intro\n\n```python\nprint(1)\nprint(2)\n```\nafter');
    const code = blocks.find((b) => b.type === 'code');
    expect(code).toEqual({ type: 'code', lang: 'python', content: 'print(1)\nprint(2)' });
    // paragraphs before and after survive
    expect(blocks[0]).toMatchObject({ type: 'p' });
    expect(blocks.at(-1)).toMatchObject({ type: 'p' });
  });

  it('parses headings by level', () => {
    const blocks = parseMarkdown('# One\n## Two\n### Three');
    expect(blocks.map((b) => (b.type === 'heading' ? b.level : null))).toEqual([1, 2, 3]);
  });

  it('parses unordered and ordered lists', () => {
    const ul = parseMarkdown('- a\n- b');
    expect(ul[0]).toMatchObject({ type: 'ul' });
    if (ul[0].type === 'ul') expect(ul[0].items).toHaveLength(2);
    const ol = parseMarkdown('1. first\n2. second');
    expect(ol[0]).toMatchObject({ type: 'ol' });
  });
});

describe('parseInline', () => {
  it('parses code, bold, italic, and links', () => {
    expect(parseInline('use `x`')).toEqual([
      { type: 'text', value: 'use ' },
      { type: 'code', value: 'x' },
    ]);
    expect(parseInline('**bold** and *em*')).toEqual([
      { type: 'strong', value: 'bold' },
      { type: 'text', value: ' and ' },
      { type: 'em', value: 'em' },
    ]);
    expect(parseInline('see [docs](https://example.com)')).toEqual([
      { type: 'text', value: 'see ' },
      { type: 'link', text: 'docs', href: 'https://example.com' },
    ]);
  });
});

describe('parser robustness (code-review findings)', () => {
  it('keeps balanced parens in a link URL (Wikipedia-style)', () => {
    const inline = parseInline('see [wiki](https://en.wikipedia.org/wiki/Foo_(bar))');
    const link = inline.find((n) => n.type === 'link');
    expect(link).toEqual({ type: 'link', text: 'wiki', href: 'https://en.wikipedia.org/wiki/Foo_(bar)' });
  });

  it('parses a pathological "[x](" repeat without hanging (bounded, not O(n^2))', () => {
    const nasty = '[x]('.repeat(20000); // no closing ) anywhere
    const start = Date.now();
    const blocks = parseMarkdown(nasty);
    const ms = Date.now() - start;
    expect(blocks.length).toBeGreaterThan(0);
    expect(ms).toBeLessThan(1000); // was multiple seconds before the length bound
  });

  it('lets a longer outer fence contain an inner ``` fence', () => {
    const blocks = parseMarkdown('````md\nExample:\n```\ncode\n```\n````');
    const code = blocks.filter((b) => b.type === 'code');
    expect(code).toHaveLength(1);
    if (code[0].type === 'code') {
      expect(code[0].content).toBe('Example:\n```\ncode\n```');
    }
  });
});

describe('XSS safety', () => {
  it('never emits raw HTML — angle brackets stay literal text', () => {
    const blocks = parseMarkdown('<script>alert(1)</script>');
    expect(blocks[0]).toMatchObject({ type: 'p' });
    if (blocks[0].type === 'p') {
      expect(blocks[0].inline).toEqual([{ type: 'text', value: '<script>alert(1)</script>' }]);
    }
  });

  it('drops protocol-relative and backslash hrefs (off-origin phishing)', () => {
    expect(safeHref('//evil.com/phish')).toBeNull();
    expect(safeHref('/\\evil.com')).toBeNull();
    expect(safeHref('/safe/relative')).toBe('/safe/relative'); // single slash still ok
    const inline = parseInline('[Verify](//evil.com)');
    expect(inline.some((n) => n.type === 'link')).toBe(false);
  });

  it('drops javascript:/data: link hrefs (renders text only)', () => {
    expect(safeHref('javascript:alert(1)')).toBeNull();
    expect(safeHref('data:text/html,evil')).toBeNull();
    expect(safeHref('https://ok.com')).toBe('https://ok.com');
    expect(safeHref('/relative')).toBe('/relative');
    // Unsafe href → the text is kept but NO link node is emitted.
    const inline = parseInline('[click](javascript:steal)');
    expect(inline).toEqual([{ type: 'text', value: 'click' }]);
    expect(inline.some((n) => n.type === 'link')).toBe(false);
  });
});
