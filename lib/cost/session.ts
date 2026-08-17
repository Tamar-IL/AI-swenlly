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

/**
 * Reserve-then-reconcile — closes the check-then-act race.
 *
 * The gap between reading spend and charging it spans an `await` (the model call),
 * so two concurrent same-session turns could both pass the cap on a stale snapshot.
 * The fix: reserve the ESTIMATED cost synchronously (no await between the read and
 * this write), so a concurrent turn sees the reservation and is gated correctly;
 * then reconcile to the ACTUAL cost after the call, or release it if the call fails.
 * (Single-process correctness; a multi-instance deploy still needs a shared store.)
 */
export function reserveSpend(sessionId: string, estimatedUsd: number): number {
  return addSessionSpend(sessionId, Math.max(0, estimatedUsd));
}

/** Adjust a prior reservation to the actual cost (actual - reserved). */
export function reconcileSpend(sessionId: string, reservedUsd: number, actualUsd: number): number {
  return addSessionSpend(sessionId, Math.max(0, actualUsd) - Math.max(0, reservedUsd));
}

/** Give back a reservation whose call never produced a charge (e.g. it threw). */
export function releaseSpend(sessionId: string, reservedUsd: number): number {
  return addSessionSpend(sessionId, -Math.max(0, reservedUsd));
}

/** Reset a session (used by tests and the eval harness). */
export function resetSession(sessionId: string): void {
  ledger.delete(sessionId);
}

/** Reset everything (tests). */
export function resetAllSessions(): void {
  ledger.clear();
}

/**
 * The configured hard per-session cap in USD. Accepts an explicit 0 (meaning
 * "no paid spend allowed" — only genuinely free models pass the gate); falls back
 * to the 0.05 default only when unset, blank, non-numeric, or negative.
 */
export function sessionCapUsd(env: NodeJS.ProcessEnv = process.env): number {
  const raw = env.CONDUCTOR_SESSION_CAP_USD;
  const parsed = raw != null && raw.trim() !== '' ? Number(raw) : NaN;
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0.05;
}
