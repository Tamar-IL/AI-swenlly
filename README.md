# The Conductor — one answer, many minds

A ChatGPT/Claude-style chat platform whose engine is **many AIs, not one**. The Conductor
routes each question to the *cheapest* AI that answers it well, and shows a **cost + quality
"receipt"** on every answer — which model replied, and how much it saved you versus always
using the strongest model. Hard questions can convene a **council** (several models side by
side). Every free-tier request is protected by a **hard per-session cost cap**.

It runs with **zero paid API keys** out of the box: the default provider is a deterministic
offline mock, so the whole app, its tests, and its go/no-go eval run for free, anywhere.

> Built end-to-end by an AI-native engineering team of specialist sub-agents. The team's
> operating system and the ~22 agents live in [`CLAUDE.md`](CLAUDE.md) and
> [`docs/engineering-org-map.md`](docs/engineering-org-map.md); the decision log is in
> [`docs/lessons.md`](docs/lessons.md) and the build log in [`docs/progress.md`](docs/progress.md).

---

## Quickstart

Requires **Node 22+**. No API keys needed.

```bash
npm install          # or: npm ci
npm run dev          # http://localhost:3000
```

Open the app, ask anything, and watch the receipt on each answer. Try a simple lookup
("What is the capital of France?" → routes to the free model) and a coding/reasoning task
("Write a Python function to reverse a linked list" → routes to the strong model).

---

## Prove the bet (the go/no-go gate)

The core thesis — *routed answers stay ≈ as good as the best single model at ≥50% lower cost* —
is checked by an offline eval that runs the **real** router over a labeled golden set:

```bash
npm run eval
```

It prints a per-case table and a verdict, and **exits non-zero on NO-GO** (so CI gates on it).

> **Honesty note.** Offline, the eval uses a deterministic mock provider, a *simulated* judge,
> and *illustrative* prices. A **GO proves the routing + economics pipeline is internally
> consistent and that the router picks the right tier** (it reports routing accuracy separately) —
> it does **not** prove a cheap model matches a frontier model on real answers. Real-quality
> validation requires wiring a real provider + a real LLM-as-judge (see Roadmap).

---

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Run the app in dev mode on :3000 |
| `npm run build` / `npm start` | Production build / serve |
| `npm test` | Unit tests (router, cost, caps, orchestrator, security) |
| `npm run eval` | The offline go/no-go eval gate |
| `npm run typecheck` | `tsc --noEmit` |

CI (`.github/workflows/ci.yml`) runs typecheck + tests + the eval + build on every push.

---

## Configuration (all optional)

Copy `.env.example` to `.env.local`. Everything has a safe default — the app works with none of it.

| Variable | Default | Meaning |
|---|---|---|
| `CONDUCTOR_PROVIDER` | `mock` | `mock` (offline, no key) or `openrouter` (real **free** models) |
| `OPENROUTER_API_KEY` | — | A *free* OpenRouter key; only used when `CONDUCTOR_PROVIDER=openrouter`. Missing key falls back to mock. |
| `CONDUCTOR_SESSION_CAP_USD` | `0.05` | Hard per-session spend cap. `0` = free models only. |

---

## How it works

```
Browser (chat UI)
   │  POST /api/chat { prompt, sessionId, overrideModelId?, history? }
   ▼
Router (rules-based)  ──►  Provider layer  ──►  model
   │  classify prompt → tier          (Mock by default; OpenRouter-free if keyed)
   │  honor manual override (budget-checked)
   │  cost-aware clamp vs remaining session budget
   ▼
Cost engine → Receipt (model, reason, tokens, cost, saved vs strong baseline)
   │  charge session ledger · enforce hard cap · IP rate-limit backstop
   ▼
Answer + receipt back to the UI
```

- **Router** ([`lib/router`](lib/router)) — transparent rules (not ML): classify the prompt into
  a tier (free / balanced / strong), honor a manual override, and downgrade to fit the remaining
  budget. Weak tech keywords need corroboration to escalate; complexity terms escalate hidden-hard
  questions.
- **Providers** ([`lib/providers`](lib/providers)) — one `ModelProvider` interface. `MockProvider`
  is the keyless default; `OpenRouterProvider` adds real free models behind the same interface.
- **Cost + caps** ([`lib/cost`](lib/cost)) — token estimation, per-call cost, the receipt, and a
  per-session ledger with a hard cap. Provider token counts are sanitized (a bad value can't
  uncap spend), and budgeting uses the provider's *max* output so a turn can't overshoot.
- **Guardrails** ([`lib/security`](lib/security)) — history validation (no forged `system` turns,
  bounded size) and an IP-keyed rate limiter as the real backstop when a client rotates its
  session id.
- **Council** ([`lib/chat/orchestrate.ts`](lib/chat/orchestrate.ts)) — v1 asks one model per tier
  and shows them side by side (metered against the cap). Fusion/synthesis is the v2 headline.

## Project layout

```
app/            Next.js App Router — UI (page.tsx) + API routes (api/chat, api/council, api/models)
components/     React UI: chat shell, message, the Receipt, scope override, council, cost meter
lib/            Engine: providers/ · router/ · cost/ · chat/ (orchestrate seam) · security/
evals/          The go/no-go eval: golden set, judge, runner
docs/           architecture.md · design-system.md · progress.md · lessons.md · engineering-org-map.md
.claude/agents/ The 22 specialist sub-agents that built this
```

---

## Status & roadmap

**MVP thin-slice — done & proven:** clean chat UI (light/dark), rules-based router across 3 tiers,
cost+quality receipt, manual override, council side-by-side stub, hard per-session cost caps, and
the offline go/no-go eval (currently GO). 50 unit tests, CI enforced. Runs with zero paid keys.

**Known limitations (honest):** the session ledger is in-memory (single-instance MVP; the IP
rate-limit is the abuse backstop); the eval uses a simulated judge + illustrative prices; council
has no fusion yet.

**Next (post-MVP, tracked in `docs/progress.md`):** a real paid-catalog + LLM-judge run to prove
quality for real · durable KV ledger + global/daily cap · input/output moderation · council
synthesis (Mixture-of-Agents) · streaming + markdown/code rendering.
