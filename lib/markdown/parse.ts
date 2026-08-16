/**
 * A tiny, dependency-free markdown parser for assistant answers.
 *
 * Why hand-rolled: it emits a plain data structure that the renderer turns into
 * React elements (never raw HTML), so it is XSS-safe by construction — a model
 * answer containing "<script>" renders as literal text, not markup. Trust & Safety
 * flagged that any rich rendering must never reach dangerouslySetInnerHTML.
 *
 * Scope (enough for chat answers): fenced code blocks, #/##/### headings,
 * unordered + ordered lists, paragraphs, and inline `code`, **bold**, *italic*,
 * and [links](url) with href sanitization.
 */

export type Inline =
  | { type: 'text'; value: string }
  | { type: 'code'; value: string }
  | { type: 'strong'; value: string }
  | { type: 'em'; value: string }
  | { type: 'link'; text: string; href: string };

export type Block =
  | { type: 'code'; lang: string; content: string }
  | { type: 'heading'; level: 1 | 2 | 3; inline: Inline[] }
  | { type: 'ul'; items: Inline[][] }
  | { type: 'ol'; items: Inline[][] }
  | { type: 'p'; inline: Inline[] };

const FENCE_RE = /^```(\w*)\s*$/;
const HEADING_RE = /^(#{1,3})\s+(.*)$/;
const UL_RE = /^[-*]\s+(.*)$/;
const OL_RE = /^\d+\.\s+(.*)$/;

export function parseMarkdown(input: string): Block[] {
  const lines = (input ?? '').replace(/\r\n/g, '\n').split('\n');
  const blocks: Block[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Fenced code block.
    const fence = line.match(FENCE_RE);
    if (fence) {
      const lang = fence[1] || '';
      const body: string[] = [];
      i++;
      while (i < lines.length && !FENCE_RE.test(lines[i])) {
        body.push(lines[i]);
        i++;
      }
      i++; // consume closing fence (if present)
      blocks.push({ type: 'code', lang, content: body.join('\n') });
      continue;
    }

    // Blank line — skip.
    if (line.trim() === '') {
      i++;
      continue;
    }

    // Heading.
    const heading = line.match(HEADING_RE);
    if (heading) {
      const level = heading[1].length as 1 | 2 | 3;
      blocks.push({ type: 'heading', level, inline: parseInline(heading[2]) });
      i++;
      continue;
    }

    // Unordered list (consecutive items).
    if (UL_RE.test(line)) {
      const items: Inline[][] = [];
      while (i < lines.length && UL_RE.test(lines[i])) {
        items.push(parseInline(lines[i].match(UL_RE)![1]));
        i++;
      }
      blocks.push({ type: 'ul', items });
      continue;
    }

    // Ordered list.
    if (OL_RE.test(line)) {
      const items: Inline[][] = [];
      while (i < lines.length && OL_RE.test(lines[i])) {
        items.push(parseInline(lines[i].match(OL_RE)![1]));
        i++;
      }
      blocks.push({ type: 'ol', items });
      continue;
    }

    // Paragraph — gather consecutive plain lines until a blank/structural line.
    const para: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() !== '' &&
      !FENCE_RE.test(lines[i]) &&
      !HEADING_RE.test(lines[i]) &&
      !UL_RE.test(lines[i]) &&
      !OL_RE.test(lines[i])
    ) {
      para.push(lines[i]);
      i++;
    }
    blocks.push({ type: 'p', inline: parseInline(para.join('\n')) });
  }

  return blocks;
}

// Inline: `code` | [text](href) | **bold** | *italic*
const INLINE_RE = /`([^`]+)`|\[([^\]]+)\]\(([^)\s]+)\)|\*\*([^*]+)\*\*|\*([^*]+)\*/g;

export function parseInline(text: string): Inline[] {
  const out: Inline[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  INLINE_RE.lastIndex = 0;

  while ((m = INLINE_RE.exec(text)) !== null) {
    if (m.index > last) out.push({ type: 'text', value: text.slice(last, m.index) });
    if (m[1] !== undefined) {
      out.push({ type: 'code', value: m[1] });
    } else if (m[2] !== undefined && m[3] !== undefined) {
      const href = safeHref(m[3]);
      if (href) out.push({ type: 'link', text: m[2], href });
      else out.push({ type: 'text', value: m[2] }); // unsafe href → plain text
    } else if (m[4] !== undefined) {
      out.push({ type: 'strong', value: m[4] });
    } else if (m[5] !== undefined) {
      out.push({ type: 'em', value: m[5] });
    }
    last = INLINE_RE.lastIndex;
  }
  if (last < text.length) out.push({ type: 'text', value: text.slice(last) });
  return out;
}

/** Allow only http/https/mailto and relative (#, /) hrefs — blocks javascript:, data:, etc. */
export function safeHref(raw: string): string | null {
  const href = raw.trim();
  if (href.startsWith('#') || href.startsWith('/')) return href;
  if (/^https?:\/\//i.test(href) || /^mailto:/i.test(href)) return href;
  return null;
}
