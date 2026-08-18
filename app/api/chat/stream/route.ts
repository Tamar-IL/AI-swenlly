import { orchestrate } from '@/lib/chat/orchestrate';
import { validateHistory, isValidationError, MAX_PROMPT_CHARS } from '@/lib/security/validate';
import { checkRateLimit, clientIp } from '@/lib/security/rate-limit';

export const runtime = 'nodejs';

const RATE_LIMIT = 30;
const RATE_WINDOW_MS = 60_000;

/**
 * POST /api/chat/stream — same contract as /api/chat, but the answer is delivered
 * progressively as newline-delimited JSON events:
 *   {"type":"delta","text":"..."}   (repeated)
 *   {"type":"done","receipt":..,"session":..,"refused":bool}
 *   {"type":"blocked","message":..,"session":..}   (cap gate)
 *   {"type":"error","message":..}
 *
 * The full engine (moderation → cap gate → route → generate → output moderation →
 * charge) runs first via orchestrate(); this route only changes the transport to a
 * progressive reveal. True token-level streaming lands when a streaming provider is
 * wired behind the same event shape.
 */
export async function POST(req: Request) {
  const rl = checkRateLimit(`chat:${clientIp(req)}`, RATE_LIMIT, RATE_WINDOW_MS);
  if (!rl.allowed) {
    return json({ error: 'rate limit exceeded — slow down' }, 429, { 'Retry-After': String(rl.retryAfterSec) });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'invalid JSON body' }, 400);
  }

  const prompt = typeof body?.prompt === 'string' ? body.prompt.trim() : '';
  const sessionId = typeof body?.sessionId === 'string' ? body.sessionId : '';
  if (!prompt) return json({ error: 'prompt is required' }, 400);
  if (!sessionId) return json({ error: 'sessionId is required' }, 400);
  if (prompt.length > MAX_PROMPT_CHARS) return json({ error: `prompt too long (max ${MAX_PROMPT_CHARS} chars)` }, 413);

  const validated = validateHistory(body?.history);
  if (isValidationError(validated)) return json({ error: validated.error }, validated.status);

  const encoder = new TextEncoder();
  const write = (ctrl: ReadableStreamDefaultController, obj: unknown) =>
    ctrl.enqueue(encoder.encode(JSON.stringify(obj) + '\n'));

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const result = await orchestrate({
          prompt,
          sessionId,
          overrideModelId: typeof body?.overrideModelId === 'string' ? body.overrideModelId : undefined,
          history: validated.history,
          signal: req.signal, // client disconnect cancels the in-flight model call
        });

        if (result.blocked) {
          write(controller, { type: 'blocked', message: result.message, session: result.session });
          controller.close();
          return;
        }

        for (const chunk of chunkText(result.answer ?? '')) {
          write(controller, { type: 'delta', text: chunk });
        }
        write(controller, {
          type: 'done',
          receipt: result.receipt,
          session: result.session,
          refused: result.refused ?? false,
        });
        controller.close();
      } catch (err) {
        console.error('[chat/stream] failed:', err);
        write(controller, { type: 'error', message: 'the model call failed — please retry' });
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { 'Content-Type': 'application/x-ndjson; charset=utf-8', 'Cache-Control': 'no-cache' },
  });
}

/** Split into small groups of words so the client renders a progressive reveal. */
function chunkText(text: string, wordsPerChunk = 3): string[] {
  const tokens = text.match(/\S+\s*/g) ?? [];
  const chunks: string[] = [];
  for (let i = 0; i < tokens.length; i += wordsPerChunk) {
    chunks.push(tokens.slice(i, i + wordsPerChunk).join(''));
  }
  return chunks.length ? chunks : [''];
}

function json(obj: unknown, status: number, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json', ...headers } });
}
