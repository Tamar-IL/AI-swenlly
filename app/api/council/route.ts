import { NextResponse } from 'next/server';
import { council } from '@/lib/chat/orchestrate';

export const runtime = 'nodejs';

/**
 * POST /api/council
 * body: { prompt: string }
 * -> { answers: CouncilAnswer[] }  (one per catalog model, side by side; no fusion yet)
 */
export async function POST(req: Request) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid JSON body' }, { status: 400 });
  }

  const prompt = typeof body?.prompt === 'string' ? body.prompt.trim() : '';
  if (!prompt) return NextResponse.json({ error: 'prompt is required' }, { status: 400 });
  if (prompt.length > 8000) {
    return NextResponse.json({ error: 'prompt too long (max 8000 chars)' }, { status: 413 });
  }

  try {
    const answers = await council({ prompt });
    return NextResponse.json({ answers });
  } catch (err) {
    console.error('[council] failed:', err);
    return NextResponse.json({ error: 'the council call failed — please retry' }, { status: 502 });
  }
}
