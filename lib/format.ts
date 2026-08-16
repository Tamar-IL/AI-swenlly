/** Formatting helpers shared by server and client (no runtime deps). */

/** Format a USD amount with adaptive precision for tiny sums. */
export function usd(n: number): string {
  if (n === 0) return '$0';
  if (n < 0.01) return `$${n.toFixed(4)}`;
  if (n < 1) return `$${n.toFixed(3)}`;
  return `$${n.toFixed(2)}`;
}

/** Format a token count with thousands separators. */
export function tokens(n: number): string {
  return n.toLocaleString('en-US');
}

export function pct(n: number): string {
  return `${Math.round(n)}%`;
}
