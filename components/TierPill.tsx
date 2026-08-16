import type { Tier } from '@/lib/providers/types';

/**
 * The tier pill — the visual thread of the whole system (receipt, scope, council).
 * Color + dot + UPPERCASE label, so a tier is never signalled by color alone.
 */
const STYLES: Record<Tier, { text: string; bg: string; dot: string; label: string }> = {
  cheap: { text: 'text-tier-cheap', bg: 'bg-tier-cheap-bg', dot: 'bg-tier-cheap-solid', label: 'FREE' },
  mid: { text: 'text-tier-mid', bg: 'bg-tier-mid-bg', dot: 'bg-tier-mid-solid', label: 'MID' },
  strong: { text: 'text-tier-strong', bg: 'bg-tier-strong-bg', dot: 'bg-tier-strong-solid', label: 'STRONG' },
};

export function TierPill({ tier, className = '' }: { tier: Tier; className?: string }) {
  const s = STYLES[tier];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-xs px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.06em] ${s.bg} ${s.text} ${className}`}
    >
      <span className={`h-2 w-2 rounded-full ${s.dot}`} aria-hidden />
      {s.label}
    </span>
  );
}

export const TIER_BORDER: Record<Tier, string> = {
  cheap: 'border-tier-cheap-bd',
  mid: 'border-tier-mid-bd',
  strong: 'border-tier-strong-bd',
};
export const TIER_BAR: Record<Tier, string> = {
  cheap: 'bg-tier-cheap-solid',
  mid: 'bg-tier-mid-solid',
  strong: 'bg-tier-strong-solid',
};
