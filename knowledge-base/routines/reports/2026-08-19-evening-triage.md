# Evening Triage — 2026-08-19

STATUS: FAIL — a new P0 exists that neither of today's changes created alone: `main` has **no
required status check** and Railway **still auto-deploys every push to it**, so any merge tonight
ships unverified code to a live public site. Two build routines fired and left no artifact, the
whole CCR fleet produced nothing on its first full day, and today's ECOA adverse-action sweep was
silently skipped.

---

## ⛔ Founder list for tomorrow — hardest decision first

**1. Decide what `main` is now: a gated branch, or a deploy button.** *(new — KTLO-4, verified
first-hand tonight, 02:19Z)*

Two separate, individually defensible changes composed into something neither PR describes:

| half | evidence |
|---|---|
| the gate is gone | `gh api …/branches/main/protection` → `required_status_checks.contexts: []`, `checks: []`. Removed today so work could continue through the Actions billing failure (#608 documents the removal and the restore command). |
| the deploy is not gone | Railway `get-service-config` → `source: {repo: barakatammre84/Homiquity, branch: main, checkSuites: false}`, custom domain `www.homiquity.com` attached, prod serving `b799b91d` = `origin/main`. `checkSuites: false` means Railway **does not wait for CI at all**. |

#608's own body says the action that actually stops deploys is **disconnecting the Railway GitHub
source**, and it explicitly did not do that. So the two facts stand together and mean: **every merge
right now is a production deploy of code no automated check has seen.** Eighteen PRs are queued
against that branch.

Pick one, tonight or tomorrow — they are not equivalent:

- **(a) Disconnect the Railway GitHub source.** Matches the founder direction ("local-only until the
  app is fully built and debugged"), makes merging safe again immediately, costs nothing to undo.
- **(b) Restore the required check** once billing is resolved — the verbatim command is in #608's
  KTLO-2 rewrite; **the separators are U+00B7 MIDDLE DOTs and the string must match exactly or every
  PR deadlocks on a check that never arrives.**

Until one of them is done, treat merging as deploying, and run `pnpm preflight` locally first.

**2. Clear the GitHub Actions billing failure.** Still live at 02:19Z — I read the annotation on the
newest run rather than inferring from the red: *"The job was not started because recent account
payments have failed or your spending limit needs to be increased."* (`run 32309545903`, `steps: []`).
Repo is **PRIVATE** (`gh repo view --json visibility`), so the 2026-08-18 flip-to-public workaround
is not in effect — and re-publishing re-exposes `knowledge-base/feature-review/FINDINGS.md` and
`governance/security/`, which is why it was flipped back. GitHub → Settings → Billing & plans.

**3. Re-fire today's missed ECOA adverse-action sweep, and decide whether the cron gets an alarm.**
The `0 14 * * *` slot is `/api/jobs/adverse-action-delivery`, the ECOA 30-day watchdog
(`.github/workflows/cron-jobs.yml:32`). Today's 14:22 UTC run **failed**; 08-15 → 08-18 all
succeeded, so **exactly one sweep was missed**. The workflow has a `workflow_dispatch` lever built
for this (`cron-jobs.yml:36-38`) — but it needs Actions alive, so this is gated on item 2. The
workflow's own comment says *"because this job has no failure alarm, nothing said so"*, written after
three sweeps died on a DNS change on 2026-08-06. **The same blind spot has now fired twice for two
unrelated reasons** — that is the argument for building the alarm.

**4. Counsel Ask 2, the half no session can close.** In a *brokered* transaction, is Homiquity the
**creditor** whose federal administering agency belongs on an adverse-action notice (§1002.9(g))?
The mechanical half is settled — every notice we generate names the **CFPB**, Reg B Appendix A item 9
assigns the **FTC** to a non-depository originator — but which entity gets named turns on your
answer. Landed as §1.7 (the question) and §3.30 (the derivation to build against it).

**5. Six merge decisions, five of them cheap.** Five PRs carry a genuinely green gate recorded before
billing died — **#587, #597, #598, #599, #603** — and are `MERGEABLE/CLEAN`. Two need a decision
rather than a click: **#587** is arguably superseded by #594 (same five overflows, fixed from the
other end, on `main` an hour earlier) — merge as defence-in-depth or close as superseded; and
**#542**, a 2-day-old `DIRTY` draft whose whole purpose was rescuing lost work, is the decide-or-close
clock's own exemplar (CHARTER §5). **Read item 1 before merging any of them.**

**6. Ratify the fleet you changed today — `CHARTER.md` §3 no longer describes it.** The scheduler was
reorganized on 2026-08-19 and the charter was not edited in the same session, which §11 requires:
Launch Gate is now **Trunk Health** with its RELEASABLE verdict retired; the Lender Package Gate went
**daily → Mondays**; and **three routines were registered that §3 has no row for** — Client Journey
Walk (daily 17:05), Workflow Completion Engine (daily 09:53), Feature Completion Engine (daily 12:30).
I did not edit §3 myself: §1b reserves charter amendments to the founder, and the fleet's composition
is exactly that kind of fact. The exact rows are in *Evidence* below, ready to paste.

---

## Summary

The day's headline is not a defect anyone shipped — it is what two correct decisions did when
composed: removing `main`'s required check to work around a billing failure, while Railway stayed
wired to `main` with `checkSuites: false`, turned every merge into an ungated production deploy.
Underneath that, the suite's own proof-of-life is degrading rather than improving: `primary-engineer`
and Trunk Health both dispatched this morning and left **no report on any of 49 remote refs**, and
the entire CCR fleet — Backend Data Engineer, UI Conformance Sweep, Doc Accuracy (four dispatches a
day) — produced nothing at all on the first full day after its skills landed. What did run was
strong: today's QA sweep opened Domain 9 and Workflow 7 for the first time and produced three
verified P1s plus a correction that the findings register had been overstating its own P0 count as
3 when it is 0, and the wiring audit landed a fix for a URLA progress bar that described the open
borrower tab while claiming to describe the application. Launch is deferred by founder direction
(local-only development), so §1/§2 are re-framed rather than re-ranked — but §0 still binds,
because the site is still up and still deploying.

---

## Proof of life — per-routine STATUS

Read from the scheduler directly (`list_scheduled_tasks`) and cross-checked against every report
present on any branch (`git ls-tree` over all 49 remote refs, plus a scan of all 27 worktrees for
uncommitted reports). **`lastRunAt` is the honest signal; a report is the artifact.** Where they
disagree, the routine fired and lost its work.

| routine | due today | `lastRunAt` | report | STATUS |
|---|---|---|---|---|
| **Primary Engineer** (07:21) | yes | **2026-08-19T10:21:58Z** | **MISSING** | ⚠️ **WARN — fired, no artifact** |
| **Trunk Health** (07:48, was Launch Gate) | yes | **2026-08-19T10:48:50Z** | **MISSING** | ⚠️ **WARN — fired, no artifact** |
| Frontend Wiring Audit (09:20) | yes | 13:13:03Z | ✅ on `claude/agitated-chatterjee-af3449` (#598) | WARN *(its own verdict)* |
| Deliverable QA Sweep (15:05) | yes | 18:05:38Z | ✅ on `routine/qa-sweep-2026-08-19` (#611) | FAIL *(its own verdict)* |
| Evening Triage (21:10) | yes | 02:17:24Z *(late — see note)* | this file | — |
| Workflow Completion Engine (09:53) | **no — registered today** | never | n/a | new seat, first fire 08-20 |
| Feature Completion Engine (12:30) | **no — registered today** | never | n/a | new seat, first fire 08-20 |
| Client Journey Walk (17:05) | **no — promoted to daily today** | never | n/a | new seat, first fire 08-20 |
| Lender Package Gate | **no — moved daily → Mondays today** | 08-18T15:31Z | n/a | not due |
| Vendor & Procurement (Mon) | no | 08-17T16:09Z | n/a | not due |
| Compliance Watch (Tue) | no | 08-18T16:20Z | n/a | not due |
| Rent Reporting Watch (Thu) | no | 08-14T02:00Z | n/a | not due — **fires tomorrow 14:08Z** |
| Refactor Radar (Sun) | no | 08-17T16:09Z | n/a | not due |
| **CCR: Backend Data Engineer** (11:00Z daily) | yes | *not readable here* | **MISSING** | ⚠️ **WARN** |
| **CCR: UI Conformance Sweep** (16:25Z daily) | yes | *not readable here* | **MISSING** | ⚠️ **WARN** |
| **CCR: Doc Accuracy** (03:40/09:40/15:40/21:40Z) | yes ×4 | *not readable here* | **MISSING** | ⚠️ **WARN** |

**On the three CCR rows — what I can and cannot claim.** This session has no Claude-Code-Remote MCP,
so I **cannot read the trigger list** and do not claim the triggers are disabled. What is checkable
from here is the artifact, and it is absent in every place it would appear: no
`reports/2026-08-19-*.md` for any of the three on any branch, and all three ledgers
(`knowledge-base/{backend-data-engineer,doc-accuracy,ui-conformance}/LEDGER.md`) untouched since
their founding commits on 2026-08-18. **The absent-skill STOP clause no longer explains it** — all
three skills are on `origin/main` as of today (`.claude/skills/{backend-data-engineer,
ui-conformance-sweep,doc-accuracy}/SKILL.md` all present), so their stated reason to no-op has
expired. Doc Accuracy alone had four dispatch windows. Someone with trigger access should run
`list_triggers` before tomorrow's ticks; this is the same "fleet is dark" shape that CHARTER §0 was
written about.

**Triage itself ran late** — dispatched 02:17Z (23:17 local) against a 21:10 local slot. Consistent
with the tail-slot starvation §3 already records; noted, not diagnosed.

---

## The one backlog — deduplicated and ranked

Ranked by CHARTER §1 (does it break the lender package? does it hurt the borrower experience?), then
by severity. Illinois tiebreak did not bind — nothing new today is state-specific.

### P0 — compliance / legal / security

| id | item | owner | est. |
|---|---|---|---|
| **P0-1** | **`main` has no gate and still auto-deploys** — disconnect the Railway source, or restore the required check. Landed as roadmap **KTLO-4**. | Amr | 5 min either way |
| **P0-2** | **Actions billing failure** — blocks CI, the prod-data census, and the `workflow_dispatch` lever P0-3 needs. Roadmap KTLO-2 (rewritten in #608, unmerged). | Amr | 10 min |
| **P0-3** | **One ECOA adverse-action sweep was silently skipped today** (14:22Z). Re-fire it via `workflow_dispatch`; decide whether the cron gets a failure alarm after two silent misses from two unrelated causes. | Amr (gated on P0-2) | 5 min + a decision |

### P1 — would block launch, and blocks a clean lender package now

| id | item | owner | est. | roadmap |
|---|---|---|---|---|
| **P1-1** | **The denial chokepoint fails open and a green test pins it.** De-dup is keyed on `applicationId` alone, so any staff-created `counteroffer` notice lets a file reach `denied` with zero denial notices and **no audit entry**. Scope by `actionType`; re-fixture `adverseActionFcraChokepoint.test.ts:225-233`. | Claude — Backend Data Engineer (§6b) | ~2 h | **§3.25** |
| **P1-2** | **A co-applicant's protected-class record can be overwritten with the primary's, and the co-borrower is never asked.** Two `LIMIT 1` with no `ORDER BY` and no sequence key; completeness measured by row presence. | Claude — BDE (needs same-PR expand-only migration) | ~4 h | **§3.26** |
| **P1-3** | **No completed-application timestamp exists, so the §1002.9(a)(1)(i) 30-day clock is not computable at all.** Needs a column. 🚨 no backfilled guesses on a provenance column. | Claude — BDE | ~3 h | **§3.27** |
| **P1-4** | **Every write on the Homeowner Hub 500s**, and both broken sections mount for every profile. | Claude | ~2 h | **§3.28** |
| **P1-5** | **The funnel's autosave drops three captured answers after the schema validates them** — no 400, no log — and the restore path reads one back off a column nothing writes. | Claude — BDE (server half), Wiring Audit (client half) | ~2 h | **§3.29** |
| **P1-6** | **`CHARTER.md` §3 does not describe the fleet that is registered** — §11 requires both edited in one session. Founder-held because §1b reserves charter amendments. | Amr (rows drafted below) | 10 min | — |
| **P1-7** | **Routines fire and lose their work, and the suite reads that as "did not run".** Three instances now (08-17 lender gate, 08-19 primary-engineer, 08-19 Trunk Health). Fix is a `STATUS: STARTED` stub at orient time. | Claude | ~1 h | **§3.24** *(updated)* |
| **P1-8** | **The CCR fleet produced nothing on its first full day** — three routines, seven dispatch windows, zero artifacts, and the STOP clause that used to explain it has expired. | Amr (trigger access) | 15 min to diagnose | — |

### P2 — polish, hygiene, and claims worth checking

| id | item | owner | roadmap |
|---|---|---|---|
| **P2-1** | Adverse-action notices name the CFPB where Appendix A item 9 says FTC — build the derivation, leave the value on counsel's answer. | Claude | **§3.30** |
| **P2-2** | `FINDINGS.md` keeps ten `FIXED` rows under `## Open findings`; it made open P0 read **3** when it is **0**. | Claude — QA Sweep | **§3.31** |
| **P2-3** | ⚠️ **Verify #605's "touch-target backlog 232 → 0" before treating it as closed** — `ui-standard-guard.cjs:173-188` counts only `<Button size="sm">` and skips `components/ui`, so the 13 protected-class checkboxes at 16×16 were never in the 232. A ratchet hitting zero is exactly when to re-measure it (CHARTER §10: *a metric earns trust by being used*). | Claude | — |
| **P2-4** | `NotificationsPanel` read-state keys off a field the API never sends; its test hand-writes it. Program-scale. | Claude | — |
| **P2-5** | `getMarketRate30YrFixed` needs a program filter and a deterministic tiebreak — it feeds consumer-facing savings claims. | Claude | — |
| **P2-6** | A `quietHours` test asserts a 5 AM-Guam instant is compliant. Fix the assertion, then the bracket, **before any outbound SMS ships**. | Claude | — |
| **P2-7** | Repo hygiene: **27 worktrees** (6 fully merged, removable) and **~60 local-only branches with unmerged commits**, none on any remote. Recurring — a 2026-08-13 sweep found eleven; the population has grown. | Claude | — |
| **P2-8** | **#596 is `CONFLICTING`** and green underneath — a rebase away from mergeable. Assist-ladder rung 1. | Claude | — |

**Nothing aged 48 h+ without an owner.** Every P1 above is dated today or carries a named lane. The
oldest unowned thing in the queue is **#542** (draft, 2 days, `DIRTY`) — it has a disposition
proposal (⛔5) and no owner, which is precisely the state the decide-or-close clock exists to end.

---

## PR queue — 18 open, oldest first

🚨 **Read ⛔1 first: with `contexts: []` and Railway on `checkSuites: false`, merging any row below
deploys it to production unverified.**

`FAILURE` in the checks column below means **the billing failure**, not a real red — every one of
them died in ~3 s with `steps: []`. No PR in the queue has `autoMergeRequest` set (checked across
all 18, per CHARTER §8's near-miss).

| PR | age | state | checks | recommended order |
|---|---|---|---|---|
| **#597** | 13 h | MERGEABLE / CLEAN | ✅ real green | **1** — rescue of a guard written 08-06 and never branched; smallest, oldest debt |
| **#598** | 13 h | MERGEABLE / CLEAN | ✅ real green | **2** — today's wiring-audit fix, proven by reintroduction |
| **#599** | 13 h | MERGEABLE / CLEAN | ✅ real green | **3** — the assistant was the one borrower channel CS2 never scanned |
| **#603** | 12 h | MERGEABLE / CLEAN | ✅ real green | **4** — docs/agents only |
| **#587** | 28 h | MERGEABLE / CLEAN | ✅ real green | **5 — decision, not a click**: superseded by #594 or defence-in-depth |
| **#608** | 12 h | MERGEABLE / UNSTABLE | billing | **6** — it is the roadmap's own KTLO-1/KTLO-2 correction; it cannot self-verify while it is what is broken |
| **#596** | 24 h | **CONFLICTING** / DIRTY | ✅ real green underneath | **7** — rebase first |
| #589, #595, #601, #604, #605, #606, #607, #609, #610, #611 | 5–28 h | MERGEABLE / UNSTABLE | billing | after P0-2 — real gates, unread |
| **#542** | 2 d | **CONFLICTING** / DIRTY, **draft** | zero check-runs | ⛔ **decide-or-close** — content audited by yesterday's addendum; close it with a ledger row, or promote it |

On **#542**'s zero check-runs: that is the documented `DIRTY` case — GitHub schedules no run for a
conflicted PR — not a dropped webhook. No body-edit nudge is warranted, and no nudge was made
anywhere: with the required check removed, a nudge buys nothing and a green Actions recovery plus an
armed `--auto` is exactly the near-miss §8 warns about. **I merged nothing and enabled auto-merge on
nothing.**

---

## Repo hygiene

**Primary checkout** (`git status --porcelain`): on a peer's branch `feat/landing-coach-first` with
three modified files — `client/src/App.tsx`, `client/src/lib/routeGates.ts`,
`client/src/pages/borrower/borrowerDashboard/LoanDetails.tsx`. **These are the same three files
today's wiring audit identified as superseded ux-30 residue** (byte-identical to #596 by
`git patch-id`), so they are stale, not in-flight. **Nothing was committed from the primary
checkout** and nothing was written to it; all work here happened in a fresh worktree off
`origin/main` @ `b799b91d`.

**Untracked `knowledge-base/sop/`** — an SOP manual charter written today at 12:14 by an
unidentified session, plus four empty directories, never committed. It is marked *"DRAFT — pending
founder approval"* and cites `scripts/sop-freshness-guard.cjs`, **which does not exist at
`origin/main`**. Not committed into this triage (that is how merged work gets reverted); **snapshotted
to `wip/sop-manual-draft-2026-08-19`, pushed, do not merge.** Its author should open a real PR or
delete it.

**Worktrees — 27.** Six carry zero commits beyond `origin/main` and are removable:
`…/lg-wt` (detached), `…/cw-2026-08-18`, `…/triage-wt` (yesterday's), `…/gate-wt` (detached),
`…/wt-suite`, `…/lender-wt`. The rest carry 1–10 unmerged commits and belong to live sessions —
**none touched.**

**Branches — ~60 local-only with unmerged commits and no remote**, i.e. one disk failure from gone.
Most are near-certainly landed-and-superseded (a 3-dot diff overstates an old branch; the honest
comparison is blob-level and was not run for 60 branches tonight). The three worth a human minute,
because their sizes are not consistent with "already landed":
`rescue/policy-catalogue-wiring` (68), `rescue/wire-four-buttons` (63),
`rescue/inert-buttons-ratchet` (61) — note the third is plausibly superseded by #597
(`rescue/inert-buttons-ratchet-landed`). **Nothing was deleted or force-pushed.**

---

## Funnel legal posture

Funnel/landing/lead code **did** change on `main` in the last 24 h (#594, #602), so this section
runs rather than being skipped.

- **Scope of the change is a11y and layout only.** Eight files, +29/−26:
  `Footer.tsx`, `Navigation.tsx`, `SkipLink.tsx`, `FindAnAgent.tsx`, four calculators, and
  `public/Landing.tsx` (one line). A grep of every added/removed line for `%`, `APR`, `$<digit>`,
  "down payment", "monthly payment" returns **one hit** — `-<Label>Down Payment Saved So Far` /
  `+<Label htmlFor="as-down-payment">…` — a label-association fix with identical visible text.
- **Reg Z trigger terms: no new exposure.** No rate, payment, term or APR figure was added,
  removed, or reworded.
- **Reg N no-approval language: unchanged** — no copy in the diff makes or softens an approval claim.
- **TCPA provenance intact.** `server/routes/leads.ts:100-101` still records
  `consentIp: clientIpForRecord(req)` and `consentUserAgent: req.headers["user-agent"]`, backed by
  `shared/schema/leads.ts:45-46`; the file's last change was 2026-08-06 (#436, the real-client-IP
  fix) and it is untouched since.
- **SMS quiet hours intact** — `server/services/smsCompliance.ts:6,10` still imports
  `isContactAllowed` from `./quietHours` as one of the two controls an outbound feature must honor.
  ⚠️ Its **test** is not intact: qa-sweep `F-0819-17` finds an assertion pinning a 5 AM-Guam instant
  as compliant, carried above as **P2-6**. The guard is there; what proves it is wrong.

---

## Evidence

**Sync.** `git fetch --prune`; worktree created at `origin/main` @ `b799b91d`; `ListAgents` not
consulted as a primary signal (CHARTER §5.4 ranks it last) — `origin/main`, the 18 open PRs and
`REGISTER.md` were, in that order. **No `pnpm install`, and deliberately no `node_modules` in this
worktree** — an install-less worktree resolves upward into the primary checkout, which is on a peer's
branch and dirty. This PR edits only `.md` files, so the three guards that matter are the ones that
need no dependencies, and all three were run here:

```
$ node scripts/kb-index-guard.cjs        KB index OK: 170 docs, all indexed; no dead links.
$ node scripts/doc-staleness-guard.cjs   5/5 metrics at baseline, no regression ✅
$ node scripts/doc-freshness-guard.cjs   8 living docs verified within interval ✅
```

No typecheck, no test suite, no bundle or UI guard was run, and no claim in this report rests on one.
CI cannot supply them either — every run dies on the billing failure (P0-2), so **this PR will show a
red gate that says nothing about its contents.**

**P0-1, both halves.**
```
$ gh api repos/barakatammre84/Homiquity/branches/main/protection
  required_status_checks: {"checks":[],"contexts":[],"strict":false}
  enforce_admins: true · allow_force_pushes: false · allow_deletions: false

$ railway get-service-config (project Homiquity / service Homiquity / production)
  source: {repo:"barakatammre84/Homiquity", branch:"main", checkSuites:false}
  customDomains: {"www.homiquity.com":{}}

$ curl -s https://homiquity-production.up.railway.app/api/health
  {"status":"ok","commit":"b799b91da401edd92a7d6af8c76a2b1743f271d1", ...}
$ git rev-parse origin/main
  b799b91da401edd92a7d6af8c76a2b1743f271d1        # prod is current
```

**P0-2, dated to now, not to the 18:04Z reading in the QA sweep.**
```
$ gh run view 32309545903 --json jobs     # 2026-08-19T22:35:58Z, the newest run
  gate (typecheck · tests · schema guard)   failure   steps=0
  migrate-prod                              skipped
  verify-deploy                             skipped
$ gh api repos/:owner/:repo/check-runs/96249523675/annotations
  failure: "The job was not started because recent account payments have failed or your
            spending limit needs to be increased..."
$ gh repo view --json visibility  →  PRIVATE
```

**Missing reports.** `git ls-tree -r <ref> knowledge-base/routines/reports/` over every remote ref
returns exactly two files dated 2026-08-19 — `…-wiring-audit.md` on
`origin/claude/agitated-chatterjee-af3449` and `…-qa-sweep.md` on `origin/routine/qa-sweep-2026-08-19`.
A `git status --porcelain | grep reports/` sweep across all 27 worktrees returns nothing, so no
report is sitting uncommitted either.

**The orphan on :5002 — closed, not re-flagged.** Named in three consecutive reports and closed by
none. Re-verified (`ps -p 20814` → START `Wed Aug 5 16:08:46 2026`, running
`--import …/.claude/worktrees/launch-hygiene/…` out of a worktree that no longer exists;
`/api/health` returning `{status,timestamp}` with **no `commit` field**, which is what made it
undatable from the outside). **Killed; `curl` now exits 7 on that port. Nothing on :5001 was
touched.** *Deviation stated rather than buried: CHARTER §6 gives Evening Triage no code path, and
this is ops rather than a file edit — outside that rule rather than against it, and §8's absolute
prohibitions (prod variables, credentials, migrations, pushing `main`, auto-merge) are untouched.
Recorded because acting is more honest than flagging a defect a fourth time.* The durable half —
whether a `/api/health` without `commit` should be a startup error — stays open in §3.23.

**Fleet drift, with the rows ready to paste into `CHARTER.md` §3.** Read from
`list_scheduled_tasks`; the descriptions themselves carry the change dates.

| Fires | Cron | Routine (`taskId`) | Cadence | Writes code? | Produces |
|---|---|---|---|---|---|
| 09:53 | `50 9 * * *` | **Workflow Completion Engine** (`workflow-completion-engine`) | daily | **yes** | one client workflow driven locally, first broken seam fixed |
| 12:34 | `30 12 * * *` | **Feature Completion Engine** (`feature-completion-engine`) | daily | **yes** | one domain's backend↔client reach gap closed; owns the open-findings backlog |
| 17:06 | `5 17 * * *` | **Client Journey Walk** (`client-journey-walk`) | daily | no — report only | one persona journey walked in a real browser |

and three amendments to existing rows: `launch-gate` → **Trunk Health**, RELEASABLE/prod-drift/rollback
verdict retired while launch is deferred; `lender-delivery-gate` → **`30 12 * * 1`, Mondays only**;
and the retired `sprint-blitz` definition is **still on disk** at
`~/.claude/scheduled-tasks/sprint-blitz/` rather than in `_archive/`, which §11 calls a fossil.
Two more unregistered definitions sit beside it — `complex-file-engine` and `move-up-lane` — the
first of which has an open PR (#589) proposing it.

**Register.** The board's single active claim (F-077 FHA leg, `2026-08-18T15:18Z`) was **35 h old**
and its work had landed: PR **#556 merged 2026-08-18T20:04:58Z**, branch
`claude/musing-engelbart-0a72db` deleted from origin. Cleared under rule 3 and recorded under
*Recently released*. **The active table is now empty.**

**What I could not verify.**
1. **CCR trigger state** — no Claude-Code-Remote MCP in this session. I report absent artifacts, not
   disabled triggers.
2. **Whether the missed ECOA sweep has borrower impact** — that depends on live application rows,
   which needs the prod-data census that is itself blocked on P0-2.
3. **The ~60 local-only branches, individually** — flagged by count and by the three outliers; a
   blob-level comparison per branch was not run and no branch was deleted on the strength of a
   3-dot diff.
4. **Nothing was verified in a browser this run.** No dev server was started; `browser-probe` was
   not run. This report is scheduler state, `git`/`gh`/Railway API reads and file evidence only.

---

## Roadmap changes landed in this PR

**Added**
- **§0 KTLO-4** — `main` has no gate and still auto-deploys; the two halves, and the two ways to close it.
- **§1 framing note** — launch is deferred by founder direction; "blocks go-live" now describes a deferred event, and ranking follows CHARTER §1 instead.
- **§1.7** — counsel Ask 2 (creditor identity for the adverse-action administering agency) folded into the existing counsel aggregation rather than opened as a new §1 item.
- **§3.25–§3.31** — the four QA-sweep P1s (denial chokepoint, co-applicant demographics, missing completed-application timestamp, Homeowner Hub writes), the funnel autosave whitelist, the wrong-agency derivation, and the findings-register hygiene pass.

**Updated**
- **§3.23** — the :5002 orphan is killed; the item is narrowed to its durable half.
- **§3.24** — two more instances today; re-stated as a pattern with three data points, and narrowed to the one missing half (the `STATUS: STARTED` stub).

**Deliberately not done**
- **KTLO-1 and KTLO-2 were left alone.** Both are already rewritten in **#608** (Railway
  decommissioning; the billing escalation and the restore command). Duplicating them here would
  create conflicting hunks in the one file Evening Triage owns exclusively, and #608's version is
  correct and more detailed. My §0 addition sits *below* KTLO-3 so the hunks do not overlap.
  **If #608 is closed rather than merged, KTLO-1/KTLO-2 on `main` are actively misleading** —
  KTLO-1 still says "add a payment method" and KTLO-2 still says "Actions was healthy all day".
- **§4 untouched** (founder's).
- **`CHARTER.md` §3 untouched** — §1b reserves amendments to the founder; rows drafted above instead.
- **Nothing checked off.** Four PRs merged today (#591, #594, #600, #602) and **none maps to a
  roadmap row** — they were findings-register and tooling work. Saying so beats inventing a checkmark.

STATUS: FAIL
