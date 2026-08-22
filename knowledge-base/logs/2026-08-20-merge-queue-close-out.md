# Merge-queue close-out — 2026-08-20

Founder-directed close-out under the standing merge authority granted 2026-08-20 (recorded
in session memory with its conditions). Starting state 16:35Z: **19 open PRs** (6 DIRTY,
0 auto-merge armed), **48 live remote branches / 58 unmerged refs**, ~30 PR-less.
**GitHub Actions billing failure active throughout** — every gate reds in ~2s — so
verification ran locally per merge: the full CI gate (tsc, both vitest lanes, all nine
guards, production build, bundle ratchet) on the exact tree that merged, `detectTriggers()`
§9 audits per product PR, and the pre-push hook on every conflict-resolution push. Deploys
verified by `/api/health` `commit`, never by CI.

## Merged — 17 PRs' content, all premise-verified against current main, locally gated, deployed

Docs lane: **#627, #625, #626** (routine reports + the push-through-tail trap doc).
Batch A (file-disjoint, one gate): **#604** (§9 guard covers loginLockout), **#606**
(jumbo/conforming fix), **#620** (CI docs-only fast path + 6-min deploy alarm — halves
billed minutes when Actions returns), **#596** (borrower Loan Estimate reachable — TRID
delivery can actually happen), **#610** (Section 1e income type catalog).
REGISTER trio (conflicts resolved additively): **#624** (notifications unread-forever fix;
eager baseline 523735→523771, +36 = the fix itself), **#598** (URLA progress counts the
application, not the open tab), **#619** (NeedHelpCard dead buttons; inert-button ratchet
LOWERED 37→35).
DIRTY set: **#617** (homeowner Hub 500 fix), **#607** (client-journey seats — the add/add
JOURNEYS.md was woven: journey definitions as spine, parked walk findings preserved; this
un-silences 3 registered routine seats), **#623** (autopilot all-clear honesty;
DESIGN_SYSTEM §0 table regenerated per the guard), **#605** (touch-target sweep 232→0,
ratchet locked at 0; eager baseline → 523895, measured +78; carries the plain statement
that ux-26's five dead controls are NOT wired by it).
Recovery: **#630** = #615 + #601 (see incident below). **#631** = docs rescue.

## The #615 incident — caught, recovered, and now a permanent bar item

#615 was a **stacked PR whose base was #601's branch**, not main. Merging it landed the
squash into that base branch — which this session then deleted after closing #601 as
"contained". Result: MERGED state, nothing on main. Caught within minutes because the
post-merge check compares main's tip against expectation; recovered because the locally
gated resolution tree still existed in the drain worktree. It was re-based onto current
main and landed as **#630** (base verified = main). Corrections posted on #615 and #601.
**Bar change: `baseRefName == main` is now checked before every merge** (memory updated).
Every other PR merged today was audited retroactively: all 13 had base = main.

## Closed without merging

- **#542** rescue draft — ~90% landed byte-identically (blob compare); the 2026-08-19
  wiring-audit report holds patches for the 3-item remainder (funnel-footer NMLS number ·
  VA constants dedupe in underwritingEngine.ts:440,490,491 · Footer prelaunch no-op).
  Remainder spawned as a follow-up task chip. Branch deleted.
- **#601** — contained in #630 (its branch is a git ancestor of the merged tree).

## Dead branches deleted (13, each with a tombstone)

| branch | last SHA | why dead |
|---|---|---|
| routine/vendor-procurement-2026-08-17 | d4f4673b | fully landed |
| claude/rescue-542-compliance-tests | 4b0b214d | landed; tests registered on main |
| claude/rescue-542-va-residual-parity | 61d04d33 | landed; tests registered on main |
| probe/prod-data-census | a0d97c58 | self-declared "throwaway, never merge" |
| wip/radar-2026-08-08-scenario-simulator-abandoned | e39fac61 | superseded by merged #467 |
| claude/kind-franklin-bnjkvr | 7c4aac54 | regenerable refactor (radar ledger holds it) |
| claude/kind-franklin-c8t8d7 | acd0d1c5 | regenerable refactor |
| claude/kind-franklin-hl5zld | eb462ba0 | regenerable refactor |
| claude/kind-franklin-xuvxii | b9e167c2 | duplicate of bnjkvr |
| claude/determined-mccarthy-ozgcqg | 29a52056 | stale vs main; no unlanded content |
| claude/invite-validate-pii-audit | 8f8bd9d5 | only stale vitest.config delta |
| fix/ux-30-le-reachable | b77689b7 | v1, superseded by merged #596 |
| claude/lucid-edison-br5hsb | (#542 head) | closed draft; remainder documented + chipped |
| feat/homi-server-truth-tools | 3d293968 | contained in #630 |

## Rescued

- **#631 (merged):** the 08-13 / 08-15 / 08-18 financial-architecture audit logs from the
  three fervent-mayer branches — log files verbatim + indexed; their LEDGER/SESSION_CLAIMS
  edits deliberately dropped (re-importing dated ledger states is the duplicate-finding-id
  failure). Local-dev's closeout log was NOT rescued — main already holds the corrected copy.
- **#636 (merged):** lucid-edison-28s32n — PurchaseRates' hand-rolled zero state → the
  shared EmptyState pattern; persona-routed article CTAs (new lib/personaRoutes.ts + test).
  The ux-38 conflict was resolved by rewriting its CTAs in asChild form (nestedInteractive
  ratchet stayed 0).
- **Drafts for founder review:** #633 (lucid-edison-6uopmz, SEO wiring — held for the
  marketing rails), #634 (frontend-standardization-2, the 16-file useQueryClient remainder).

## Parked — needs the founder

1. **#609 login-lockout fix** — carries migration 0057; `migrate-prod` is an Actions job,
   so merging during the billing outage deploys auth code whose column never gets created
   (the 2026-07-13 outage class). Merge the day Actions bills again. The fix itself is good.
2. **Actions billing** — the root blocker; #620 cuts the burn once restored.
3. **claude/design-cleanup-visual-tccg20** — 38-file "calm emerald" design pivot. Product
   direction call.
4. **claude/routines-code-quality-review-snqxol** — CHARTER §13 local-first-freeze
   governance rewrite (32 files unlanded). Fleet-governance call.
5. **wip/ snapshots** (primary-checkout-leftovers 28 · rate-pages-search-extraction 13 ·
   sop-manual-draft 5 · trid-loan-estimate-handoff 9 remaining files) — preservation
   branches, left intact.
6. **Primary checkout residue** — the dirty App.tsx/routeGates/LoanDetails edits are a
   superseded draft of merged #596; `knowledge-base/sop/` untracked mirrors the sop
   snapshot branch. The owner should discard/keep knowingly.

## Traps this session hit (and the doc that predicted each)

- **Piped push output reports success** (#626's exact subject) — bit three times: a gh
  merge behind `tail`, a push chained with `; echo`, and a diagnostic `| tail` faking
  exit 0. Every push is now verified by `git ls-remote`, never exit codes.
- **The pre-push hook's log is per-step overwritten** — /tmp/prepush-gate.log holds only
  the LAST step's output; the verdict lines go to the push's stdout. Diagnose from the
  step list, not the log tail.
- **A stacked PR merges into its base** — the #615 incident above.
- **Ratchets ratchet down too** — #619 required LOWERING the inert-button baseline;
  #623/#605 required regenerating DESIGN_SYSTEM's generated table.

## Standing anti-drain rules now in effect

Drain before build at session start · "done" = merged + health-verified, never "PR opened"
· `baseRefName` checked before every merge · WIP cap 1 · no bare branches (first commit →
draft PR) · docs-only routine reports ride the fast lane · pushes verified by remote state.

## Post-drain inflow (processed under the standing rules, same session)

The four daily build lanes kept producing while the drain ran — which is the point of the
standing rules: **#628** (borrower-upload extraction persisted — the staff path had all four
persistence fixes, the borrower path none), **#629** (the #542 remainder, arrived via the
spawned task chip: funnel shows its NMLS id via the null-guarded single-source helper, VA
constants deduped against underwritingNuance's exports, footer respects the prelaunch gate —
and its −2 eager bytes self-tightened the bundle ratchet), **#635** (ci.yml comment truth:
branch protection was DELIBERATELY removed 2026-08-19 so work could continue through the
billing outage — restore it when Actions pays again), and **#632** (accelerator progress
column read everywhere, written nowhere) — all merged through the same bar.

A peer session pushed a dated **`backup/2026-08-20/` namespace (91 refs)** snapshotting the
pre-drain branch state, including every branch this session deleted — the tombstones now
have a second recovery path. That namespace is deliberate archival; it was left untouched
and is excluded from the working-branch counts.

## Final state

- **Open PRs: 4** — #609 (parked: its migration cannot auto-apply while Actions billing is
  down), #633 + #634 (rescue drafts for founder review), and whatever the next routine tick
  opens — vs. **19 at start**, with 21 PRs' content merged and deployed.
- **Working (non-backup) branches with unmerged content: ~12** — 2 parked decisions
  (design pivot, governance rewrite), 5 wip/ preservation snapshots, 2 draft-PR heads,
  #609's head, feat/lease-deletion (parked: lease-domain deletions are compliance-gated),
  claude/local-dev-corrections (3-file docs remainder, listed for one founder look).
- **Prod verified serving main's tip** at every checkpoint; final check after the last merge.
- **Eager bundle baseline corrected 523,893 → 523,897 in this PR:** the union of #629 (−2,
  self-tightened on its own tree) and #636 (+4, whose gate predated that tightening and
  whose manual bundle pass was skipped on a wrong lazy-only judgment) left main 4 bytes over
  a baseline no single PR ever saw. Measured on main's tip; the lesson (generated artifacts
  conflict on every concurrent merge — re-measure, never pick a side) is recorded in memory.
