# Architecture Decision Record — "the Conductor" (MoA Orchestrator)

**Status:** Accepted · **Author:** software-architect · **Date:** 2026-08-16
**Gate:** Architecture Review — self-gated; Advisor decisions locked (see below).

A ChatGPT/Claude-style chat product whose *engine is many AIs, not one*. A rules-based
router picks the cheapest model that will still answer well, shows a cost+quality "receipt"
on every answer, and enforces hard per-session spend caps. The whole thing — app, tests,
eval harness — runs with **zero API keys and zero network** via a deterministic
`MockProvider`; real free providers slot in behind the same interface only if an optional
free key is present.

### Locked decisions (do not relitigate)
Orchestrate existing models (never train our own) · free/open models first, escalate to paid
only when needed · product runs with **no paid keys** · audience = everyone/every task ·
free tier + paid subscriptions · stack = Next.js 14 App Router + TypeScript + Tailwind, single
Vercel-free-tier deployable.

---

## 1. System context

The browser talks to one Next.js app. A chat **Route Handler** receives a prompt (+ optional
manual override + the session's running cost), asks the **Router** which model to use, and calls
that model through the **Provider layer** — a single `ModelProvider` interface with pluggable
implementations (`MockProvider` by default; OpenRouter-free / HuggingFace when a free key
exists). The **Cost Tracker** estimates tokens and money before and after the call, enforces the
per-session hard cap, and emits a **Receipt** (which AI answered, cost, and $ saved vs. the
strong baseline) that rides back with the answer. The **Eval harness** is a standalone Node
script that runs the *same* Router + Provider code over a fixture set to prove routed quality ≈
best-single-model at ≥50% lower cost — the go/no-go gate. Everything is deterministic offline.

```
                              ┌─────────────────────────────────────────────┐
   Browser (Chat UI)          │              Next.js 14 app (single deploy)  │
   ┌───────────────┐          │                                             │
   │ Composer      │  POST    │   app/api/chat  (Route Handler)             │
   │ Answer + ▸────────────────► ┌──────────┐   ┌──────────┐   ┌─────────┐ │
   │ Receipt card  │  /api/chat │ │ Router   │──►│ Cost     │──►│Provider │ │
   │ Override menu │◄────────────┤ (rules)  │   │ Tracker  │   │ layer   │ │
   └───────────────┘   answer   │ └──────────┘   │ + caps   │   │(interface)│
                       +receipt │      ▲         │ +receipt │   └────┬────┘ │
                                │      │         └──────────┘        │      │
                                │  model catalog (registry)         │      │
                                └───────────────────────────────────┼──────┘
                                                                     │
                                     ┌───────────────────────────────┼───────────────┐
                                     ▼                ▼                              ▼
                               MockProvider    OpenRouter-free              HuggingFace
                              (deterministic,   (free key, optional)      (free key, optional)
                               zero network)

   evals/  ── imports the SAME lib/router + lib/providers ──►  runs fixtures, prints go/no-go
```

---

## 2. Module boundaries & file layout (Next.js App Router)

Rule of thumb: **`app/` is transport + pixels only. All engine logic lives in `lib/` so the
eval harness and unit tests import it directly with no HTTP and no React.**

```
app/
  layout.tsx                     Root layout, Tailwind globals
  page.tsx                       Chat page (server component shell)
  chat/
    ChatUI.tsx                   Client component: composer, message list, override menu
    ReceiptCard.tsx              Renders the receipt on each answer
    SideBySide.tsx               v1 "show 3 answers" mode (no fusion)
  api/
    chat/route.ts                POST handler: parse → router → cost gate → provider → receipt
    models/route.ts              GET catalog (ids/tiers) for the override menu

lib/
  providers/
    types.ts                     ModelProvider interface + shared types
    mock.ts                      MockProvider — deterministic, offline, default
    openrouter.ts                OpenRouterProvider — activated iff OPENROUTER_API_KEY set
    huggingface.ts               HuggingFaceProvider — activated iff HF_API_KEY set
    registry.ts                  Builds active provider set from env; resolves modelId→provider
  catalog.ts                     MODEL_CATALOG: id, tier, provider, $/1k in+out (source of truth)
  router/
    index.ts                     route(input): RouterInput → RouterDecision
    rules.ts                     Ordered classifier rules (pure functions, unit-tested)
  cost/
    estimate.ts                  tokenEstimate(text), costOf(model, usage)
    session.ts                   SessionCostState + cap gating (applyCap, wouldExceed)
    receipt.ts                   buildReceipt(...) → Receipt object
  chat/
    orchestrate.ts               Thin composition used by route.ts AND evals (the seam)
  types.ts                       Cross-cutting shared types (Message, Tier, Usage)

evals/
  harness.ts                     CLI: run fixtures through lib/chat/orchestrate, print report
  fixtures/*.json               Prompt set + expected-quality anchors per prompt
  baseline.ts                    "Best single strong model" reference run for the cost delta
  report.ts                      Aggregates quality parity + cost-savings → GO / NO-GO
```

**The seam:** `lib/chat/orchestrate.ts` is the one function both the API route and the eval
harness call. Neither the router, cost tracker, nor providers know about HTTP or React. This is
what makes "runs with zero keys and zero network" structurally true rather than aspirational.

---

## 3. `ModelProvider` interface + catalog

Every model source — mock, OpenRouter, HuggingFace, and any future paid provider — implements
one interface. The registry decides which are *active* purely from env vars; missing keys simply
mean that provider isn't registered (never a crash).

```ts
// lib/providers/types.ts
export type Tier = 'free' | 'mid' | 'strong';

export interface Usage {
  inputTokens: number;
  outputTokens: number;
}

export interface CompletionRequest {
  modelId: string;
  messages: { role: 'system' | 'user' | 'assistant'; content: string }[];
  signal?: AbortSignal;      // caller can cancel / time out
}

export interface CompletionResult {
  text: string;
  usage: Usage;              // real if provider reports it; else estimated upstream
  modelId: string;
  providerId: string;
}

export interface ModelProvider {
  readonly id: string;                     // 'mock' | 'openrouter' | 'huggingface'
  supports(modelId: string): boolean;      // does this provider serve that catalog id?
  complete(req: CompletionRequest): Promise<CompletionResult>;
}
```

```ts
// lib/catalog.ts — single source of truth; prices are $ per 1k tokens
export interface ModelSpec {
  id: string;               // stable id used everywhere (router, override, receipt)
  tier: Tier;
  providerId: string;       // which ModelProvider serves it
  inPer1k: number;          // $/1k input tokens  (0 for free models)
  outPer1k: number;         // $/1k output tokens (0 for free models)
  label: string;            // human name for the UI
}

// MVP catalog: exactly the 3 tiers the router needs. The mock mirrors these
// ids at $0 so offline runs still exercise tier logic; real free/paid entries
// swap in when keys exist. Router never hardcodes ids — it selects by tier.
export const MODEL_CATALOG: ModelSpec[]; // [free, mid, strong] minimum
```

**Registry** (`registry.ts`) reads env at boot, constructs only the providers whose keys are
present (MockProvider is always present), and exposes `resolve(modelId) → ModelProvider`. The
catalog is filtered to models whose provider is active, so the override menu and router only ever
offer models that can actually answer.

---

## 4. Router contract

Rules-based (no ML). A short, ordered list of pure predicate→tier rules; first match wins;
default tier is `mid`. Deterministic and unit-testable.

```ts
// lib/router/index.ts
export interface RouterInput {
  prompt: string;
  history?: Message[];
  override?: string | null;        // explicit modelId — bypasses classification
  session: SessionCostState;       // spent-so-far + cap, for cost-aware downgrade
}

export interface RouterDecision {
  modelId: string;                 // concrete id resolved from tier via active catalog
  tier: Tier;
  reason: string;                  // human string for the receipt, e.g. "code fence detected → strong"
  overridden: boolean;
}

export function route(input: RouterInput): RouterDecision;
```

**Classification rules (ordered, first match wins):**
1. **Manual override present & valid** → that model, `reason: "manual override"`, `overridden: true`.
2. **Cost-aware clamp** — if choosing `strong` would exceed the session cap, downgrade to the
   highest tier that still fits; `reason: "near cap → downgraded to <tier>"`. (Runs *around*
   rules 3–6: they propose a tier, this clamps it.)
3. **Coding signals** (code fences, `def/function/class`, stack traces, "write/fix/refactor …
   code", file extensions) → `strong`.
4. **Long / complex** (prompt length above threshold, or reasoning markers: "step by step",
   "prove", "analyze", multi-part questions) → `strong`.
5. **Website/persona builders** (keywords: "landing page", "build a site", "act as", "persona")
   → `mid` (structured but not frontier-hard).
6. **Short/simple/greeting/factual** (below length threshold, single sentence) → `free`.
7. **Default** → `mid`.

Thresholds and keyword lists live in `rules.ts` as named constants so they can be tuned against
the eval harness without touching control flow. The router returns a *tier*, then resolves the
concrete `modelId` from the active catalog (so a missing free provider transparently resolves to
the cheapest available tier).

---

## 5. Cost, receipt & caps

**Token estimation** (`cost/estimate.ts`): when a provider reports real `usage`, use it; the
MockProvider and any provider that doesn't report usage fall back to a heuristic
`ceil(chars / 4)` estimate for input and output. `costOf(model, usage) =
usage.inputTokens/1000*inPer1k + usage.outputTokens/1000*outPer1k`.

**Per-session cost state** (`cost/session.ts`): held server-side keyed by session id (in-memory
map for MVP; interface allows swapping to KV later). Shape:

```ts
export interface SessionCostState {
  sessionId: string;
  spentUsd: number;          // cumulative actual cost this session
  capUsd: number;            // hard cap (config default, e.g. free tier = $0.05)
  turns: number;
}
```

**Hard-cap gating behavior (day one):**
- *Before* the call, estimate the worst-case cost of the chosen model. If `spent + estimate >
  cap`: first attempt the router's cost-aware downgrade (rule 2). If even the `free` tier can't
  fit, **refuse the turn** with a structured `capReached` response (HTTP 200 + `{ blocked: true,
  reason }`) — the UI shows "session budget reached", never a raw error, and offers reset/upgrade.
- *After* the call, add *actual* cost to `spentUsd`. Because free-tier models cost $0, offline and
  free-key operation can never trip the cap — the gate exists to protect paid escalation.

**The Receipt** (`cost/receipt.ts`) — attached to every answer:

```ts
export interface Receipt {
  modelId: string;
  modelLabel: string;
  tier: Tier;
  reason: string;              // why the router chose it (from RouterDecision)
  overridden: boolean;
  usage: Usage;
  costUsd: number;             // what this answer actually cost
  baselineUsd: number;        // cost had we used the strong model for this same prompt
  savedUsd: number;           // baselineUsd - costUsd (>= 0)
  savedPct: number;           // savedUsd / baselineUsd, 0 when baseline is $0
  session: { spentUsd: number; capUsd: number; remainingUsd: number };
}
```

`baselineUsd` is computed by pricing the *same estimated usage* against the `strong` catalog
entry — no second model call needed, so the receipt is free to produce. This same
per-answer object is what the eval harness aggregates for the ≥50%-savings gate.

---

## 6. Key tradeoffs & what's deferred

| Decision | Rationale (one line) |
|---|---|
| Logic in `lib/`, `app/` is transport-only | The single seam that makes zero-key/zero-network testing and the eval harness structurally real. |
| Rules-based router (no ML) | Deterministic, debuggable, testable, free to run — an ML router is itself a cost/latency/eval liability we don't need for v1. |
| Router returns a *tier*, resolves id late | Decouples routing logic from which providers happen to have keys; missing free model degrades gracefully. |
| `MockProvider` is the default, not a test double bolted on | "Runs with zero keys" is the product's core promise; the mock is a first-class provider, not scaffolding. |
| Baseline cost computed by re-pricing, not a second call | The receipt (and the eval gate) is free — no doubled spend/latency to prove savings. |
| In-memory session cost store | Vercel-free-tier friendly for MVP; the `SessionCostState` interface lets us swap to KV without touching callers. |
| Side-by-side = 3 independent provider calls, no fusion | Ships the "many AIs" feel now; fusion is the hard/expensive part and is genuinely v2. |
| Hard cap returns HTTP 200 `{blocked}` not 4xx | A budget stop is a product state, not an error; keeps the UI clean and analytics honest. |

**Deferred to v2 (explicit):** council/synthesis *fusion* of multiple answers; ML/embedding-based
routing; streaming token-by-token responses; persistent (KV/DB) session cost + user accounts;
paid-tier billing integration; caching/dedup of identical prompts; multi-turn context-window cost
management.

---

## 7. Top 5 risks & mitigations

1. **Free providers are unreliable/rate-limited/deprecated.** → The `ModelProvider` interface +
   registry make providers hot-swappable; `MockProvider` guarantees the app always functions;
   registry degrades to the next active tier when a provider is absent or errors, and the router
   selects by tier (not hardcoded id) so a dead free model never breaks routing.
2. **The eval gate fails — routed quality isn't within tolerance at ≥50% savings.** → The harness
   is built *first* and runs on every rules change; thresholds/keywords in `rules.ts` are tunable
   constants; if the gate can't be met, that is the designed go/no-go signal to the founder, not a
   silent ship.
3. **Runaway cost via a free tier in front of paid models.** → Hard per-session cap enforced
   *before* every paid call, cost-aware downgrade, and refusal when even free won't fit; free/mock
   models are $0 so the exposure only ever exists on deliberate paid escalation.
4. **Token/cost estimates diverge from real provider billing.** → Prefer provider-reported
   `usage` when available; treat the `chars/4` heuristic as conservative (round up) so we
   over- rather than under-charge the cap; catalog prices are centralized in one file for fast
   correction.
5. **Router misclassifies (sends hard prompts to the free model).** → First-match ordered rules
   put coding/complexity checks *before* the cheap default; manual override is always available as
   the human escape hatch and is surfaced in the receipt; every misroute caught in eval becomes a
   fixture regression case (per the org's lessons loop).

---

*Build order for engineers (parallelizable): (A) `lib/providers/*` + `catalog.ts` + `MockProvider`
→ unblocks everything. (B) `lib/router/*` and `lib/cost/*` in parallel against the mock. (C)
`lib/chat/orchestrate.ts` seam. (D) `app/api/*` + `app/chat/*` UI, and `evals/*` — both consume
the seam and can proceed in parallel once (C) lands.*
