'use client';

import { useState } from 'react';
import { parseMarkdown, type Block, type Inline } from '@/lib/markdown/parse';

/**
 * Renders assistant markdown to React elements (never raw HTML → XSS-safe).
 * Styling follows docs/design-system.md: inline code and code blocks on the sunken
 * surface, code blocks with a language + copy header strip.
 */
export function Markdown({ text }: { text: string }) {
  const blocks = parseMarkdown(text);
  return (
    <div className="space-y-3">
      {blocks.map((b, i) => (
        <BlockView key={i} block={b} />
      ))}
    </div>
  );
}

function BlockView({ block }: { block: Block }) {
  switch (block.type) {
    case 'code':
      return <CodeBlock lang={block.lang} content={block.content} />;
    case 'heading': {
      const cls =
        block.level === 1
          ? 'text-[22px] font-semibold tracking-[-0.015em]'
          : block.level === 2
            ? 'text-[18px] font-semibold tracking-[-0.01em]'
            : 'text-[16px] font-semibold';
      return <div className={cls}><InlineView nodes={block.inline} /></div>;
    }
    case 'ul':
      return (
        <ul className="list-disc space-y-1 pl-5">
          {block.items.map((it, i) => (
            <li key={i}><InlineView nodes={it} /></li>
          ))}
        </ul>
      );
    case 'ol':
      return (
        <ol className="list-decimal space-y-1 pl-5">
          {block.items.map((it, i) => (
            <li key={i}><InlineView nodes={it} /></li>
          ))}
        </ol>
      );
    case 'p':
    default:
      return <p className="whitespace-pre-wrap leading-[26px]"><InlineView nodes={block.inline} /></p>;
  }
}

function InlineView({ nodes }: { nodes: Inline[] }) {
  return (
    <>
      {nodes.map((n, i) => {
        switch (n.type) {
          case 'code':
            return (
              <code key={i} className="rounded-xs bg-surface-sunken px-1.5 py-0.5 font-mono text-[13px]">
                {n.value}
              </code>
            );
          case 'strong':
            return <strong key={i} className="font-semibold">{n.value}</strong>;
          case 'em':
            return <em key={i}>{n.value}</em>;
          case 'link':
            return (
              <a
                key={i}
                href={n.href}
                target="_blank"
                rel="noopener noreferrer nofollow"
                className="text-accent underline underline-offset-2"
              >
                {n.text}
              </a>
            );
          case 'text':
          default:
            return <span key={i}>{n.value}</span>;
        }
      })}
    </>
  );
}

function CodeBlock({ lang, content }: { lang: string; content: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable */
    }
  }
  return (
    <div className="overflow-hidden rounded-md border border-border bg-surface-sunken">
      <div className="flex items-center justify-between border-b border-border px-3 py-1.5">
        <span className="font-mono text-[11px] uppercase tracking-wide text-text-muted">{lang || 'code'}</span>
        <button
          onClick={copy}
          className="rounded-xs px-2 py-0.5 text-[11px] font-medium text-text-secondary transition hover:bg-surface hover:text-text"
        >
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre className="overflow-x-auto p-4 text-[13px] leading-[22px]">
        <code className="font-mono">{content}</code>
      </pre>
    </div>
  );
}
