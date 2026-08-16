import { NextResponse } from 'next/server';
import { orchestrate } from '@/lib/chat/orchestrate';

export const runtime = 'nodejs';

/**
 * POST /api/chat
 * body: { prompt: string, sessionId: string, overrideModelId?: string, history?: ChatMessage[] }
 * -> OrchestrateResult (answer + receipt + session accounting, or blocked + message)
 */
export async function POST(req: Request) {
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
  if (prompt.length > 8000) {
    return NextResponse.json({ error: 'prompt too long (max 8000 chars)' }, { status: 413 });
  }

  try {
    const result = await orchestrate({
      prompt,
      sessionId,
      overrideModelId:
        typeof body?.overrideModelId === 'string' ? body.overrideModelId : undefined,
      history: Array.isArray(body?.history) ? body.history : undefined,
    });
    return NextResponse.json(result);
  } catch (err) {
    console.error('[chat] orchestrate failed:', err);
    return NextResponse.json({ error: 'the model call failed — please retry' }, { status: 502 });
  }
}
