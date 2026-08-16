import { NextResponse } from 'next/server';
import { council } from '@/lib/chat/orchestrate';
import { validateHistory, isValidationError, MAX_PROMPT_CHARS } from '@/lib/security/validate';
import { checkRateLimit, clientIp } from '@/lib/security/rate-limit';

export const runtime = 'nodejs';

// Council fans out N model calls, so it gets a STRICTER per-IP limit than chat.
const RATE_LIMIT = 8;
const RATE_WINDOW_MS = 60_000;

/**
 * POST /api/council
 * body: { prompt: string, sessionId: string, history?: ChatMessage[] }
 * -> CouncilResult (answers side by side + session accounting, or blocked + message)
 */
export async function POST(req: Request) {
  const rl = checkRateLimit(`council:${clientIp(req)}`, RATE_LIMIT, RATE_WINDOW_MS);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'rate limit exceeded — slow down' },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSec) } },
    );
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid JSON body' }, { status: 400 });
  }

  const prompt = typeof body?.prompt === 'string' ? body.prompt.trim() : '';
  const sessionId = typeof body?.sessionId === 'string' ? body.sessionId : '';
  if (!prompt) return NextResponse.json({ error: 'prompt is required' }, { status: 400 });
  if (!sessionId) return NextResponse.json({ error: 'sessionId is required' }, { status: 400 });
  if (prompt.length > MAX_PROMPT_CHARS) {
    return NextResponse.json({ error: `prompt too long (max ${MAX_PROMPT_CHARS} chars)` }, { status: 413 });
  }

  const validated = validateHistory(body?.history);
  if (isValidationError(validated)) {
    return NextResponse.json({ error: validated.error }, { status: validated.status });
  }

  try {
    const result = await council({ prompt, sessionId, history: validated.history });
    return NextResponse.json(result);
  } catch (err) {
    console.error('[council] failed:', err);
    return NextResponse.json({ error: 'the council call failed — please retry' }, { status: 502 });
  }
}
