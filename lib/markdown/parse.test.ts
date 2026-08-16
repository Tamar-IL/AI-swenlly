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

describe('XSS safety', () => {
  it('never emits raw HTML — angle brackets stay literal text', () => {
    const blocks = parseMarkdown('<script>alert(1)</script>');
    expect(blocks[0]).toMatchObject({ type: 'p' });
    if (blocks[0].type === 'p') {
      expect(blocks[0].inline).toEqual([{ type: 'text', value: '<script>alert(1)</script>' }]);
    }
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
