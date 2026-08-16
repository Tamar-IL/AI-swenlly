# Build Progress — the Conductor

Append a 3-line note after each chunk (newest at top). Every chunk is committed + pushed.

---

## Chunk 10 — Proof gates on chunks 8-9 + fixes (2026-08-16)
- Ran a focused gate pass (AI red team + code review) on the new markdown renderer + council synthesis. XSS guardrail held; they found real bugs, all now fixed with regression tests: markdown parser O(n^2) blowup (length-bounded the regexes), balanced-paren URLs truncated, protocol-relative `//evil.com` href bypass, and nested code-fence corruption (variable-length fences).
- Council resilience: members now charged via allSettled (a flaky model no longer kills the council), synthesis is gated on its ACTUAL fusion cost and wrapped so a failure returns the paid-for answers without charge — closes the "cap is a hard ceiling" breach the red team found.
- Verified: 64 tests pass (was 57); eval still 🟢 GO; build clean. 5 lessons logged. Known-open: per-session ledger TOCTOU under concurrent councils (task #10). Next: streaming, real provider+judge run.

## Chunk 9 — Council synthesis / Mixture-of-Agents (2026-08-16)
- Upgraded council from side-by-side stub to real MoA: after the N candidates answer, the strong model acts as AGGREGATOR and fuses them into one better answer. UI leads with "★ Conductor's synthesis" (its own receipt) and shows the candidates below as "the sources". This is the founder's named v2 headline ("a synthesizer FUSES them into one better answer").
- Cost integrity kept: synthesis is charged to the session ledger and included in the up-front cap pre-flight (now N+1 calls); `synthesize:false` opts out. Offline the aggregator is the mock; with a real provider it genuinely fuses.
- Verified: 57 tests pass (added synthesis + skip + budget tests); eval still 🟢 GO; build clean; screenshot confirms synthesis-led council layout. Next (task #10): real provider+judge run, streaming.

## Chunk 8 — Markdown + code rendering in answers (2026-08-16)
- Built a dependency-free markdown renderer (lib/markdown/parse.ts pure parser + components/Markdown.tsx): fenced code blocks with a language + copy header, headings, ordered/unordered lists, and inline code/bold/italic/links. Wired into assistant messages + council columns (user messages stay plain). Closes the critic's "a coding product can't render code" gap.
- XSS-safe by construction: emits React elements, never dangerouslySetInnerHTML; link hrefs sanitized (javascript:/data: rejected) — per the trust-safety standing rule. 6 new parser tests incl. the XSS cases.
- Verified: 56 tests pass; eval still 🟢 GO; build clean; screenshot confirms lists + bold render. Next (task #10): real provider+judge run, streaming, council synthesis (MoA).

## Chunk 7 — Product README + run instructions (2026-08-16)
- Rewrote root README.md as the founder-facing product doc: quickstart (zero keys), how to prove the bet (`npm run eval`), commands table, config/env vars, a how-it-works diagram, project layout, and an honest status/roadmap. Links out to CLAUDE.md + org map for the team story.
- Includes the honesty caveats verbatim (simulated judge + illustrative prices; in-memory ledger + IP-rate-limit backstop; council has no fusion yet) so the README never over-claims.
- Verified: 50 tests pass, eval still 🟢 GO. Next (task #10): real paid-catalog + LLM-judge, KV ledger + global cap, moderation, council synthesis, streaming/markdown.

## Chunk 6 — CI gate (2026-08-16)
- Added .github/workflows/ci.yml: runs typecheck + 50 unit tests + the offline go/no-go eval (exits non-zero on NO-GO) + production build on every push/PR — all zero-key. This was the eval-engineer gate's top process finding ("no CI → a router change can silently break the bet"); now a routing/catalog/cost change that breaks the founder's bet fails CI.
- Verified locally with the exact CI commands (npm ci, typecheck, test, eval, build) — all green; eval still 🟢 GO. Eval report uploaded as a CI artifact.
- Next (task #10): real paid-catalog + LLM-judge run, durable KV ledger + global cap, moderation, README run instructions, streaming/markdown.

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
