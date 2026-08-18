import type { Receipt } from '../cost/cost';

export interface SessionSnap {
  spentUsd: number;
  capUsd: number;
  remainingUsd: number;
}

/** The NDJSON event shapes emitted by /api/chat/stream (shared client/server contract). */
export type StreamEvent =
  | { type: 'delta'; text: string }
  | { type: 'done'; receipt?: Receipt; session?: SessionSnap; refused?: boolean }
  | { type: 'blocked'; message?: string; session?: SessionSnap }
  | { type: 'error'; message?: string };

export interface StreamHandlers {
  onDelta(text: string): void;
  onDone(e: Extract<StreamEvent, { type: 'done' }>): void;
  onBlocked(e: Extract<StreamEvent, { type: 'blocked' }>): void;
  onError(message: string): void;
}

/**
 * Consume a chat stream Response into typed callbacks.
 *
 * Robust to the two failure modes the code-review gate found: a non-2xx HTTP
 * response (plain JSON error, NOT NDJSON) is surfaced via onError instead of being
 * silently dropped (which left the UI stuck), and any unterminated trailing line is
 * flushed after the stream ends.
 */
export async function consumeChatStream(res: Response, h: StreamHandlers): Promise<void> {
  if (!res.ok) {
    let msg = `request failed (${res.status})`;
    try {
      const j = await res.json();
      if (j && typeof j.error === 'string') msg = j.error;
    } catch {
      /* non-JSON body */
    }
    h.onError(msg);
    return;
  }
  if (!res.body) {
    h.onError('no response stream');
    return;
  }

  const dispatch = (line: string) => {
    let evt: StreamEvent;
    try {
      evt = JSON.parse(line);
    } catch {
      return; // ignore a malformed line rather than throwing
    }
    if (!evt || typeof evt !== 'object') return;
    switch (evt.type) {
      case 'delta':
        h.onDelta(evt.text ?? '');
        break;
      case 'done':
        h.onDone(evt);
        break;
      case 'blocked':
        h.onBlocked(evt);
        break;
      case 'error':
        h.onError(evt.message ?? 'stream error');
        break;
    }
  };

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let nl: number;
    while ((nl = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, nl).trim();
      buffer = buffer.slice(nl + 1);
      if (line) dispatch(line);
    }
  }
  const tail = buffer.trim();
  if (tail) dispatch(tail); // flush any unterminated final line
}
