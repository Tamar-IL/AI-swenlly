import { NextResponse } from 'next/server';
import { orchestrate } from '@/lib/chat/orchestrate';
import { validateHistory, isValidationError, MAX_PROMPT_CHARS } from '@/lib/security/validate';
import { checkRateLimit, clientIp } from '@/lib/security/rate-limit';

export const runtime = 'nodejs';

// IP-keyed backstop: holds even when the client rotates sessionId to reset the cap.
const RATE_LIMIT = 30; // requests
const RATE_WINDOW_MS = 60_000; // per minute

/**
 * POST /api/chat
 * body: { prompt: string, sessionId: string, overrideModelId?: string, history?: ChatMessage[] }
 * -> OrchestrateResult (answer + receipt + session accounting, or blocked + message)
 */
export async function POST(req: Request) {
  const rl = checkRateLimit(`chat:${clientIp(req)}`, RATE_LIMIT, RATE_WINDOW_MS);
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
    const result = await orchestrate({
      prompt,
      sessionId,
      overrideModelId: typeof body?.overrideModelId === 'string' ? body.overrideModelId : undefined,
      history: validated.history,
    });
    return NextResponse.json(result);
  } catch (err) {
    console.error('[chat] orchestrate failed:', err);
    return NextResponse.json({ error: 'the model call failed — please retry' }, { status: 502 });
  }
}
