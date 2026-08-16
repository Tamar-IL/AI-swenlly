# Lessons Ledger — the Self-Improving Org

This is the org's long-term memory. When a reviewer (Critic, Eval, QA, AI Red Team) catches
something that matters, it gets one line here: **symptom → root cause → the rule that prevents
it.** Recurring lessons graduate into `CLAUDE.md` (the shared culture) so every future agent
inherits them automatically.

Humans forget lessons between projects. This org compounds them.

| Date | Caught by | Symptom | Root cause | Rule that prevents it |
|---|---|---|---|---|
| _(seed)_ | — | — | — | Write tests with the code; a bug fix ships with a test that would have caught it. |
| 2026-08-16 | AI Red Team / Code Review | Manual override let a client force the strong model past an exhausted cap | Override branch returned before the cost-aware clamp ran | Every model choice — override included — passes the budget gate; nothing bypasses the cap. |
| 2026-08-16 | Trust & Safety / Red Team | Council mode called every model with no accounting → uncapped paid fan-out | Council was a stub that hit the real provider but never touched the ledger | A path that calls a paid provider is metered and cap-gated, even when it's a stub. |
| 2026-08-16 | Red Team / Code Review | Client-supplied `history` could inject `system` turns and hide a huge billed workload the classifier/cap never saw | History was passed through unvalidated; only `prompt` length was capped | Validate all client message history (roles user/assistant only, bounded count+bytes); budget against the FULL billed context, not just the prompt. |
| 2026-08-16 | QA | A single NaN token count from a provider silently disabled the cap for the whole session | `??` caught null but not NaN/strings; NaN cost poisoned the ledger | Sanitize provider-reported token counts to finite non-negative integers before any cost math. |
| 2026-08-16 | Red Team / Code Review | The per-session cap keys on a client-minted sessionId → rotate it to reset spend | sessionId is untrusted input with no server-side identity | Back the cap with an IP-keyed rate limit; treat the sessionId cap as UX, not a security boundary. |
| 2026-08-16 | QA | Cap budgeted a fixed 400-token output but billed actual (up to 1024) → single-turn overshoot | Pre-call estimate didn't match the provider's max output | Budget pre-call against the provider's MAX output tokens so actual can never exceed the estimate. |
| 2026-08-16 | QA | Strong-intent prompt on a catalog missing the strong tier fell straight to the free model | `modelForTier ?? cheapest` skipped the best available lower tier | Degrade to the best AVAILABLE tier at/below the target, not the globally cheapest. |

<!-- Append new rows above this line. Promote a recurring rule into CLAUDE.md §3 or §5. -->
