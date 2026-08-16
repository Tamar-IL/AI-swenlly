# Build Progress — the Conductor

Append a 3-line note after each chunk (newest at top). Every chunk is committed + pushed.

---

## Chunk 5 — Eval honesty + router hardening (2026-08-16)
- Reframed the go/no-go gate honestly: the judge now READS the answer (drops to 0 on empty/degenerate — guard test proves it), the harness reports ROUTING ACCURACY separately (100%, incl. 4 adversarial cases the old router misrouted), added a worst-case quality floor, and the banner/report now say "simulated judge · illustrative prices · real-quality validation pending" instead of claiming proven quality. Judge interface is now async + blind + reference-ready for a real LLM-judge drop-in.
- Hardened the rules-based router: weak tech keywords (git/api/sql) need corroboration to escalate; complexity terms (complexity/equilibrium/theorem) escalate hidden-hard questions; added adversarial regression fixtures. Receipt savings labeled "vs. always using the strong model".
- Verified: 50 tests pass; eval 🟢 GO (99.8% retention, 52.9% cheaper, 100% routing accuracy); build clean. Remaining gate findings tracked as post-MVP follow-ups (task #10).

## Chunk 4 — Proof gates + money-guard hardening (2026-08-16)
- Ran all 6 proof gates (code review, trust-safety, AI red team, critic, eval, QA) on the AI parts. They converged: engine+UI good, but the money-guard was bypassable and the eval over-claimed quality.
- Fixed the money-guard: override respects the cap, council is metered+gated, history validated (no forged system turns / hidden workload), NaN can't poison the ledger, cap is a true ceiling, IP rate-limit backstop. 7 confirmed attacks → regression tests + lessons.
- Next: eval/receipt honesty + router hardening (chunk 5).

## Chunk 3 — World-class chat UI (2026-08-16)
- Built the full UI against the design-system tokens: chat shell (sidebar + header + composer), user/assistant messages, the signature Receipt (collapsed line + expanded ledger with savings bar), the Scope manual-override control, Council 3-up view, cost-cap meter + gate card, light/dark themes. API routes: /api/chat, /api/council, /api/models.
- Verified end-to-end: `next build` clean, 24 tests pass, eval still GO. Smoke-tested the live server (simple→free/100% saved, coding→strong, override honored, council→3 tiers) and captured light+dark screenshots — both hit the world-class bar.
- Next: run the proof gates (QA, code-review, critic, eval, trust-safety, AI red team) on the AI parts; record any failures as regression lessons.

## Chunk 2 — Engine + go/no-go eval (2026-08-16)
- Built provider layer (offline Mock + optional free OpenRouter), rules-based router, cost/receipt engine, per-session hard cost caps + cost-gating, and the orchestrate seam. 24 unit tests pass; typecheck clean.
- Built the offline eval harness (the go/no-go gate). **Result: 🟢 GO — 99.7% quality retention at 54.5% lower cost** (gates: ≥95% quality, ≥50% cost cut). Runs with zero keys.
- Next: build the world-class chat UI (chat + receipt + manual override + council stub) against the delivered design system, then run the proof gates.

## Chunk 1 — Team install (2026-08-16)
- Unzipped the Company team at repo root: CLAUDE.md, 22 specialist agents, docs/ (org map + lessons). Verified GitHub write access round-trips.
- Design gate produced docs/architecture.md (ADR) and docs/design-system.md (full token spec) in parallel.
- Next: build the MVP engine + eval, then the UI.
