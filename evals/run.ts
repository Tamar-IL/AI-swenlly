/**
 * The go/no-go gate.
 *
 * Runs the REAL router + provider over the golden set two ways:
 *   (A) routed  — the Conductor picks the model per prompt (what ships)
 *   (B) strong  — everything forced to the strong baseline model
 * then judges quality and sums cost, and asserts the founder's bet:
 *
 *   routed quality  ≥  QUALITY_RETENTION × strong quality      (≈ as good)
 *   routed cost     ≤  (1 − MIN_COST_REDUCTION) × strong cost  (≥50% cheaper)
 *
 * Deterministic and offline (Mock provider + simulated judge). Exits non-zero on
 * NO-GO so CI can gate on it. Writes a JSON report to evals/reports/.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { orchestrate } from '../lib/chat/orchestrate';
import { MockProvider } from '../lib/providers/mock';
import { MOCK_CATALOG, baselineModel } from '../lib/providers/catalog';
import { resetAllSessions } from '../lib/cost/session';
import { GOLDEN_SET } from './golden';
import { simulatedJudge, type Judge } from './judge';

// --- gate thresholds -------------------------------------------------------
const QUALITY_RETENTION = 0.95; // routed must keep ≥95% of strong's quality
const MIN_COST_REDUCTION = 0.5; // routed must cost ≤50% of strong (≥50% cheaper)

const provider = new MockProvider();
const catalog = MOCK_CATALOG;
const strong = baselineModel(catalog);
const judge: Judge = simulatedJudge;
const CAP = 1000; // effectively uncapped during eval

interface Row {
  id: string;
  category: string;
  routedModel: string;
  routedTier: string;
  routedCost: number;
  routedQuality: number;
  strongCost: number;
  strongQuality: number;
}

async function evalOne(caseId: string): Promise<Row> {
  const c = GOLDEN_SET.find((g) => g.id === caseId)!;

  // (A) routed — real router path via orchestrate.
  resetAllSessions();
  const routed = await orchestrate({
    prompt: c.prompt,
    sessionId: `routed-${c.id}`,
    provider,
    catalog,
    capUsd: CAP,
  });
  const routedModel = catalog.find((m) => m.id === routed.receipt!.modelId)!;
  const routedQuality = judge({ model: routedModel, case: c, answer: routed.answer! });

  // (B) strong — force the baseline model.
  resetAllSessions();
  const forced = await orchestrate({
    prompt: c.prompt,
    sessionId: `strong-${c.id}`,
    overrideModelId: strong.id,
    provider,
    catalog,
    capUsd: CAP,
  });
  const strongQuality = judge({ model: strong, case: c, answer: forced.answer! });

  return {
    id: c.id,
    category: c.category,
    routedModel: routedModel.label,
    routedTier: routedModel.tier,
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

  const routedCost = sum((r) => r.routedCost);
  const strongCost = sum((r) => r.strongCost);
  const costReduction = strongCost > 0 ? 1 - routedCost / strongCost : 0;

  const qualityPass = qualityRetention >= QUALITY_RETENTION;
  const costPass = costReduction >= MIN_COST_REDUCTION;
  const go = qualityPass && costPass;

  // --- report ----------------------------------------------------------
  print(rows, {
    routedQuality,
    strongQuality,
    qualityRetention,
    routedCost,
    strongCost,
    costReduction,
    qualityPass,
    costPass,
    go,
  });

  const report = {
    timestamp: new Date().toISOString(),
    thresholds: { QUALITY_RETENTION, MIN_COST_REDUCTION },
    summary: {
      cases: n,
      routedQuality,
      strongQuality,
      qualityRetention,
      routedCostUsd: routedCost,
      strongCostUsd: strongCost,
      costReduction,
      qualityPass,
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

function pct(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}
function usd(n: number): string {
  return `$${n.toFixed(6)}`;
}

function print(rows: Row[], s: Record<string, number | boolean>) {
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('  THE CONDUCTOR — offline eval (go/no-go gate)');
  console.log('═══════════════════════════════════════════════════════════\n');
  console.log('  case         cat         routed → tier        rQ    sQ');
  console.log('  ─────────────────────────────────────────────────────────');
  for (const r of rows) {
    console.log(
      `  ${r.id.padEnd(11)} ${r.category.padEnd(11)} ${r.routedTier.padEnd(7)} ` +
        `${r.routedQuality.toFixed(2)}  ${r.strongQuality.toFixed(2)}`,
    );
  }
  console.log('\n  ─── results ───────────────────────────────────────────');
  console.log(`  routed avg quality : ${(s.routedQuality as number).toFixed(3)}`);
  console.log(`  strong avg quality : ${(s.strongQuality as number).toFixed(3)}`);
  console.log(`  quality retention  : ${pct(s.qualityRetention as number)}  (gate ≥ 95.0%)  ${s.qualityPass ? '✅' : '❌'}`);
  console.log(`  routed total cost  : ${usd(s.routedCost as number)}`);
  console.log(`  strong total cost  : ${usd(s.strongCost as number)}`);
  console.log(`  cost reduction     : ${pct(s.costReduction as number)}  (gate ≥ 50.0%)  ${s.costPass ? '✅' : '❌'}`);
  console.log('\n  ═════════════════════════════════════════════════════');
  console.log(`   VERDICT: ${s.go ? '🟢 GO — routed ≈ strong quality at far lower cost' : '🔴 NO-GO'}`);
  console.log('  ═════════════════════════════════════════════════════\n');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
