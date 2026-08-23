# Handoff — the Feynman onboarding corpus for Homiquity

> **Freshness:** last verified 2026-08-23 · review every 60 days
> Verified against `origin/main` @ 6377727e (every chapter carries its own stamp).

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
3. **A steward, on a clock.** Since 2026-08-23 the daily 17:06 seat (**Handoff Corpus Steward**,
   `.claude/skills/handoff-refresh/SKILL.md`; CHARTER §3 — it took over the laptop `taskId`
   `client-journey-walk` when the daily walk retired to hand-invocation) runs layer 2 end to end
   every day: detect moved paths with `git diff --stat <FACTS SHA>..origin/main`, re-run the
   commands, rewrite the generated block, **age the open `HO-` rows** (a fix-now row older than
   7 days becomes a ⛔ line naming its lane), log the run. Its clocks: `--check`/`--cite` daily ·
   FACTS fully re-derived every ≤14 days · every chapter re-read in rotation every ≤30 days — so
   the numbers are never fresher than the prose that interprets them. The doc-accuracy routine
   still sweeps the rest of `knowledge-base/**` and consumes `HO-` rows as its own findings; since
   2026-08-23 it never edits `handoff/**` itself (CHARTER §6 — one writer per truth).

**Refresh protocol:** invoke the `handoff-refresh` skill, or do it by hand — fresh worktree of
`origin/main` → `pnpm handoff:facts --check` and `--cite` to find drift mechanically, plus
`git log <FACTS-stamp>..origin/main` to find the drift no tool can see (a count can be unchanged
while the *reason* for it changed) → `pnpm handoff:facts --write` → fix the prose the numbers
belong to → `pnpm guard:kb && pnpm guard:staleness && pnpm guard:citations && pnpm guard:ui` →
add `HO-` rows, bump stamps only for files actually re-read → append a line to the ledger's run
log → PR with `git add knowledge-base/handoff/...` explicitly.

**Two rows measure `HEAD`, not `main`** — F-31 (commits) and the SHA stamp — which is why
`--write` refuses to run from a branch ahead of `origin/main`. And F-21 counts this corpus
itself, so it rises the moment `handoff/` merges.

## What changes when you build

Nothing here replaces how you already work. It changes what is *available* when you ask, and it
names the four things a session cannot do for you.

### An ordinary session — the default, and the right choice for most work

`CLAUDE.md` loads automatically, plus a router skill when the work matches its domain. That is
already true today. What this directory adds is a place to point:

- **"Read handoff chapter NN first"** for territory you have not worked in. Cheaper than letting a
  session re-derive the architecture from greps, and the chapter's claims carry commands you can
  re-run rather than assertions you have to trust.
- **"Follow `prompts/_RAILS.md`"** for anything with a testable outcome. That single sentence buys
  the territory discipline (a declared WRITE list, checked against `git diff --name-only`) and the
  tier evidence (T0–T3 lines copied from logs, not recalled) — with no loop machinery at all.

Still binding, unchanged by any of this: work in a worktree off `origin/main`, never the primary
checkout. The pre-push hook is the only gate that runs on its own, and since #660 it is the
**cheap half** — typecheck plus eight guards, ~25 s, and **no unit tests** unless you set
`PREPUSH_TESTS=1`. `knowledge-base/governance/TEAM_PRACTICES.md` §5 is the definition of done.

### A loop — for bounded work, not as an upgrade

Use `prompts/INVOKE.md`. A loop is worth its overhead when the task is one layer, one WRITE list,
and has a test that can go red before it goes green — a characterisation test, a contained bug
fix, a migration. It is the wrong tool for anything exploratory, because a loop cannot decide that
the task was the wrong task.

Four mechanics that cost a real acceptance run to learn: headless `claude -p` does **not** expand
the slash command (run the plugin's setup script first, and blank the `session_id` it inherits);
the completion promise must be the **last line** of the final message, after any prose; fresh
worktree with `pnpm install --frozen-lockfile`, port 5002, and a scratch directory **outside** the
repo; and a loop that adds a client test will be told to regenerate the design-system table, which
is sanctioned and belongs in its own commit.

A loop ends in `DONE` with T0–T3 lines copied from its logs, or `STOPPED(<reason>)` with a
hand-back naming the line, the change and the owner. **It never merges.**

### What never moves to a loop, or to a session running unattended

Merging · the T5 `/api/health` commit check · §9 security reviews · contract migrations · anything
in a hand-back file (auth, the decision engines, the PII vaults) · regulated math without a ledger
citation · CHARTER §1b rows L3 and L4.

### The five facts that bite hardest, and where each is proved

| | fact | proof |
|---|---|---|
| 1 | `main` requires **zero** status checks, and `enforce_admins: true` binds admins to an empty list. A green gate is advisory. | FACTS F-44; chapter 07 |
| 2 | A merge is a deploy, and a **failed** Railway build leaves the previous container serving — so the site stays up and every check stays green while prod goes stale. Only `/api/health`'s `commit` proves a ship. | chapter 10 |
| 3 | `pnpm test` runs a hand-maintained **allowlist** — an unlisted node test is silently never run. Since #670 (`fd4a22c5`, 2026-08-23) the command IS the floor: `scripts/test-collection-guard.cjs` fails on a collected-vs-on-disk shortfall and on a test in no lane, and the once-stranded `tests/maintenanceMode.test.ts` is listed (`vitest.config.ts:306`). The discipline stands: append your new test to the allowlist, and read the collected counts. | FACTS F-13, F-39; chapter 07 |
| 4 | Adding a colocated client test reddens `guard:ui` until you run `pnpm guard:ui --write-table`, because the generated table's denominator counts test files. This has already merged red to `main` once. | LEDGER HO-0822-25, HO-0822-26 |
| 5 | The dominant defect class here is an operation that **does not happen while the UI says it did** — a 200 for a write that was silently dropped. Chapter 04's draft round-trip is the worked example, and its fix did not close the class. | chapter 04 |

### If something you were told here is wrong

That is expected, and it has a route: it becomes an `HO-<MMDD>-<NN>` row in
[LEDGER.md](LEDGER.md), never a silent edit to a sibling doc. The precedence rule at the top of
every chapter is the first defence — **the app-guide wins on conflict, and the code wins over
both.** You are meant to distrust this directory and check.

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
