---
name: lender-delivery-gate
description: Use ONLY when the user explicitly invokes /lender-delivery-gate or explicitly asks to "run the lender delivery gate routine". NEVER auto-load for general MISMO, ULDD, UCD, or Fannie Mae questions — those are answered from docs/fannie-mae/ per CLAUDE.md. This is a scheduled autonomous routine with its own safety rails.
---

# Lender Delivery Gate — can an organic file reach a lender clean?

**Cadence:** daily, 12:31. **Writes code:** small, safe, isolated fixes only.
**Produces:** the delivery verdict + the Target-5 execution board.
**Contract:** [`knowledge-base/routines/CHARTER.md`](../../../knowledge-base/routines/CHARTER.md)
wins over this file on any conflict; say so in the report rather than following the stale copy.

> **Provenance.** Reconstructed 2026-08-18 into the repo from CHARTER §1 (question A), §6, §9 and
> §10, from `CLAUDE.md`'s compliance-first section, and from this routine's own `2026-08-12` report,
> because the definition existed only on one machine — see
> [`logs/2026-08-18-routine-suite-audit.md`](../../../knowledge-base/logs/2026-08-18-routine-suite-audit.md).
> **Merge any rail the scheduled-task copy carries that this file lacks; never delete one.**

## Why this routine exists

CHARTER §1's question A is the product: *does an **organic** borrower file — not the demo seed —
reach a wholesale lender with valid ULDD/UCD/URLA/MISMO, no invented field names, and every
delivery edit satisfied?*

**Green delivery suites hide the answer, because the fixture is the seed.** The seed-vs-organic gap
is a *class* of defect, not a closed row: a field the seed provides and the product has no write
path for passes every test and blocks every real file.

### What it catches that no other control does

Two things nothing else looks at. **(1)** Whether the *product* can produce each field a delivery
edit requires — a reader with no writer. **(2)** Whether the delivery gate itself is real: eight of
nineteen MISMO 3.4 XSD cases once early-`return`ed when `xmllint` was absent, and **vitest reports
an early `return` as passed** — so the only schema-truth check on the lender-facing export went
green while asserting nothing.

## Rails

- **R1 — Invocation.** Only on an explicit `/lender-delivery-gate` or a scheduled-task prompt
  naming this routine.
- **R2 — Never invent a MISMO name, enumeration, container path, edit code or Special Feature
  Code.** Verify in [`docs/fannie-mae/`](../../../docs/fannie-mae/) or the official Loan Delivery
  job aid, or **stop and flag it**. The Selling/Servicing Guides outrank job aids; a discrepancy is
  escalated, never interpreted. This rail has no exceptions and no "probably".
- **R3 — Lane: small, safe, isolated fixes only.** Never the underwriting/decision/rule engines,
  never `shared/schema/**` or `migrations/**` without a same-PR hand-authored migration, never the
  CHARTER §6 permanent list. A fix that cannot be reviewed in one CI cycle is a proposed ticket.
- **R4 — The §5 claim lock** before writing any line: fetch, rebase, reinstall, read open PRs and
  `REGISTER.md`, claim, push the claim with the branch, release on finish.
- **R5 — Nothing outbound, ever.** Target-5 lender contact is **founder-held** (CHARTER §1b, L3).
  This routine drafts and boards; it never calls, emails, or fills in a lender's form.
- **R6 — A skipped check is reported as skipped.** Assert that a validator actually ran. `it.skipIf`
  makes absence visible; an early `return` makes it invisible. If a tool the gate depends on is
  missing from the runner image, that is a finding, not a footnote.
- **R7 — CHARTER §8 verbatim.** Never push to `main`, merge, arm auto-merge, flip a production
  variable, or apply a migration.
- **R8 — Date every standing claim.** The §1.3 lender actions have an age; report it, and
  re-verify a blocker before repeating it (F1/NMLS **is cleared** — `shared/companyIdentity.ts`).

## Phase 0 — Orient

Fetch, branch off current `origin/main`, `pnpm install --frozen-lockfile` after the rebase. Read
`CHARTER.md` (§1, §5, §6), `REGISTER.md`, `CTO_ROADMAP.md` §1.3, and the day's upstream reports
(missing one → `WARN` naming it, then continue).

## Phase 1 — The delivery capability gate

**Glob the suite from `tests/`, never a fixed list** — a fixed list silently stops covering a file
somebody adds. Run the delivery lane and report suites/tests/exit code verbatim.

Then check the gate's own integrity:

- Did every XSD case actually execute, or did some skip for a missing validator (R6)?
- Is the MISMO version what the code says it is (`DataVersionIdentifier`)?
- Are the delivery-lane tests in `vitest.config.ts`'s `include:`? A file on disk that is not in the
  array **never runs**, and everything above it reads green.
- Which delivery tests live only in `vitest.integration.config.ts`? Those **never run in CI** —
  name them, because a role gate covered only there is a gate nothing enforces on a PR.

## Phase 2 — The organic-file rotation (the heart of this routine)

Pick **one** field or requirement per run and prove it end to end **from the borrower's side**:

1. Which delivery edit / URLA section / UCD field requires it, cited to `docs/fannie-mae/`.
2. Is there a **borrower-reachable write path** — a real screen, not a seed value or an admin
   fixture?
3. Does it persist to **the exact row the readiness check reads**?
4. Does the export emit it, and does the export validate?

Record the field, the verdict (`clears` / `blocked: <why>`), and the chain in `file:line` form.
Rotate: anti-steering acknowledgment, demographic information, declarations, REO, gift funds,
employment gaps, co-borrower party structure, AUS recommendation, appraisal identifiers.

## Phase 3 — Target-5 execution board

`CTO_ROADMAP.md` §1.3 — the wholesale-lender shortlist. F1 (NMLS #427468) has been cleared since
**2026-07-13**, so this is live work, not gated work. Report each action with its **age in days**;
an ageing board is the finding. All five actions are outbound and therefore founder-held (R5) —
this routine keeps the board honest and prepares what a human can send, nothing more.

## Phase 4 — Fix (only if small, safe, isolated)

Regression test first, verified failing against the previous code. Then `pnpm check` · `pnpm test`
(both lanes, new filenames confirmed in the output) · `pnpm build` · `pnpm guard:*` ·
`detectTriggers()` on the final diff. A §9 trip ships as a **draft** PR with ⛔; you never author
the review.

## Phase 5 — Report

`knowledge-base/routines/reports/<YYYY-MM-DD>-lender-delivery-gate.md`, CHARTER §9 order: `STATUS`
· ⛔ human actions (Target-5 first, with ages) · Summary ≤5 sentences · Evidence (suite output, the
rotation chain, `file:line`) · proposed tickets. Commit
`docs(routine): lender-delivery-gate <date>`, PR it, release the claim.

**Status rules.** `FAIL` = an organic file cannot be delivered, or the gate is asserting nothing.
`WARN` = a rotation field blocked, a validator absent from the runner, an ageing Target-5 board, a
missing upstream. `OK` = the gate is real and the rotated field clears.

## What this routine deliberately does not do

Contact a lender · touch the engines · invent a single MISMO name · merge anything · build the
deferred lender API/UI (LS-10 is founder-gated on a signed broker–lender agreement).
