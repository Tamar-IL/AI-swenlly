import { NextResponse } from 'next/server';
import { getCatalog } from '@/lib/providers';
import { sessionCapUsd } from '@/lib/cost/session';

export const runtime = 'nodejs';

/**
 * GET /api/models
 * -> { models: ModelInfo[], capUsd: number }
 * Powers the manual-override "Scope" control and the cost-cap meter.
 */
export async function GET() {
  return NextResponse.json({ models: getCatalog(), capUsd: sessionCapUsd() });
}
