/**
 * In-memory per-session cost ledger.
 *
 * MVP scope: a process-local Map. This is correct for a single instance and for
 * the eval harness; a serverless deployment with many instances would move this
 * to Redis/KV (noted in the ADR as a v2 item). Kept behind a tiny interface so
 * that swap is a one-file change.
 */
const ledger = new Map<string, number>();

/** Current cumulative USD spent by a session. */
export function getSessionSpend(sessionId: string): number {
  return ledger.get(sessionId) ?? 0;
}

/** Add a call's cost to a session's running total; returns the new total. */
export function addSessionSpend(sessionId: string, costUsd: number): number {
  const next = getSessionSpend(sessionId) + costUsd;
  ledger.set(sessionId, next);
  return next;
}

/** Reset a session (used by tests and the eval harness). */
export function resetSession(sessionId: string): void {
  ledger.delete(sessionId);
}

/** Reset everything (tests). */
export function resetAllSessions(): void {
  ledger.clear();
}

/** The configured hard per-session cap in USD. */
export function sessionCapUsd(env: NodeJS.ProcessEnv = process.env): number {
  const raw = env.CONDUCTOR_SESSION_CAP_USD;
  const parsed = raw ? Number(raw) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0.05;
}
