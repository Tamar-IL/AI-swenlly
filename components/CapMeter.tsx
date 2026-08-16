'use client';

import { usd } from '@/lib/format';

/**
 * Cost-cap meter + gate. Non-blocking below 80%; warning band 80–99%; the caller
 * renders the full gate card (see page) when spend reaches the cap.
 */
export function CapMeter({ spent, cap }: { spent: number; cap: number }) {
  const frac = cap > 0 ? Math.min(1, spent / cap) : 0;
  const warn = frac >= 0.8;
  return (
    <div className="flex items-center gap-2 text-[12px] text-text-muted">
      <span className={warn ? 'text-warning' : ''}>
        Budget <span className="font-mono tnum">{usd(spent)}</span> / <span className="font-mono tnum">{usd(cap)}</span>
      </span>
      <span className="h-1 w-24 overflow-hidden rounded-full bg-surface-sunken" aria-hidden>
        <span
          className={`block h-full rounded-full transition-[width] ${warn ? 'bg-warning' : 'bg-accent'}`}
          style={{ width: `${frac * 100}%` }}
        />
      </span>
    </div>
  );
}
