# Evening Triage — 2026-08-22

**STATUS: WARN** — `main` is green and prod is genuinely current for the first time in days, and
27 PRs landed in 24 h; but **11 of the 15 local routines are paused, three of the five that ran
today left no report anywhere, and the whole of 2026-08-21 produced not one artifact from three
dispatched routines.** The suite is building faster than it can prove it built.

---

## ⛔ Founder list for tomorrow — hardest decision first

1. **⛔ The repo is public, and that is the only reason CI works.** Probed 2026-08-23T02:37Z:
   `visibility: "public"`, 8 consecutive green runs on `main`, merges flowing. Public visibility is
   what makes Actions free — **the underlying payment failure has never been observed resolved**,
   and the 2026-08-19 flip-to-private re-broke every merge within minutes. So today's throughput is
   renting a security posture. Currently world-readable: `knowledge-base/feature-review/FINDINGS.md`
   (255 open findings, including live P0/P1 defect detail), `governance/security/`, and ~19 MB of
   re-hosted Fannie/NMLS PDFs — with **secret scanning and push protection disabled** and `main`
   unprotected. **Decide both halves together:** pay/raise the Actions limit so visibility stops
   being load-bearing, and then choose the visibility you actually want. Roadmap KTLO-2.
2. **⛔ Railway: decommission, or stop calling it decommissioned.** The 2026-08-19 direction to take
   production down never executed. Railway has been building and deploying every merge throughout —
   `/api/health` reads `commit: b30eb53a…`, equal to `origin/main`, at 02:39Z tonight. Acting on the
   stale premise is what caused the 35-minute total-auth outage on 2026-08-22 (migration 0057 never
   applied). CI's `migrate-prod` and `verify-deploy` were re-armed the same day (#669). **The
   blocker you set is gone:** the read-only prod-DB census was waiting on CI, and CI is alive.
   Run the census, then decide. Roadmap KTLO-1.
3. **⛔ Restore the required `gate` check — it is now free and it is one command.** `main` still
   reads `required_status_checks.contexts: []`, so every green run today was *voluntary*, and
   `enforce_admins: true` over zero checks binds admins to nothing. It was removed on 2026-08-19
   because Actions was dead; Actions is not dead. Command and its U+00B7 separators are in KTLO-2.
   Roadmap KTLO-4.
4. **⛔ The build fleet is dark. 11 of 15 local routines are `enabled: false`**, paused
   2026-08-22 for laptop capacity (8 GB, load 40, swap 5.2/6 GB). Still enabled: evening-triage,
   plus three weekly/monthly seats. **Primary Engineer, Capture Path Engineer, Workflow Completion,
   Feature Completion, Client Journey Walk, QA Sweep, Doc Accuracy, App Walker and Refactor Radar
   are all off.** Tonight's backlog is what four hours of an *unpaused* fleet produced; from
   tomorrow the queue only grows from human sessions. The founder-directive standard ("every
   feature best-in-class before launch") has no engine behind it until these move to cloud routines
   or the laptop is relieved. **This is a capacity decision, not an engineering one.**
5. **⛔ 32 open PRs, and 20 of them were opened tonight in one rescue sweep.** #674–#689 are
   snapshots of orphaned branches, all now `CONFLICTING`; #633/#634/#641/#647/#648/#650 are past the
   7-day line. Per CHARTER §5's decide-or-close clock these need dispositions, and **a routine may
   propose one but never execute it**. My recommended dispositions are in the PR-queue table below.
6. **⛔ `docs/fannie-mae/README.md` tells every session the PDFs are readable, and they are not** —
   `pdftoppm` is absent, so the documented path fails with an install error and a session concludes
   the Fannie corpus is unavailable while it sits on disk. `docs/**` is off limits to every routine,
   so this needs your hand or your authorization. Replacement wording is written out verbatim in
   [the doc-accuracy report](2026-08-22-doc-accuracy.md) §1. Roadmap §3.38. ~8 lines.
7. **⛔ `/apply` promises "a verified pre-approval letter in about 3 minutes."** The product issues a
   **pre-qualification** letter in three minutes and correctly refuses a pre-approval until documents
   are verified. The engine is right; the promise is not. Whether the copy moves or the positioning
   does is yours. Roadmap §3.37.

---

## Summary

`main` is green (8/8 runs today) and prod is serving `origin/main` exactly — the first clean
deploy-proof in this report series for several days — and 27 PRs merged in the 24 h to
2026-08-23T02:00Z, including the re-arming of `migrate-prod`/`verify-deploy` (#669) after the
paused-job outage. The day's real product win is #667: the funnel's server-draft round trip now
carries all three answers it was silently dropping at both ends, verified in the code on both
sides, which closes roadmap §3.29. Against that, the suite's *evidence* discipline failed harder
than it has all week — three routines dispatched today and left no report on any ref, two more
wrote genuinely excellent reports onto **unpushed local branches** where no peer could see them,
and 2026-08-21 produced nothing at all from three dispatches. And the fleet that generates this
work is now 11/15 paused, so tomorrow's queue has almost no producer behind it.

---

## Proof of life — per-routine STATUS

Expected set derived from the live scheduler (`list_scheduled_tasks`, read 2026-08-23T02:37Z),
not from CHARTER §3, which predates the 2026-08-19 rewrite and the 2026-08-22 pause.

| routine | dispatched (`lastRunAt`) | report on a ref? | STATUS |
|---|---|---|---|
| Primary Engineer | **2026-08-22T10:21:33Z** | **none, any ref** | ⛔ **WARN — silent** |
| Trunk Health (`launch-gate`) | **2026-08-22T10:48:25Z** | **none, any ref** | ⛔ **WARN — silent** |
| Capture Path Engineer (wiring audit) | 2026-08-22T12:20:21Z | yes — **unpushed** on `claude/musing-kepler-ca48fc` | ⚠️ WARN — invisible; **recovered tonight** |
| Workflow Completion Engine | **2026-08-22T14:19:33Z** | **none, any ref** | ⛔ **WARN — silent** |
| Feature Completion Engine | 2026-08-22T15:36:11Z | yes — [PR #657](https://github.com/barakatammre84/Homiquity/pull/657) | ✅ OK |
| Doc Accuracy | ran today (report dated 2026-08-22) | yes — [PR #658](https://github.com/barakatammre84/Homiquity/pull/658) | ✅ WARN (own verdict) |
| Client Journey Walk | ran today (report dated 2026-08-22) | yes — **unpushed** on `routine/journey-walk-2026-08-22` | ⚠️ WARN — invisible; **recovered tonight** |
| Deliverable QA Sweep | 2026-08-21T18:05:15Z | **none for 08-21, any ref** | ⛔ **WARN — silent** |
| Staff Journey Walk | never fired (registered + paused same hour) | n/a | — |
| Lender Package Gate · Refactor Radar · App Walker | paused; not due | n/a | — |
| Vendor & Platform Risk (monthly, 1st) · Compliance Watch (Tue) · Rent Reporting Watch (Thu) | not due Saturday | n/a | — |

**The whole of 2026-08-21 is empty.** `git ls-tree` over every remote **and** local ref finds no
`2026-08-21-*` report of any kind, while the scheduler records three dispatches that day
(qa-sweep 18:05Z, journey-walk 20:06Z, doc-accuracy 22:32Z). Per CHARTER §3 a gap can mean "the
laptop was shut" — **it does not here**: `lastRunAt` proves all three were dispatched. That is six
silent losses in two days, and it is roadmap §3.24's fourth through sixth data points.

**Recovered by this run** (CHARTER §9 lets Triage bundle the day's reports): both unpushed reports
are landed on this branch, and all five local-only branches are now pushed to `origin` for
provenance — `routine/journey-walk-2026-08-22`, `claude/musing-kepler-ca48fc`,
`docs/sop-a3-3-01-verified`, `sg650-renumber`, `feat/homi-launcher`. Nothing was force-pushed,
nothing was deleted, no peer PR was touched.

---

## The one backlog — deduplicated, ranked by the founder directive

Ranked by the 2026-08-19 directive (1: a client cannot complete something · 2: completes but the
data is wrong · 3: completes but is not best-in-class), then by severity.

### P0 — none new

No new P0 tonight. `FINDINGS.md`'s open-P0 count still *reads* 3 and is **actually 0** — the three
are fixed rows filed under the wrong heading (see P2-1).

### P1

| # | item | category | owner | est. |
|---|---|---|---|---|
| P1-1 | **Three affordability answers in one session, ending in "Congratulations! You're pre-approved for $607,000"** — 46% above the first quote, and the figure is a max *purchase price* at the 43% DTI cap, labelled a *loan amount*. Four rate assumptions in play. Roadmap **§3.32** | 2 (data wrong) | Claude — Primary Engineer | 1 day, 3 separable parts |
| P1-2 | **The `aspiring_owner → active_buyer` promotion never reaches the nav** — sidebar still says "Aspiring Owner" and offers "Get Pre-Approved" on the client's own pre-approval page. One line: invalidate `["/api/auth/user"]` in `PreApproval.tsx:204-207`. Roadmap **§3.33** | 1 (dead end) | Claude — Capture Path | 30 min + test |
| P1-3 | **"Sign Required Disclosures" can never be cleared** — `dashboard.ts:306` requires two consent types no active template can satisfy; the count also disagrees with `/e-consent`. Roadmap **§3.34** | 1 (gate never opens) | Claude — Workflow Completion | 3 h incl. the invariant test |
| P1-4 | **J-0820-01: every `/e-consent` signature lands with `applicationId = null`**, so the borrower's Loan Estimate stays locked behind a consent the product says is complete — and re-signing writes a *second*, orphaned row on a hash-tamper-evident record. Not a blanket fix (`consentGate.ts:38-49` deliberately supports null-application rows). Already registered; **unowned since 2026-08-20 — 3 days** | 1 (gate never opens) | Claude — Backend Data Engineer lane | 1 day |
| P1-5 | **F-0818-06: the anti-steering consent card is gated only on `!steeringAcknowledged`**, never on whether any options exist — so a borrower can sign *"these loan options were presented to you"* on a page showing none, permanently unlocking rate lock (`pricing.ts:624-637`). Reg Z §1026.36(e)(2) **flagged, not ruled**. Raised again by feature-completion today; wants its own reviewed PR | 2 (consent misattributed) | Claude, then human review | 4 h + §9 review |
| P1-6 | **The build fleet is 11/15 paused** — capacity, not code | — | **Amr** | decision |

### P2

| # | item | category | owner | est. |
|---|---|---|---|---|
| P2-1 | **`FINDINGS.md` overstates its own backlog — now 18 fixed-marked rows under `## Open findings`, up from the ten §3.31 recorded.** 255 open rows vs 36 closed; open P0 reads 3, is 0. Roadmap **§3.31** | 3 | Claude — QA Sweep owns the register | 1 h |
| P2-2 | **Two disclosure surfaces discard the server's honest 409/422 and say "Please try again"** — telling the borrower to retry something only staff can unblock. Roadmap **§3.35** | 3 | Claude — Feature Completion | 2 h |
| P2-3 | **Self-reported debts attributed to a credit check that never ran** (`ApplicationSummary.tsx:164` hard-codes "From your soft credit check"). FCRA-flagged, not ruled. Roadmap **§3.36** | 2 | Claude — Feature Completion | 2 h |
| P2-4 | **`docs/fannie-mae/README.md`'s PDF-reading recipe is wrong** and stops sessions on a present document. Roadmap **§3.38** | — (blocks compliance work) | **Amr** (or an authorization) | 15 min |
| P2-5 | **Every routine must push its report branch before it exits.** Three of the five producing routines today failed this; two wrote their whole run onto a laptop-only branch. Roadmap **§3.24**, fix (b) | — | Claude — routine `SKILL.md` edits | 1 h |
| P2-6 | **`/apply`'s three-minute "verified pre-approval letter" promise.** Roadmap **§3.37** | 3 (promise the product cannot keep) | **Amr** decides, then Claude | 10 min after the call |

### P3

| # | item | owner | est. |
|---|---|---|---|
| P3-1 | `ux-51` — five sub-44px controls in the Landing's `BuyingPowerEstimator` compact branch (`:59-61`), invisible to `guard:ui` (no layout engine). Roadmap §3.37 | Claude | 30 min |
| P3-2 | `ux-52` — `/signup` links to neither the Terms of Use nor the Privacy Policy. Roadmap §3.37 | Claude | 15 min |
| P3-3 | Dead paths in `FINDINGS.md` and this roadmap, plus folding the dead-path sweep into `doc-staleness-guard.cjs`. Roadmap **§3.39** | Claude | 3 h |

**Deduplicated away, deliberately:** the Client Journey Walk filed `J-0822-01…06` for six defects
`FINDINGS.md` already carries as `J-0820-02/03/04/05/08/11` — the same journey walked twice, two
days apart. Those six ids were **not** minted; a dedup note mapping each one is now at the head of
`## Open findings`, and only `ux-51`/`ux-52` were added. This is exactly the near-duplicate
accumulation CHARTER §4 gives Triage the roadmap for.

**Also not re-reported:** the wiring audit's ⛔ #1 (the `UPDATABLE_COLUMNS` write-drop) was **fixed
while the report was being written** — #667, merged 2026-08-22T23:43Z. Dated before reporting, per
CHARTER §10.

---

## Roadmap changes landed in this PR

| section | change |
|---|---|
| **KTLO-1** | Rewritten. The decommission never happened; prod is current at `b30eb53a`; the pause caused the 35-min auth outage; `migrate-prod`/`verify-deploy` re-armed by #669; **the prod-DB census is unblocked** because its blocker (dead CI) is gone. Old text kept for provenance. |
| **KTLO-2** | Rewritten. Actions is alive **because the repo is public**, not because the bill was paid; 8 green runs today; flipping private re-breaks everything; the security exposure that buys it is named. Old escalation kept for provenance. |
| **KTLO-4** | Re-verified and re-scoped: CI now runs and passes on every merge, but `contexts: []` makes that voluntary. Restoring the check is now free. Prod sha refreshed `b799b91d` → `b30eb53a`. |
| **§3.24** | Fourth/fifth/sixth data points added, and a **second** fix: routines must push their report branch before exiting. |
| **§3.29** | **Closed and deleted**, appended to the archive ledger with both halves verified in the code on `b30eb53a`. |
| **§3.31** | Re-measured: ten fixed-marked rows → **18**; 255 open vs 36 closed. |
| **§3.32 – §3.39** | **New** — six journey-walk items and two doc-accuracy items, each with a file, an expected behaviour, and an owner lane. |
| §4 | **Untouched** — founder's. |

---

## Register hygiene (CHARTER §5)

One active claim: **"founder-directed drain session 2026-08-22"** — the merge queue itself, branch
`chore/claim-drain-lane-0822`, claimed **2026-08-22T18:45Z (~8 h)**. **Under 24 h ⇒ live, not
stale**, and it has merged work behind it (#662–#671), so `main` outranks the board in its favour.
Left in place. Nothing else is claimed.

One invisible claim worth naming: the Capture Path Engineer wrote a REGISTER row (`7d4a8a63`,
"claim the pre-approval server-draft restore mapping") **and never pushed it**, so for the whole
run the lock said nobody was working on a file two sessions were. That is the same defect as the
missing reports, on the file whose only job is to be seen.

---

## Repo hygiene

**(a) Primary checkout** (`git status --porcelain`): three modified files —
`client/src/App.tsx`, `client/src/lib/routeGates.ts`,
`client/src/pages/borrower/borrowerDashboard/LoanDetails.tsx`, 52 lines — plus 10 untracked
`.claude/agents/journey-walker-*.md` and 3 untracked `.claude/skills/` directories.

**All of it is stale residue. Do not commit any of it.** Verified against `origin/main`
@ `b30eb53a`: every one of the 10 agent files and all 3 skill directories are **already tracked on
`main`** (they land via #651/#661) — they read as untracked only because the checkout sits on
`feat/landing-coach-first`, ~42 commits behind. And the three modified files are the **ux-30 fix,
which already merged in a different shape**: `routeGates.ts:69` on `main` has the `disclosure` gate,
and `App.tsx:475-481` gates `/loan-estimate/:id` with it **inlined** rather than through the
`DisclosurePage` wrapper the working copy adds. Committing the working copy would re-add a wrapper
`main` deliberately does not have. Nothing here needs a `wip/*` snapshot; it needs discarding, which
is the founder's call on their own checkout, not mine.

**(b) Worktrees and branches.** 30 worktrees. Local-only branches carrying commits `main` does not
have — one disk failure from gone — were **pushed to `origin` tonight**:

| branch | ahead | disposition |
|---|---|---|
| `routine/journey-walk-2026-08-22` | 1 | **pushed**; report landed here. Branch removable once this PR merges |
| `claude/musing-kepler-ca48fc` | 3 | **pushed**; report landed here, code half superseded by #667. Removable once this PR merges |
| `sg650-renumber` | 10 | **pushed — this one matters.** It is #650's branch with `main` merged in and the colliding migration renumbered, i.e. the fix for #650's `CONFLICTING` state. #650 has had **two** sessions attached; do not rebase it blind |
| `docs/sop-a3-3-01-verified` | 1 | **pushed**; no PR, unowned. Needs a disposition |
| `feat/homi-launcher` | 2 | **pushed**; content landed as #655/#659. Verify, then removable |

Removable (fully merged, squash residue): `fix/funnel-draft-roundtrip` (→ #666/#667),
`fix/restore-migrate-prod-and-verify-deploy` (→ #669),
`ci/skip-runs-that-cannot-change-a-verdict` (→ #656), `fix/ecoa-intake-guard-timeout` (→ #664),
`feat/homi-knows-its-own-name` (→ #655), `fix/extraction-persistence-test-race` (→ #649),
`docs/handoff-corpus-2026-08-22` (→ #673). **I deleted none of them** — deleting a peer's worktree
is not a routine's call, and several still have sessions in the session list.

---

## PR queue — 32 open, oldest first

**No `autoMergeRequest` is armed anywhere in the queue** (checked across all 32) — nothing will
fire on its own. **I merge nothing and arm nothing.**

| PR | age | state | checks | recommended disposition |
|---|---|---|---|---|
| #633, #634, #641 | 2 d | draft, CONFLICTING | — | **> 72 h drafts.** Promote or propose closure *with content recorded first*. #641 is a routine report — its content belongs on `main` either way |
| #647 | 2 d | ready, DIRTY | 1 failing | doc-accuracy 2026-08-20. Update branch, re-run, then review — it carries DA-0820-10, the same branch-protection escalation as tonight's item 3 |
| #648 | 2 d | ready, CONFLICTING | 1 failing | "every talk-to-Homi CTA sent signed-out visitors to a login wall" — a real client dead end sitting 2 days. **Highest-value ready PR in the queue** |
| #650 | 2 d | ready, CONFLICTING | **0 check-runs** | Selling Guide as source of truth. `sg650-renumber` (now pushed) is the prepared conflict fix. **Two sessions have been attached to this PR — do not `update-branch` blind** |
| #653 | 0 d | draft | — | author-marked ⛔ DO NOT MERGE (regressions found). Leave |
| #654 | 0 d | ready, CONFLICTING | **0 check-runs** | Selling Guide constitution, 27 commits. Sequence **after** #650 |
| #657 | 0 d | ready, CONFLICTING | 1 failing | Feature Completion's own PR — the offers surface explaining why it cannot price. Update branch, re-run |
| #658 | 0 d | ready, UNSTABLE | 1 failing | Doc Accuracy 2026-08-22. Carries the ⛔ D11 skill-pointer edit; may conflict with #654 |
| #668, #670 | 0 d | ready, MERGEABLE/CLEAN | green | **Review these first.** #670 is the vitest under-collection guard — it stops `pnpm test` exiting 0 on fewer files than exist, which is a control every other lane depends on |
| #674–#689 | 0 d | 16 drafts, all CONFLICTING | — | Tonight's orphan-rescue sweep. **This is the decide-or-close list**: each one is either promoted with an owner or closed with its content recorded. Sixteen unowned drafts is a graveyard forming, not a queue |
| #680 | 0 d | ready, MERGEABLE | green (9) | "Three defects found by using the app rather than measuring it" — review |
| #691, #694, #695, #697 | 0 d | ready | green (#695 DIRTY) | Tonight's docs/brand work. #695 needs a branch update first |

**Two PRs have zero check-runs (#650, #654).** Normally that is a dropped webhook and a one-line
body edit re-triggers CI. **I did not nudge either**: both are `CONFLICTING`, so a run against a
branch that cannot merge proves nothing, and #650 has had live sessions attached. Rebase first,
then nudge — and remember a body edit is *required* rather than a re-run whenever the §9 security
gate is involved, because `guard:security` reads the body from the event payload.

---

## Funnel legal posture (CHARTER step 8)

Funnel/landing code **did** change in the last 24 h (Landing, SelfEmployed, FirstTimeBuyer, VALoans,
the Homi launcher, the illustration pipeline), so the check ran rather than being skipped.

| control | finding |
|---|---|
| TCPA lead provenance | **Intact.** `server/routes/leads.ts:100-101` records `consentIp: clientIpForRecord(req)` and `consentUserAgent`; the file is unchanged since `7e60f4d4` (2026-08-06) |
| Reg Z trigger terms | **No new exposure.** Grepping every `+` line added to `client/src/pages/public/` in 24 h for rates, APRs, payments or down-payment figures returns **zero** matches — the changes are imagery and layout |
| Reg N no-approval | **Holds.** The only approval-adjacent copy added is `ApprovalStrength.tsx`'s *"estimates aren't offers or approvals, and final terms come from underwriting"* — a disclaimer, not a promise |
| SMS compliance / quiet hours | **Intact and untouched.** `server/services/smsCompliance.ts:10` still imports `isContactAllowed` from `./quietHours`; no SMS file changed in 24 h |

One standing tension, not a regression: `/apply`'s *"verified pre-approval letter in about 3
minutes"* (founder item 7 / §3.37) is a promise-versus-capability problem on the same surface. It is
not a Reg Z trigger term and is not treated as one here.

---

## Evidence index

- Prod: `curl -s https://homiquity-production.up.railway.app/api/health` @ 2026-08-23T02:39:22Z →
  `commit: b30eb53a9d5debd5324fbddae5800b18772c00e4`; `git rev-parse origin/main` → identical.
- `main` CI: `gh run list --branch main --limit 8` → 8 × `success`.
- Visibility / protection: `gh api repos/barakatammre84/Homiquity` → `public`;
  `…/branches/main/protection` → `contexts: []`, `enforce_admins: true`.
- Fleet state: `list_scheduled_tasks` @ 02:37Z → 4 of 15 `enabled: true`.
- Report census: `git ls-tree -r --name-only <ref> -- knowledge-base/routines/reports/` over every
  `refs/remotes/origin/*` **and** `refs/heads/*` → two `2026-08-22-*` on remote refs, two more on
  local-only refs, **zero** `2026-08-21-*` anywhere.
- §3.29 closure: `server/routes/lending/statusDecisions.ts:90` and
  `client/src/pages/lending/preApproval/useDraftRestore.ts:72,74,75` on `b30eb53a`.
- ux-30 residue: `client/src/App.tsx:475-481` and `client/src/lib/routeGates.ts:69` on `b30eb53a`.
- `FINDINGS.md` counts: `sed -n '/^## Open findings/,/^## Refuted/p' … | grep -E '^\| ' |
  grep -vE '^\| id \||^\|---' | wc -l` → 255; the same pipe filtered on `fixed` → 18; Closed → 36.

## Collision note

A second session titled **"Evening triage"** was running concurrently
(`local_ff939638`, active 02:35Z, worktree branch `routine/evening-triage-2026-08-22`). At
02:40Z that branch had **zero commits ahead of `main`**, was not on `origin`, and had no PR, so
there was nothing to assist with and nothing to collide over. This run took the distinct branch
`routine/evening-triage-2026-08-22b`. If that session lands a report of its own, **merge the two
rather than keeping both** — two triage reports for one day is precisely the duplicate-truth
failure this seat exists to prevent.

STATUS: WARN
