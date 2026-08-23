# Handoff — the Feynman onboarding corpus for Homiquity

> **Freshness:** last verified 2026-08-22 · review every 60 days
> Verified against `origin/main` @ 12d7cbec (every chapter carries its own stamp).

This directory teaches the product to a full-stack engineer who has never seen it, and hands it
over to a team that will keep it running. It is a **layer over** the existing documentation, not
a replacement: the 12-chapter app-guide in `../handbook/app-guide/` stays the authoritative
description of each subsystem, `../handbook/FEATURE_MAP.md` stays the ownership map, and
`../governance/TEAM_PRACTICES.md` stays the house rules. Where this corpus and those disagree,
**the app-guide wins; where either disagrees with the code, the code wins** and the disagreement
becomes a row in [LEDGER.md](LEDGER.md) for the owning lane to fix.

## The Feynman contract (what every chapter owes you)

Richard Feynman's technique: explain it simply, find the gap you cannot explain, go back to the
source, then simplify again. Each chapter is built in that order and you can read it that way:

1. **The mental model** — one sentence you could repeat at a whiteboard.
2. **Explain it to a new hire** — exactly five sentences, no jargon that was not defined first.
3. **Mechanism** — one diagram of how it actually moves.
4. **The facts, with receipts** — every claim carries `path:line`, the symbol at that line, and the
   command that proves it. A count without its command does not appear in this corpus.
5. **Prove it yourself** — a block of read-only shell commands, each followed by the output it
   produced at the stamped commit. Run them; if an output differs, the code moved — add a ledger
   row, do not trust the prose.
6. **Where this breaks** — the documented traps and seams, and which test or guard would (or
   would not) catch each.
7. **What we do not know** — the gaps the authors could not close, each with what would close it.
8. **Analogy** — the simplification that survives step 7.
9. **Teach-back checkpoint** — questions you must be able to answer with a `path:line`; the
   answers live in [TEACHBACK_KEY.md](TEACHBACK_KEY.md), which you do not open until you have
   tried.
10. **Go deeper** — the app-guide chapter, runbooks, feature-map rows and owner agents for the area.

## Reading orders

**Day 1 — can I run it, and who is allowed to do what?**
[00 Product, roles and the map](00-product-roles-and-the-map.md) →
[01 Architecture and the request lifecycle](01-architecture-request-lifecycle.md) →
[02 Authentication and authorization](02-auth-and-authorization.md) →
[07 Test harness and the CI proof hierarchy](07-test-harness-and-ci-proof.md).
Then run `bash scripts/dev-up.sh` from the repo root and the Day-1 teach-backs.

**Week 1 — how does a loan move through it?**
[03 Data model and schema](03-data-model-and-schema.md) →
[04 Data flow: a loan's journey](04-data-flow-loan-journey.md) →
[05 Backend patterns, engines and adapters](05-backend-patterns-engines-adapters.md) →
[06 Frontend patterns](06-frontend-patterns.md) →
[10 Deploy, environments and migrations](10-deploy-environments-migrations.md).

**Month 1 — what must never change, and how we build without breaking it?**
[08 Compliance rails](08-compliance-rails.md) →
[09 Prompting and automation: the second codebase](09-prompting-and-automation.md) →
[11 Patterns and repetition](11-patterns-and-repetition.md) →
[12 The loop-safe build playbook](12-loop-safe-build-playbook.md) and its
[prompts/](prompts/) (rails, report format, eight templates, how to invoke).

## The registers

- [FACTS.md](FACTS.md) — every count the corpus uses, as `id | fact | command | value @ SHA`.
  Chapters cite `F-nn`; the numbers are re-derived, never edited by hand.
- [LEDGER.md](LEDGER.md) — drift found in *other* docs and in session memories, the
  uncertainties the authors could not resolve, and the refresh run log.
- [TEACHBACK_KEY.md](TEACHBACK_KEY.md) — the answer key.

## How this corpus stays true

Three layers, weakest to strongest:

1. **Freshness lines.** Every file carries `> **Freshness:** last verified YYYY-MM-DD · review
   every N days`. The repo's `scripts/doc-freshness-guard.cjs` enforces only the docs named in
   its own `REQUIRED` list, so these lines are a contract with the reader and with the refresh
   skill, not with the weekly workflow — a date here is bumped only after a real re-read.
2. **Command-derived facts.** A refresh re-runs every command in [FACTS.md](FACTS.md) and every
   chapter's prove-it block at the new `origin/main` tip, and re-stamps the SHA. A number that
   changed is a prose edit plus, if another doc carried the old number, a ledger row.
3. **A steward.** The doc-accuracy routine sweeps `knowledge-base/**` every six hours for dead
   pointers and renamed paths and may consume `HO-` rows as its own findings. A hand-invoked
   refresh skill (a follow-up to this corpus, in a separate PR) automates layer 2 end to end:
   detect moved paths with `git diff --stat <FACTS SHA>..origin/main`, re-run the commands,
   rewrite the generated block, log the run.

**Refresh protocol (manual, until the skill lands):** fresh worktree of `origin/main` → run
`pnpm guard:kb && pnpm guard:staleness && pnpm guard:citations && pnpm guard:docs` → re-run the
FACTS commands and each chapter's prove-it block → fix prose, add `HO-` rows, bump stamps only
for files actually re-read → append a line to the ledger's run log → PR with
`git add knowledge-base/handoff/...` explicitly.

## Conventions these files obey (and the guards that check them)

- Links are relative to the linking file (`TEAM_PRACTICES.md` §7).
- A backticked `path.ext` must exist in the repo (`scripts/citation-guard.cjs`); a file that is
  deliberately absent is named in prose.
- `pnpm` is the only package manager named; retired vocabulary never appears
  (`scripts/doc-staleness-guard.cjs`).
- Every file under `knowledge-base/` is reachable from `../README.md`
  (`scripts/kb-index-guard.cjs`) — this directory is indexed by one line there.
- No transient state (open PR numbers, branch names) in chapters; the ledger's run log is the
  only place a PR number belongs.
