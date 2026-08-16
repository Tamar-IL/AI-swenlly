'use client';

import type { Receipt as ReceiptData } from '@/lib/cost/cost';
import { Receipt } from './Receipt';
import { Markdown } from './Markdown';

export interface ChatTurn {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  receipt?: ReceiptData;
  pending?: boolean;
}

export function Message({ turn }: { turn: ChatTurn }) {
  if (turn.role === 'user') {
    return (
      <div className="animate-settle flex justify-end">
        <div className="ml-auto max-w-[85%] whitespace-pre-wrap rounded-md rounded-tr-xs bg-accent-soft px-4 py-3 text-[16px] leading-[26px] text-text">
          {turn.content}
        </div>
      </div>
    );
  }

  return (
    <div className="animate-settle flex gap-3">
      <div
        className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-accent-soft text-accent"
        aria-hidden
      >
        {/* baton / waveform glyph */}
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
          <path d="M4 12h2M9 7v10M14 4v16M19 9v6" />
        </svg>
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[16px] leading-[26px] text-text">
          {turn.content && <Markdown text={turn.content} />}
          {turn.pending && (
            <span
              className="animate-blinkSoft ml-0.5 inline-block h-[18px] w-[2px] translate-y-[3px] rounded-full bg-accent align-middle"
              aria-hidden
            />
          )}
        </div>
        {turn.receipt && (
          <div className="mt-3">
            <Receipt receipt={turn.receipt} printIn />
          </div>
        )}
      </div>
    </div>
  );
}
