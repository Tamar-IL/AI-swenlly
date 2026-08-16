/**
 * Minimal in-memory fixed-window rate limiter — the real wallet backstop.
 *
 * The per-session cost cap keys on a client-supplied sessionId, so a caller can
 * rotate it to reset spend. This IP-keyed limiter is the control that still holds
 * when sessionId is spoofed. It is per-process (same caveat as the session ledger);
 * a multi-instance deploy moves this to a shared store — noted as a v2 item.
 */
interface Window {
  count: number;
  resetAt: number;
}

const windows = new Map<string, Window>();

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSec: number;
}

export function checkRateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  const w = windows.get(key);

  if (!w || now >= w.resetAt) {
    windows.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: limit - 1, retryAfterSec: 0 };
  }

  if (w.count >= limit) {
    return { allowed: false, remaining: 0, retryAfterSec: Math.ceil((w.resetAt - now) / 1000) };
  }

  w.count += 1;
  return { allowed: true, remaining: limit - w.count, retryAfterSec: 0 };
}

/** Best-effort client IP from proxy headers, falling back to a shared bucket. */
export function clientIp(req: Request): string {
  const xff = req.headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0].trim();
  return req.headers.get('x-real-ip')?.trim() || 'unknown';
}

/** Reset all windows (tests). */
export function resetRateLimits(): void {
  windows.clear();
}
