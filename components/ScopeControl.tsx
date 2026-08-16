'use client';

import { useEffect, useRef, useState } from 'react';
import type { ModelInfo } from '@/lib/providers/types';
import { TierPill } from './TierPill';

/**
 * Manual model override ("Scope"). Auto = the Conductor routes per message (the
 * product's value). Pinning a model is always framed as a tradeoff (you may pay more).
 */
export function ScopeControl({
  models,
  value,
  onChange,
}: {
  models: ModelInfo[];
  value: string | null; // null = Auto
  onChange: (modelId: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onEsc(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onEsc);
    };
  }, []);

  const pinned = value ? models.find((m) => m.id === value) : null;

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="inline-flex h-9 items-center gap-2 rounded-sm border border-border-strong bg-surface px-3 text-[13px] font-medium text-text transition hover:border-accent"
      >
        {pinned ? (
          <TierPill tier={pinned.tier} />
        ) : (
          <span className="text-accent" aria-hidden>⟐</span>
        )}
        <span>{pinned ? pinned.label : 'Auto'}</span>
        <span className="text-text-muted" aria-hidden>⌄</span>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 z-20 mt-2 w-[300px] rounded-md border border-border bg-surface-raised p-1.5 shadow-lg"
        >
          <button
            role="menuitemradio"
            aria-checked={value === null}
            onClick={() => {
              onChange(null);
              setOpen(false);
            }}
            className={`flex w-full items-start gap-2 rounded-sm px-2.5 py-2 text-left transition ${
              value === null ? 'bg-accent-soft' : 'hover:bg-surface-sunken'
            }`}
          >
            <span className="mt-0.5 text-accent" aria-hidden>⟐</span>
            <span className="flex-1">
              <span className="flex items-center gap-2 text-[13px] font-medium text-text">
                Auto
                <span className="rounded-xs bg-accent-soft px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-accent">
                  Recommended
                </span>
              </span>
              <span className="text-[12px] text-text-muted">Let the Conductor pick the cheapest model that answers well.</span>
            </span>
            {value === null && <span className="text-accent" aria-hidden>✓</span>}
          </button>

          <div className="my-1 border-t border-border" />
          <p className="px-2.5 pb-1 pt-1 text-[11px] font-semibold uppercase tracking-wide text-text-muted">
            Pin a specific model
          </p>

          {models.map((m) => (
            <button
              key={m.id}
              role="menuitemradio"
              aria-checked={value === m.id}
              onClick={() => {
                onChange(m.id);
                setOpen(false);
              }}
              className={`flex w-full items-center gap-2 rounded-sm px-2.5 py-2 text-left transition ${
                value === m.id ? 'bg-accent-soft' : 'hover:bg-surface-sunken'
              }`}
            >
              <TierPill tier={m.tier} />
              <span className="flex-1 text-[13px] text-text">{m.label}</span>
              <span className="font-mono tnum text-[12px] text-text-muted">
                {m.free ? 'free' : `$${((m.inputCostPer1k + m.outputCostPer1k) * 1000).toFixed(2)}/1M`}
              </span>
            </button>
          ))}

          {pinned && (
            <p className="mx-2 mb-1 mt-1.5 rounded-xs px-1 text-[12px] text-warning">
              Pinning a model disables the cost savings from routing.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
