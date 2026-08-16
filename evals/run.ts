/**
 * The go/no-go gate.
 *
 * Runs the REAL router + provider over the golden set two ways:
 *   (A) routed  — the Conductor picks the model per prompt (what ships)
 *   (B) strong  — everything forced to the strong baseline model
 * then scores quality and sums cost, and checks the founder's bet:
 *
 *   routed mean quality ≥ QUALITY_RETENTION × strong mean quality   (≈ as good)
 *   every routed case   ≥ MIN_CASE_QUALITY                          (no catastrophe)
 *   routed cost         ≤ (1 − MIN_COST_REDUCTION) × strong cost    (≥50% cheaper)
 * plus it reports ROUTING ACCURACY (did the router pick the expected tier?).
 *
 * ⚠️ HONESTY: offline this uses the deterministic Mock provider + a SIMULATED
 * score (illustrative prices, labeled difficulties). A GO here proves the
 * routing/economics pipeline is internally consistent — NOT that a cheap model
 * matches a frontier model on real answers. Real-quality validation requires
 * swapping in a real provider + a real LLM-as-judge (see docs/progress.md).
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { orchestrate } from '../lib/chat/orchestrate';
import { MockProvider } from '../lib/providers/mock';
import { MOCK_CATALOG, baselineModel } from '../lib/providers/catalog';
import { resetAllSessions } from '../lib/cost/session';
import { GOLDEN_SET } from './golden';
import { simulatedScore } from './judge';

// --- gate thresholds -------------------------------------------------------
const QUALITY_RETENTION = 0.95; // routed must keep ≥95% of strong's mean quality
const MIN_CASE_QUALITY = 0.8; // and no single routed answer may fall below this
const MIN_COST_REDUCTION = 0.5; // routed must cost ≤50% of strong (≥50% cheaper)

const provider = new MockProvider();
const catalog = MOCK_CATALOG;
const strong = baselineModel(catalog);
const CAP = 1000; // effectively uncapped during eval

interface Row {
  id: string;
  category: string;
  expectedTier: string;
  routedTier: string;
  routedCorrect: boolean;
  routedCost: number;
  routedQuality: number;
  strongCost: number;
  strongQuality: number;
}

async function evalOne(caseId: string): Promise<Row> {
  const c = GOLDEN_SET.find((g) => g.id === caseId)!;

  resetAllSessions();
  const routed = await orchestrate({ prompt: c.prompt, sessionId: `routed-${c.id}`, provider, catalog, capUsd: CAP });
  const routedModel = catalog.find((m) => m.id === routed.receipt!.modelId)!;
  const routedQuality = simulatedScore({ model: routedModel, case: c, answer: routed.answer! });

  resetAllSessions();
  const forced = await orchestrate({ prompt: c.prompt, sessionId: `strong-${c.id}`, overrideModelId: strong.id, provider, catalog, capUsd: CAP });
  const strongQuality = simulatedScore({ model: strong, case: c, answer: forced.answer! });

  return {
    id: c.id,
    category: c.category,
    expectedTier: c.expectedTier,
    routedTier: routedModel.tier,
    routedCorrect: routedModel.tier === c.expectedTier,
    routedCost: routed.receipt!.costUsd,
    routedQuality,
    strongCost: forced.receipt!.costUsd,
    strongQuality,
  };
}

async function main() {
  const rows: Row[] = [];
  for (const c of GOLDEN_SET) rows.push(await evalOne(c.id));

  const n = rows.length;
  const avg = (f: (r: Row) => number) => rows.reduce((s, r) => s + f(r), 0) / n;
  const sum = (f: (r: Row) => number) => rows.reduce((s, r) => s + f(r), 0);

  const routedQuality = avg((r) => r.routedQuality);
  const strongQuality = avg((r) => r.strongQuality);
  const qualityRetention = strongQuality > 0 ? routedQuality / strongQuality : 1;
  const worstCase = Math.min(...rows.map((r) => r.routedQuality));

  const routedCost = sum((r) => r.routedCost);
  const strongCost = sum((r) => r.strongCost);
  const costReduction = strongCost > 0 ? 1 - routedCost / strongCost : 0;

  const routingAccuracy = rows.filter((r) => r.routedCorrect).length / n;
  const misroutes = rows.filter((r) => !r.routedCorrect);

  const qualityPass = qualityRetention >= QUALITY_RETENTION;
  const floorPass = worstCase >= MIN_CASE_QUALITY;
  const costPass = costReduction >= MIN_COST_REDUCTION;
  const go = qualityPass && floorPass && costPass;

  print(rows, { routedQuality, strongQuality, qualityRetention, worstCase, routedCost, strongCost, costReduction, routingAccuracy, qualityPass, floorPass, costPass, go }, misroutes);

  const report = {
    timestamp: new Date().toISOString(),
    note: 'Simulated judge + illustrative prices — proves routing/economics consistency, NOT real answer quality.',
    thresholds: { QUALITY_RETENTION, MIN_CASE_QUALITY, MIN_COST_REDUCTION },
    summary: {
      cases: n,
      routedQuality,
      strongQuality,
      qualityRetention,
      worstCaseQuality: worstCase,
      routedCostUsd: routedCost,
      strongCostUsd: strongCost,
      costReduction,
      routingAccuracy,
      misroutes: misroutes.map((m) => ({ id: m.id, expected: m.expectedTier, got: m.routedTier })),
      qualityPass,
      floorPass,
      costPass,
      verdict: go ? 'GO' : 'NO-GO',
    },
    rows,
  };
  const dir = join(process.cwd(), 'evals', 'reports');
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'latest.json'), JSON.stringify(report, null, 2));

  process.exit(go ? 0 : 1);
}

function pct(x: number): string {
  return `${(x * 100).toFixed(1)}%`;
}
function usd(x: number): string {
  return `$${x.toFixed(6)}`;
}

function print(rows: Row[], s: Record<string, number | boolean>, misroutes: Row[]) {
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('  THE CONDUCTOR — offline eval (go/no-go gate)');
  console.log('  simulated judge · illustrative prices · routing/economics check');
  console.log('═══════════════════════════════════════════════════════════\n');
  console.log('  case          cat         exp→got      ok   rQ    sQ');
  console.log('  ─────────────────────────────────────────────────────────');
  for (const r of rows) {
    console.log(
      `  ${r.id.padEnd(12)} ${r.category.padEnd(11)} ${(r.expectedTier + '→' + r.routedTier).padEnd(12)} ` +
        `${r.routedCorrect ? '✓ ' : '✗ '}  ${r.routedQuality.toFixed(2)}  ${r.strongQuality.toFixed(2)}`,
    );
  }
  console.log('\n  ─── results ───────────────────────────────────────────');
  console.log(`  routing accuracy   : ${pct(s.routingAccuracy as number)}${misroutes.length ? '  misroutes: ' + misroutes.map((m) => m.id).join(', ') : ''}`);
  console.log(`  routed avg quality : ${(s.routedQuality as number).toFixed(3)}   worst case: ${(s.worstCase as number).toFixed(3)}`);
  console.log(`  strong avg quality : ${(s.strongQuality as number).toFixed(3)}`);
  console.log(`  quality retention  : ${pct(s.qualityRetention as number)}  (gate ≥ 95.0%)  ${s.qualityPass ? '✅' : '❌'}`);
  console.log(`  worst-case floor   : ${(s.worstCase as number).toFixed(3)}  (gate ≥ ${MIN_CASE_QUALITY})   ${s.floorPass ? '✅' : '❌'}`);
  console.log(`  routed total cost  : ${usd(s.routedCost as number)}`);
  console.log(`  strong total cost  : ${usd(s.strongCost as number)}`);
  console.log(`  cost reduction     : ${pct(s.costReduction as number)}  (gate ≥ 50.0%)  ${s.costPass ? '✅' : '❌'}`);
  console.log('\n  ═════════════════════════════════════════════════════');
  console.log(`   VERDICT: ${s.go ? '🟢 GO — routing/economics consistent (real-quality validation pending)' : '🔴 NO-GO'}`);
  console.log('  ═════════════════════════════════════════════════════\n');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
