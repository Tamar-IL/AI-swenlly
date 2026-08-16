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
 * Council mode (v1): three answers side by side, no fusion yet. The cheapest
 * column is marked as the Conductor's pick — "one answer resolving out of many minds".
 */
export function Council({ answers }: { answers: CouncilAnswer[] }) {
  if (!answers.length) return null;

  // Conductor's pick = cheapest column (the value proposition made visible).
  const pickIdx = answers.reduce(
    (best, a, i) => (a.receipt.costUsd < answers[best].receipt.costUsd ? i : best),
    0,
  );
  const strong = answers.reduce((m, a) => Math.max(m, a.receipt.baselineUsd), 0);
  const total = answers.reduce((s, a) => s + a.receipt.costUsd, 0);

  return (
    <div className="animate-settle">
      <div className="mb-2 flex items-center gap-2 text-[13px] text-text-secondary">
        <span className="text-accent" aria-hidden>⑂</span> The council convened — {answers.length} models answered.
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {answers.map((a, i) => (
          <div
            key={a.receipt.modelId}
            className={`relative flex flex-col rounded-lg border bg-surface p-4 ${
              i === pickIdx ? 'border-accent' : 'border-border'
            }`}
          >
            {i === pickIdx && (
              <span className="absolute -top-2 right-3 rounded-full bg-accent px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-text-inverse shadow-accent">
                ★ Conductor's pick
              </span>
            )}
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
        Same question, {answers.length} minds ·{' '}
        <span className="text-savings">
          the pick cost {usd(answers[pickIdx].receipt.costUsd)} vs {usd(strong)} for the strong model
        </span>{' '}
        · total spent this compare: <span className="font-mono tnum">{usd(total)}</span>
      </p>
    </div>
  );
}
