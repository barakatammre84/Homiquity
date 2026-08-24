---
name: financial-audit
description: Use ONLY when the user explicitly invokes /financial-audit or explicitly asks to "run the financial audit routine". NEVER auto-load for general finance, pricing, compensation, QM, or unit-economics questions — those belong to mortgage-calculations and the app-guide. This is a scheduled autonomous routine with its own safety rails.
---

# Financial Audit — recurring capital-structure & money-path routine

**Authority — Fannie policy.** The *Selling Guide*, edition 08-05-2026, is committed at
[docs/fannie-mae/selling-guide/](../../../docs/fannie-mae/selling-guide/) and controls over every
job aid. Any Fannie claim you make or repeat cites a section id resolving in `section-index.tsv`,
read out of the committed text this run — never from memory. An id the index does not know is a
**wrong** citation, not an old one. A value read out of a **table** is unverified until you open
the PDF page. (TEAM_PRACTICES §10; enforced by `pnpm guard:authority`.)

Audits the financial wiring of the business **as implemented in code**: capital flow,
risk/liability, unit economics, balance sheet. One run = at most ONE reviewable PR,
never merged by you. Every merge to `main` auto-deploys to production; the human
owner is the only merger. If any rail conflicts with making progress, the rail wins:
stop, record, report.

This routine runs **in a loop alongside other sessions**. Most ticks should be cheap
no-ops. A tick that finds nothing and says nothing is a success, not a wasted run.

## Rails (non-negotiable, re-check before every phase)

R1. If this skill loaded without an explicit `/financial-audit` invocation (or a
    scheduled/loop prompt naming it), STOP — say so and do nothing else.
R2. **Memory before work.** Phase 0 runs in full, every tick, before anything else.
    A run that audits stale state produces confident wrong findings, which is worse
    than no run. Never skip it because the last tick was recent.
R3. **Freshness — never more than 2 commits behind.** Re-base the working branch on
    `origin/main` when it is ≥1 behind; if it is >2 behind, refreshing is the ONLY
    work this tick. Never audit or edit from a stale base.
R4. **Backpressure — never more than 2 open PRs from this routine.** At ≥2 open,
    enter OBSERVE MODE: Phase 1 only (memory + report). No code, no new PR. Report
    ends by listing the PRs awaiting review. Unreviewed work is not progress.
R5. **PR-only.** Never merge, never enable auto-merge, never push to `main`, never
    force-push a shared branch. `git add` explicit paths only — never `git add .`/`-A`.
R6. **Findings are evidence-bearing or they are not findings.** Every claim cites a
    file:line AND is confirmed by executing the repo's own functions where it can be.
    No finding from memory, and no regulatory reading asserted — flag it per the
    CLAUDE.md no-citation-no-implementation rule and the `data/regulatory` ledger.
R7. **One finding fixed per run, maximum**, and only a finding already in the ledger
    at status `authorized`. Discovery does not imply permission: a NEW finding is
    recorded and reported, never fixed the same tick. The owner promotes it.
R8. **Money-path changes are conservative in one direction only.** A fix may remove a
    borrower charge, tighten a gate, or exclude unreal money from a real figure. It
    may never create the exposure it guards against, invent a regulatory reading, or
    make a refusal more permissive.
R9. OFF LIMITS to autonomous edits (ledger-flag instead): `migrations/**`,
    `shared/companyIdentity.ts` (NMLS id, license numbers, licensed states — a
    compile-time compliance control on purpose), `server/services/encryptionService.ts`,
    `ssnVault.ts`, `server/auth.ts`, `socialAuth.ts`, `server/integrations/auth/**`,
    `docs/**`, `data/regulatory/**`, `.claude/**`, `package.json` + `pnpm-lock.yaml`
    (no new dependencies, ever).
R10. **Schema changes are migration-gated.** If a fix needs a `shared/schema/**`
    column it needs a hand-authored migration in the same PR (CLAUDE.md). A routine
    tick must not author a contract migration (`SET NOT NULL`, `CHECK`, `FK`, type
    narrowing) — that needs a prod data probe. Ledger it `blocked-human`.
R11. **§9 is rehearsed, never self-certified.** If the diff touches a
    TEAM_PRACTICES §9 trigger, run the structured pass and record it in the PR body.
    You never write a "Security review" heading merely to satisfy the gate.
R12. Max 5 verify-loop attempts. On exhaustion: discard code, record the failure in
    the ledger, report.

## Phase 0 — Memory refresh & team sync (every tick, no exceptions)

The point of this phase is that the routine re-enters the world as it *is*, not as it
was when the loop started.

1. `git fetch origin` (network failure → retry 2s/4s/8s/16s; still failing → ABORT
   with a report; never audit offline).
2. **Position:** `git rev-list --left-right --count origin/main...HEAD`.
   - behind ≥1 → rebase/reset the working branch onto `origin/main` before any audit.
   - behind >2 → R3: refreshing is the whole tick. Report and stop.
3. **Read the memory, in this order** — this is what keeps findings from being
   re-discovered or re-fixed:
   - `knowledge-base/financial-audit/LEDGER.md` — the F-### register and statuses.
   - `git log --oneline origin/main -20` — what landed since the last tick.
   - The newest `knowledge-base/logs/*financial-architecture*` entry.
   - `CTO_ROADMAP.md` §0–§2 if the tick may touch launch-blocking work.
4. **Team sync — assume you are not alone, and do not rely on seeing anyone.**

   Order matters: the signals below run **strongest first**, because the weakest one
   is the one that feels most authoritative.

   a. **`origin/main` — always true, no cooperation required.** `git log --oneline
      origin/main -20` and open PRs (`mcp__github__list_pull_requests`, state
      `open`). A file with an open PR against it is claimed by that PR.
   b. **[`knowledge-base/routines/REGISTER.md`](../../../knowledge-base/routines/REGISTER.md)** —
      the single claim board (absorbed `SESSION_CLAIMS.md` 2026-08-12; that path is now
      a stub). Declared intent, which `main` cannot show until work lands. Read it,
      honour live claims, and **write your own claim** before Phase 2. The contract
      around it — graduated overlap, the assist ladder, date-qualified finding ids —
      is [`routines/CHARTER.md`](../../../knowledge-base/routines/CHARTER.md) §5, which
      binds this routine and wins wherever it and this file disagree.
   c. **`ListAgents` / `SendMessage` — a bonus, never the gate.** Verified blind on
      2026-08-12: it returned *No reachable agents* while another session's financial
      audit was merging into `main`. **Never skip or defer a tick on the strength of
      an empty `ListAgents`** — it cannot see the sessions that cause collisions. When
      an agent IS reachable and its work overlaps, message it; that is real
      coordination, and it is the only thing here that beats a claim file.

   **Graduated response — proceed / adjacent / defer.** Blanket deference is not
   teamwork; it is a routine that never runs. Measure the overlap, then choose:

   | overlap | response |
   |---|---|
   | none | Proceed. Claim your files. |
   | adjacent (same area, different files) | Proceed, claim, and keep the diff inside the files you claimed. |
   | direct (same file, or the same finding-id space) | **Do not race.** Ledger `blocked-collision: <PR#/session>`, pick another row, and `SendMessage` if reachable. |

   **Finding ids are date-qualified: `F-<MMDD>-<NN>`**, using your audit's own date
   (`F-0812-01`). Never a bare next-free integer — six of the nine financial audits
   minted `F-20` that way, and it now means six different findings. The scheme needs
   **no lookup and no coordination**, which is the point: a session that cannot see
   `main` can still mint a correct id. `F-1`…`F-19` keep their original form (single
   origin, unambiguous, cited throughout the repo).

   **Merging another session's work is not a formality.** Resolve conflicts
   *additively* where the two changes are independent concerns, and **re-verify by
   hand any money path that auto-merged** — a clean auto-merge across two sessions'
   edits to one financial mapping is not evidence that the result is correct.
5. **Ledger reconciliation:** for each row at `in-pr`, check its PR — MERGED → `done`
   (record PR# + date); CLOSED-unmerged → `failed: closed unmerged — ask owner`.
6. Apply R4 backpressure. Then decide the tick's mode:
   `refresh-only` | `observe` | `audit` | `fix` | `aborted`.

## Phase 1 — Audit (the four areas, evidence-first)

Scope is the money-bearing code, re-derived rather than recalled:

- **Capital flow & liquidity** — rate-lock commitment integrity, fund-flow decoupling,
  who bears risk during funding delays, operational account separation.
- **Risk & liability** — Reg Z/TRID gates, counterparty concentration and approval,
  unhedged and contingent exposure, PII-transmission authorization.
- **Unit economics** — revenue vs. cost per file, pull-through, margin leakage, and
  whether any figure mixes simulated activity with real.
- **Balance sheet** — asset-liability matching, the contingent-liability register,
  reserve adequacy, capital efficiency.

Method that has actually worked here, in order of value:

1. **Diff-driven first.** Audit what changed since the last tick — a refactor that
   moves a rule is the highest-yield place to look. The 2026-08-12 findings all came
   from one refactor that relocated a shared rule and taught only one caller.
2. **Ask who else reads the rule.** A pure, well-tested rule with ONE consumer is the
   signature defect of this codebase: other surfaces re-derive it and get it wrong
   permissively. `grep` every consumer of any money/authorization predicate.
3. **Execute, don't reason.** Confirm each candidate by running the repo's own
   functions against a constructed row. A finding that cannot be executed is a
   hypothesis; label it as one.
4. **Check the measurement, not just the mechanism.** Twice now the register meant to
   size an exposure has under-reported it for the same reason the exposure existed.
5. Record every survivor in the ledger with a NEW `F-###` id, evidence, quantification
   where possible, and a proposed structural fix. New findings enter at `open`.

## Phase 2 — Fix (only if the tick's mode is `fix`)

Permitted only for a ledger row at `authorized`, one per run (R7), within R8–R11.

1. Work on the designated branch, rebased in Phase 0. Never the primary checkout's
   uncommitted state.
2. Tests first where the fix changes a rule's meaning: pin the CURRENT behavior, then
   change it, so the re-based assertions ARE the record of the change.
3. Prefer fixing the definition over its callers when every surface already routes
   through one function — that is what makes a one-line fix repair four surfaces.
4. Verify loop (max 5, restart from 1 on any failure):
   `pnpm check` → `pnpm test` → the guards (`design-token`, `kb-index`,
   `doc-freshness`, `schema-migration`, `delivery-stack-freeze`) → `pnpm build` for a
   client-touching change.
5. **Test-ran assertion:** a new file under `tests/` is glob-collected by `vitest.config.ts`
   (the hand-typed `include:` allowlist was deleted by #725, 2026-08-24). Confirm the filename
   appears in the output — that is the proof either way.
   (Client tests under `client/src/**` are glob-included too.)
6. Snapshot guards: if `zod-schema-semantics` reports a delta, READ EVERY LINE and
   state in the PR body what changed and why, before re-recording.

## Phase 3 — Record, PR, report (always runs, any mode)

1. **The log is the deliverable.** Append findings and remediation to the dated
   `knowledge-base/logs/YYYY-MM-DD-financial-architecture-*` entry (new file per
   audit date), and index it in `knowledge-base/README.md` — the KB index guard
   enforces this.
2. Ledger updated in the SAME PR as the change it describes. Memory that travels
   separately from the work is memory that goes stale.
3. Commit in house style: what changed, why, what it costs, what stays open. End with
   the standard `Co-Authored-By: Claude` trailer.
4. Push to the designated branch. **Never merge.** Open a PR only when the owner has
   asked for one, or when the tick produced a code change that needs review.
5. **Notify only when it matters.** A scheduled tick reaches its owner through
   `PushNotification`, and their attention is the scarce resource:
   - Notify: a NEW finding at High/Critical, a fix landed, a regression in a
     previously-fixed finding, or the routine could not run.
   - Stay silent: nothing changed, everything still green, same as last tick.
6. Final report sections: Mode · Position vs `origin/main` · Memory delta (what landed
   since last tick) · Other sessions/PRs in flight · Findings (new / confirmed /
   refuted) · Work done (PR URL or "none — why") · Ledger delta · Still open.

## What this routine deliberately does not do

- **Decide the business.** The broker-vs-correspondent channel (F-14), the fee
  schedule vs. comp plan trade-off (F-17), and the minimum-net-worth line are owner
  decisions. The routine keeps them visible and quantified; it never picks.
- **Assert a regulatory reading.** Every authoritative source is blocked from this
  environment. A Reg Z / NMLS reading is flagged in the ledger, never asserted, and
  may only move conservatively (CLAUDE.md).
- **Make company identity editable.** `shared/companyIdentity.ts` is a compile-time
  compliance control; a deploy is the correct friction for a value that gates market
  entry.
