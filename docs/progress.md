# Build Progress — the Conductor

Append a 3-line note after each chunk (newest at top). Every chunk is committed + pushed.

---

## Chunk 17 — Stream cancellation (AbortSignal end-to-end) (2026-08-16)
- Closed the code-review gate's cost-hygiene finding: an abandoned request kept running and charging the model. Threaded AbortSignal from the stream route (req.signal, fires on client disconnect) → orchestrate() → provider.generate(). OpenRouter combines it with the per-attempt timeout (AbortSignal.any) and never retries a caller cancellation; Mock honors it too. On abort, generate throws and the existing catch RELEASES the reservation — no phantom charge.
- Verified: 96 tests pass (was 94) incl. "caller-aborted turn releases its reservation, spend stays 0" and "OpenRouter does not retry a cancellation"; eval still 🟢 GO; build clean. (Observable only with a real/slow provider; the mock is instant.)
- Remaining (task #10) is now resource-gated: real provider + LLM-judge run (needs a free key), and a shared async KV ledger for multi-instance (a real rearchitecture, not a drop-in).

## Chunk 16 — Accessibility audit (WCAG A/AA) (2026-08-16)
- Ran a real axe-core audit (headless Chromium) across empty + active-conversation states in light AND dark: ZERO WCAG 2.1 A/AA violations — the design system's AA work holds up, now verified with a tool rather than asserted.
- Added the two proactive wins static axe can't assert: the transcript is an aria-live="polite" role="log" region (screen readers announce streamed answers) and the composer textarea has an explicit aria-label. Committed a reusable `npm run a11y` audit script (scripts/a11y-audit.mjs; manual/dev — needs a running server + browser, not CI).
- Verified: 94 tests pass; eval still 🟢 GO; build clean; re-audit after the changes still 0 violations. Next (task #10): real provider+judge run, shared KV ledger, stream cancellation.

## Chunk 15 — Proof gates on chunks 11-14 + fixes (2026-08-16)
- Ran a focused gate pass (AI red team + code review) on streaming/moderation/ledger/retry. Transport, reserve-then-reconcile, and retry confirmed SOUND. Fixed the 3 real holes they found, each with a regression test: (F1) input moderation ignored `history` -> now screens the full billed context on chat/stream/council; (F2) council had NO output moderation -> now redacts every member answer + the synthesis; (#1) the client stream reader hung forever on a non-2xx response -> extracted a tested `consumeChatStream` that checks res.ok, surfaces errors, and flushes the tail.
- Also added the missing res.ok check on the council path and a shared typed StreamEvent contract.
- Verified: 94 tests pass (was 86); eval still 🟢 GO; build clean. 3 lessons logged. Deferred (task #10): stream cancellation/AbortSignal, provider-side retry idempotency (paid only).

## Chunk 14 — Streaming responses (2026-08-16)
- Added POST /api/chat/stream: runs the full engine (moderation → cap → route → generate → output moderation → charge) via orchestrate(), then delivers the answer progressively as newline-delimited JSON events (delta… then done with the receipt; blocked/error events too). Client reads the stream and renders the answer live with the blinking cursor, attaching the receipt on completion.
- Reuses all existing logic (no duplicate accounting); true token-level streaming is a drop-in behind the same event shape once a streaming provider is wired. Honest limitation noted in code.
- Verified: 86 tests pass (was 83) incl. a stream-route test (deltas→done+receipt, unsafe-input refusal, body validation); eval still 🟢 GO; build clean; curled the live endpoint to confirm progressive NDJSON. Next: real provider+judge run, shared KV ledger, a11y.

## Chunk 13 — Content moderation guardrail (2026-08-16)
- Built the trust-safety P1 that was still open: lib/safety/moderation.ts screens INPUT before any model call (refuses with no charge/no call) and OUTPUT before it reaches the user (redacts; the real inference charge stands). Fails CLOSED if the classifier errors. Rules-based placeholder is a pluggable seam for a real moderation model. Wired into orchestrate() + council(); UI shows refusals as a plain assistant message.
- Conservative, phrase-specific rules keep benign chat from tripping ("kill a process", "the movie bombed" pass).
- Verified: 83 tests pass (was 78) incl. no-charge-on-input-refusal + output-redaction-keeps-charge + false-positive guards; eval still 🟢 GO (benign golden set unaffected); build clean. Lesson logged. Next: streaming, real provider+judge run, shared KV ledger.

## Chunk 12 — Harden the real free-provider path (OpenRouter) + tests (2026-08-16)
- Made the real open-source-model path production-worthy (QA had flagged it entirely untested): added a per-attempt timeout (AbortController) and a bounded retry on transient failures (429 + 5xx + network/timeout), since free tiers rate-limit hard; non-retryable 4xx surface immediately. Timing is constructor-injectable so tests run fast.
- Added 11 offline unit tests mocking `fetch` (zero keys, zero network): available() matrix, no-key/mismatch guards, content+usage parsing, usage fallback, empty choices, no-retry-on-400, 429-then-success, give-up-after-retries, network-error retry, timeout abort.
- Verified: 78 tests pass (was 67); eval still 🟢 GO; build clean. Next (task #10): real provider+judge eval run, streaming, moderation, shared KV ledger.

## Chunk 11 — Close the cost-cap TOCTOU (reserve-then-reconcile) (2026-08-16)
- Fixed the confirmed money-guard race both gates flagged: concurrent same-session turns could each clear the cap on a stale spend snapshot. Added reserve/reconcile/release to the ledger; orchestrate() and council() now reserve the estimate SYNCHRONOUSLY before the model call (no await in between), then reconcile to actual or release on failure — so a concurrent turn sees the reservation and is gated correctly.
- Single-process correctness; multi-instance still needs a shared store (task #10, unchanged).
- Verified: 67 tests pass (was 64) incl. 3 new concurrency tests (double-clear blocked, exact ledger under parallel load, failed-call releases reservation); eval still 🟢 GO; build clean. Lesson logged.

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
