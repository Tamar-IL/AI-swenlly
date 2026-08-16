'use client';

import { useState } from 'react';
import type { Receipt as ReceiptData } from '@/lib/cost/cost';
import { usd, tokens, pct } from '@/lib/format';
import { TierPill, TIER_BORDER, TIER_BAR } from './TierPill';

/**
 * ★ THE RECEIPT — the signature component. Collapsed = one honest line; expanded =
 * an audited ledger with the strong-tier counterfactual and the savings bar.
 */
export function Receipt({ receipt, printIn = false }: { receipt: ReceiptData; printIn?: boolean }) {
  const [open, setOpen] = useState(false);
  const savedZero = receipt.savedUsd === 0;

  const aria = savedZero
    ? `Answered by ${receipt.modelLabel}, ${receipt.tier} tier. Cost ${usd(receipt.costUsd)}. This was the right model — nothing wasted.`
    : `Answered by ${receipt.modelLabel}, ${receipt.tier} tier. Cost ${usd(receipt.costUsd)}. Saved ${usd(receipt.savedUsd)} versus forcing the strong tier.`;

  return (
    <div className={printIn ? 'animate-printIn' : ''}>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label={aria}
        className={`group inline-flex max-w-full items-center gap-3 overflow-hidden rounded-md border bg-surface py-2 pl-3 pr-3 text-[13px] shadow-sm transition hover:shadow-md ${TIER_BORDER[receipt.tier]}`}
      >
        <span className={`-ml-3 mr-0 h-6 w-[3px] rounded-full ${TIER_BAR[receipt.tier]}`} aria-hidden />
        <TierPill tier={receipt.tier} />
        <span className="font-medium text-text">{receipt.modelLabel}</span>
        <span className="text-text-muted" aria-hidden>·</span>
        <span className="font-mono tnum text-text-secondary">{tokens(receipt.inputTokens + receipt.outputTokens)} tok</span>
        <span className="text-text-muted" aria-hidden>·</span>
        <span className="font-mono tnum text-text-secondary">{usd(receipt.costUsd)}</span>
        <span className="text-text-muted" aria-hidden>·</span>
        {savedZero ? (
          <span className="text-text-muted">best model for this</span>
        ) : (
          <span className="font-semibold text-savings" title="vs. always using the strong model">
            saved {usd(receipt.savedUsd)}
          </span>
        )}
        <span className={`ml-1 text-text-muted transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden>⌄</span>
      </button>

      {open && (
        <dl className="mt-2 max-w-[420px] rounded-md border border-border bg-surface-raised p-4 text-[13px] shadow-md">
          <div className="mb-2 flex items-center gap-2">
            <TierPill tier={receipt.tier} />
            <span className="font-medium text-text">{receipt.modelLabel}</span>
          </div>
          <p className="mb-3 text-[12px] leading-4 text-text-muted">
            <span className="text-text-secondary">Chosen because:</span> {receipt.reason}
          </p>

          <div className="grid grid-cols-[1fr_auto] gap-x-6 gap-y-1 border-t border-border pt-3 font-mono tnum">
            <dt className="font-sans text-text-secondary">Input</dt>
            <dd className="text-right text-text-secondary">{tokens(receipt.inputTokens)} tok</dd>
            <dt className="font-sans text-text-secondary">Output</dt>
            <dd className="text-right text-text-secondary">{tokens(receipt.outputTokens)} tok</dd>
            <dt className="mt-1 border-t border-border pt-1 font-sans font-semibold text-text">This answer</dt>
            <dd className="mt-1 border-t border-border pt-1 text-right font-semibold text-text">{usd(receipt.costUsd)}</dd>
          </div>

          <div className="mt-3 grid grid-cols-[1fr_auto] gap-x-6 gap-y-1 border-t border-border pt-3 font-mono tnum">
            <dt className="font-sans text-text-muted">If forced to the strong tier</dt>
            <dd className="text-right text-text-muted">{usd(receipt.baselineUsd)}</dd>
            {!savedZero && (
              <>
                <dt className="font-sans text-[15px] font-semibold text-savings">You saved</dt>
                <dd className="text-right text-[15px] font-semibold text-savings">{usd(receipt.savedUsd)}</dd>
              </>
            )}
          </div>

          {!savedZero && (
            <div className="mt-3">
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-sunken">
                <div
                  className="h-full rounded-full bg-savings transition-[width] duration-[380ms] ease-out"
                  style={{ width: `${Math.min(100, receipt.savedPct)}%` }}
                />
              </div>
              <p className="mt-1 text-[12px] text-text-muted">{pct(receipt.savedPct)} cheaper than the strong model</p>
            </div>
          )}
          {savedZero && (
            <p className="mt-3 text-[12px] text-text-muted">
              This was a job for the strong model — you paid for exactly what the task needed.
            </p>
          )}
        </dl>
      )}
    </div>
  );
}
