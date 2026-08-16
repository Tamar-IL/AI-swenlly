'use client';

import type { Receipt as ReceiptData } from '@/lib/cost/cost';
import { Receipt } from './Receipt';
import { Markdown } from './Markdown';
import { usd } from '@/lib/format';

export interface CouncilAnswer {
  answer: string;
  receipt: ReceiptData;
}

/**
 * Council mode (Mixture-of-Agents): the synthesis (one answer) leads, with the
 * per-model candidates (many minds) shown below as the sources it fused.
 */
export function Council({ answers, synthesis }: { answers: CouncilAnswer[]; synthesis?: CouncilAnswer }) {
  if (!answers.length) return null;

  const cheapest = answers.reduce((m, a) => Math.min(m, a.receipt.costUsd), Infinity);
  const strong = answers.reduce((m, a) => Math.max(m, a.receipt.baselineUsd), 0);
  const total = answers.reduce((s, a) => s + a.receipt.costUsd, 0) + (synthesis?.receipt.costUsd ?? 0);

  return (
    <div className="animate-settle">
      <div className="mb-2 flex items-center gap-2 text-[13px] text-text-secondary">
        <span className="text-accent" aria-hidden>⑂</span> The council convened — {answers.length} models answered
        {synthesis ? ', then one synthesis fused them.' : '.'}
      </div>

      {/* The synthesis — one answer from many minds. */}
      {synthesis && (
        <div className="mb-4 rounded-lg border border-accent bg-surface p-4">
          <div className="mb-2 flex items-center gap-2">
            <span className="rounded-full bg-accent px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-text-inverse">
              ★ Conductor's synthesis
            </span>
            <span className="text-[12px] text-text-muted">one answer, fused from all {answers.length} models</span>
          </div>
          <div className="text-[15px] leading-[24px] text-text">
            <Markdown text={synthesis.answer} />
          </div>
          <div className="mt-3">
            <Receipt receipt={synthesis.receipt} />
          </div>
        </div>
      )}

      {/* The sources — many minds. */}
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-text-muted">
        The sources · {answers.length} minds
      </p>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {answers.map((a) => (
          <div key={a.receipt.modelId} className="relative flex flex-col rounded-lg border border-border bg-surface p-4">
            <div className="mb-2 text-[13px] font-medium text-text">{a.receipt.modelLabel}</div>
            <div className="max-h-[52vh] overflow-y-auto text-[14px] leading-[22px] text-text-secondary">
              <Markdown text={a.answer} />
            </div>
            <div className="mt-3">
              <Receipt receipt={a.receipt} />
            </div>
          </div>
        ))}
      </div>

      <p className="mt-2 text-[12px] text-text-muted">
        {answers.length} minds ·{' '}
        <span className="text-savings">cheapest source cost {usd(cheapest)} vs {usd(strong)} for the strong model</span>{' '}
        · total spent this convene: <span className="font-mono tnum">{usd(total)}</span>
      </p>
    </div>
  );
}
