# The Company — an AI-native engineering team that builds your ideas end-to-end

This repo is a **team of specialist AI agents** that takes a project idea and drives it from
"here's what I want" to a built, reviewed, documented deliverable — the way a top-tier
software company would. It's the working implementation of the org map in
[`docs/engineering-org-map.md`](docs/engineering-org-map.md).

You are the **founder**. You give the idea and make the final calls. Everything else — framing,
design, building, reviewing, documenting — the team does.

---

## The 60-second mental model

```
YOU (founder)  ──►  ORCHESTRATOR  ──►  22 senior specialists  ──►  reviewers gate the work
   the idea         the main chat        do the actual work         before it ships
```

- **You** talk to the main agent (the Orchestrator).
- The **Orchestrator** reads your idea, decomposes it, and routes work to the right specialists.
- **Specialists** (Backend, Frontend, Architect, Designer, DBA…) do the work — in parallel
  where they can.
- **Reviewers** (QA, Code Reviewer, Critic, AppSec, and for AI products Eval / Trust & Safety
  / AI Red Team) attack the work at **proof gates** before it advances.
- Nothing you built as culture is lost: caught mistakes become permanent lessons
  (`docs/lessons.md`).

The full rules the team runs on live in [`CLAUDE.md`](CLAUDE.md) — that file loads
automatically every session.

---

## How to use it — just start Claude Code in this repo and describe your idea

The magic word is nothing special. Open Claude Code here and say what you want built. For best
results, tell the Orchestrator to run the protocol. For example:

> **"You're the Orchestrator. Read `CLAUDE.md` and run the orchestration protocol on this
> idea: _<your idea here>_. Deploy only the agents this project needs, run the proof gates,
> and give me a founder summary at the end."**

The Orchestrator will:
1. **Frame** it with the Product Manager (what/why, MVP, risks) and ask you only the questions
   that change the build.
2. **Design** it (Architect + Designers), consulting the Advisor on big bets.
3. **Build** it (Backend / Frontend / DBA / AI specialists — in parallel).
4. **Gate** it (QA → Code Review → Critic, plus security/AI gates as needed).
5. **Document & hand back** a summary: what's built, what's proven, what's deferred, what's next.

You stay in control: it asks before expensive or irreversible decisions, and you break ties.

---

## The team (T1 core — the "build-first" senior team)

| Discover | Build | Run & Scale | Improve | AI Operations | Cross-cutting |
|---|---|---|---|---|---|
| product-manager | software-architect | platform-engineer | performance-engineer | ai-llm-platform-engineer | qa-engineer |
| prototyper-poc | backend-engineer | devops-engineer | code-reviewer | prompt-engineer | technical-writer |
| | frontend-engineer | | critic | eval-engineer | advisor |
| | database-engineer | | | trust-safety-engineer | |
| | product-designer | | | ai-red-team | |
| | ui-visual-designer | | | | |
| | appsec-engineer | | | | |

Each is a file in [`.claude/agents/`](.claude/agents/). The AI-Operations column only fires
when the thing you're building **is itself an AI/agent product**.

---

## Growing the team

Your map has ~45 roles across 3 tiers; this is the **T1 core** (build-first). To add a role:
- **On demand (T2):** ask the Orchestrator, e.g. *"we need a Mobile Engineer for this"* — it
  raises a **requisition**, and on your approval a new agent file gets created from the same
  template. This requisition-based rule is the brake that keeps the team from sprawling.
- **By hand:** copy any file in `.claude/agents/` and adapt it.

Roles are added deliberately, never on a whim — see the "requisition" rule in `CLAUDE.md`.

---

## The four "attackers" — so you're never confused

Four roles live in the adversarial neighborhood. Three attack, one defends:

| Agent | Attacks / owns | Asks |
|---|---|---|
| **critic** | the work product | "Is this good work?" |
| **appsec-engineer** | classic system security | "Can I break in?" |
| **ai-red-team** | the AI/agent behavior | "Can I make the agent misbehave?" |
| **trust-safety-engineer** | *builds the defenses* | "Will the defenses hold?" |

---

## Files in this repo

- `CLAUDE.md` — the shared culture + the orchestration protocol (loads every session).
- `.claude/agents/*.md` — the 22 specialist workers.
- `docs/engineering-org-map.md` — the full org map (the source of truth, all 45 roles / 3 tiers).
- `docs/lessons.md` — the org's growing memory of caught mistakes.

---

*Built from the org map v1.2. Next phases per the map: add T2 roles on demand, and let the
lessons ledger compound.*
