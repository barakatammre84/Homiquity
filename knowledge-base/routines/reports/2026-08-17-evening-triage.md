# Evening Triage — 2026-08-17 (Mon)

> **Amended by the 21:00 scheduled run** (the slot #541 created). Everything above the
> *"Evening delta"* section at the foot of this file is the 17:26 catch-up run, unedited. The
> delta section is authoritative where the two disagree — **a new P0 arrived after the catch-up
> run wrote**, ⛔3 resolved itself, and the PR queue moved. Per CHARTER §5's assist ladder I
> extended this report and PR #543 rather than opening a competing second triage artifact; one
> backlog is the whole point of this routine.

STATUS: FAIL — one routine FAILed today (vendor-procurement: **every outbound email is
unauthenticated** — no SPF, no DMARC, no apex DKIM — while `/api/health` reports email
configured), and **PR #540 sits red with auto-merge armed and its owning session stopped**.
Prod itself is current, green, and drained 22 merges today.

**First run ever.** This routine was registered 2026-08-12 and starved to zero runs by the
catch-up-burst concurrency limit on its end-of-day slot; re-timed 18:40 → 21:00 in #541 today, and
this is the founder-triggered catch-up run (17:04–17:3x local; local = UTC−3). There is no prior
triage state; this report is the baseline. Where my scheduled-task job description still says
18:40, CHARTER §3 (21:00, per #541) wins — noted per the CHARTER preamble. Closes compliance-watch
ticket **CW-T1** ("Evening Triage has never run") and the evening-triage half of launch-gate
**LG-6**.

---

## ⛔ Founder list for tomorrow — hardest decision first

1. **Decide F-040's scope** (roadmap §1.14): the stored FCRA disclosure promises **120-day consent
   validity**; `credit_consents` has no expiry column and no gate checks age. Does 120 days bind
   funnel soft-pull consents too, or only `/credit-consent` hard pulls? Strictest defensible
   reading (bind everything, force re-consent past 120 d) is the default if you stay silent; the
   mechanism is a routine engineering item once you answer (PE-006).
2. **Set the Railway + Actions billing posture** (§0 KTLO-1/KTLO-2, both re-measured today):
   Railway usage is ≈**$3.20/month** — the risk is the **expiring trial credit** (last human read
   "~$4.97 / ~30 days" on 2026-08-06; unreadable by any session since). Separately, **GitHub
   Actions is the real platform bill**: ~1,850 of 2,000 free min/month (~92%). Add the Railway
   payment method; decide Actions spending limit vs. overage ($0.008/min) — a hard cap that halts
   the `gate` also halts every merge and `migrate-prod`.
3. **⏰ Time-critical — resolve #540 today**: its `gate` FAILED at 20:05Z (bundle ratchet, +286
   bytes over the baseline #503 froze this morning), **auto-merge is armed** (enabled 20:01:53Z),
   and the owning session's last activity was 20:02Z — the red arrived *after* it stopped. As it
   stands the PR sits BLOCKED forever, or deploys the moment anyone turns it green. Either have
   the rent session finish (baseline bump with justification per the guard's own doc) or disarm
   auto-merge until it's green.
4. **One NMLS login session, four outcomes** (§1.13, from compliance-watch ⛔1–4): (a) **does an
   IL-licensed MLO with an approved sponsorship exist?** — if not, nobody can originate the first
   Illinois loan and this outranks everything else in §1; (b) Consumer Access / MU1 / surety bond
   / financial-statement record pulls; (c) download the IL checklists (Resource Center is
   unreachable from sessions) and hand them to a session for `docs/nmls/`; (d) confirm the first
   MCR due date (computed Q3-2026 RMLA due **2026-11-14**; prep draft ready) and calendar it.
5. **Procure the Reg Z / FCRA / CROA source texts before they age past-due** (§1.12): five
   regulatory-ledger entries with network-blocked verification hit review dates **2026-08-18 →
   2026-08-23**. No session can clear them; only you can fetch the texts (`docs/reg-z/README.md`
   procedure).
6. **Squarespace DNS — the day's FAIL** (§1.11): SPF TXT on the apex, DMARC at `_dmarc`, SendGrid
   `s1`/`s2` DKIM CNAMEs **on the apex** (the existing `s1._domainkey.www` is wrong-host and never
   queried). Until then password resets and verifications land in spam. ~20 min.
7. **The prod-variables hour** (§1.2, live-read today): set `GCS_SERVICE_ACCOUNT_KEY` +
   `PRIVATE_OBJECT_DIR` (uploads 503 today), `SENTRY_DSN` + an uptime monitor, and
   `GOOGLE_MAPS_API_KEY` (**every prod address lookup 503s today** — `geocode.ts:34`); decide
   `RAPIDAPI_KEY` or record the simulated survey; delete the stray lowercase `fromemail`.
8. **Open the F3 and F6 vendor applications** (§1.4 — "start now" since 2026-08-06, still not
   opened): F3 first email also requests SOC 2 Type II + DPA + FCRA end-user certification
   package; F6 covers both DU and LPA legs.
9. **Merge round**: #514 is green and merge-ready now (§3.2). #539 and #537 are both stuck on
   **dropped CI dispatches at head** — my 20:14Z body-edit nudge on #539 did not dispatch either
   (zero runs at head as of 20:20Z, same signature as #537's four documented drops), so both need
   your "Update branch" button or delayed-delivery patience; **do not merge until a gate actually
   runs at head**. Then the review stack: #536 (5-min docs read — it's the evidence for item 2),
   #530/#532 (radar ledger docs), #523, #521, #495; **#524 deliberately, not on autopilot** (major
   bump of `@google-cloud/storage`, the dependency uploads will rest on).
10. **2 minutes against data loss**: `barakatammre84-fictional-eureka` (copilot worktree) holds
    **9 URLA-helper-text commits that exist only on this laptop** — push it or authorize a session
    to snapshot it to a `wip/*` branch.

---

## Summary

Launch is blocked on founder actions, not code: prod is current and healthy (`/api/health` commit
`100460a` = `origin/main`, drift 0), every gate is green, and today drained 22 merges including
the entire silent-success fix wave — but email authentication, billing, the launch-critical prod
variables, the NMLS Illinois questions, and the two vendor applications are all founder-held, and
three of them are now date-bound. The suite mostly proved life today: seven routines produced
reports, but **frontend-wiring-audit and lender-delivery-gate did not run at all** and the QA
sweep is still in flight at write time, so proof-of-life is WARN with those two named. The single
FAIL is real and borrower-facing: outbound mail is entirely unauthenticated while the health
endpoint claims email is fine. Engineering-side, the day's new work is queued and small — #537/#539
ready pending a CI-dispatch fix, #514 green from the retired sprint-blitz, and a 13-commit orphan
branch of unlanded compliance tests rescued into draft #542 after its invisibility already cost
one duplicate rebuild. The deduped backlog and roadmap now reflect all of it in one place.

---

## Per-routine STATUS — proof of life (CHARTER §7)

| Routine | Slot | Report today | STATUS | Notes |
|---|---|---|---|---|
| primary-engineer | 07:21 | on PR #539's branch (unmerged) | WARN | 3 items shipped: #537, #503-assist (merged 19:32Z), #539. Both PE PRs have **zero check-runs at current head** (dropped dispatches). |
| launch-gate | 07:48 | `main` (#531) | WARN | `RELEASABLE: yes · drift 0 · gates ✓ · rollback ✗`. Rollback window restored by today's deploys; relapses ~2026-08-20. |
| frontend-wiring-audit | 09:20 | **MISSING — did not run** | WARN (named) | No report, branch, or PR on any ref. Laptop was open (six peers ran), so this is starvation-shaped, not laptop-shaped — **verify its scheduler registration** (CHARTER §11), same class as evening-triage's own zero-runs defect fixed today. |
| lender-delivery-gate | 12:31 | **MISSING — did not run** | WARN (named) | Same. Last ran 2026-08-12. |
| deliverable-qa-sweep | 15:05 | **in flight at triage time** | WARN | Session RUNNING (activity 20:13Z) in the primary checkout on `routine/qa-sweep-2026-08-17`; committed the 08-12 register rescue (`b39d989`, 15:50 local). Branch is **local-only** — report + push pending. |
| evening-triage | 21:00 (#541) | this report | — | First run ever (see header). |
| vendor-procurement | Mon 09:37 | `main` (#526) + addendum PR #536 | **FAIL** | Email-auth DNS absent; billing unprobeable by any session; 4 launch vars unset. |
| compliance-watch | Tue 13:21 (founder-triggered today) | `main` (#538) | WARN | Ladder's first verification pass clean; 5 founder asks; 5 ledger entries near past-due. |
| refactor-radar | Sun 20:00 (catch-up today) | `main` | OK | #528 shipped and founder-merged same day; follow-up ledger PRs #530/#532 open. |
| rent-reporting-watch | Thu 11:09 | not due | — | Next: 2026-08-20. |

---

## Backlog — one deduped list (CHARTER §1 rank, then severity)

Sources: launch-gate LG-1…6 · vendor-procurement ⛔1–10 + VP-1…6 · compliance-watch ⛔1–5 +
CW-T1…3 · primary-engineer PE-T1…3 · refactor-radar tickets · this run's own findings.
Owner: **Amr** = human/business, **Claude** = automatable. Ids are date-qualified per CHARTER §5.

### P0 — compliance / legal / security

| id | item | owner | est |
|---|---|---|---|
| B-0817-01 | **Email-auth DNS** (§1.11): 4 records at Squarespace; until then credential-recovery mail is unauthenticated spam-fodder. Borrower-experience + phishing posture; the day's FAIL. | Amr | 20 min |
| B-0817-02 | **#540 red + armed auto-merge, unattended** (⛔3): fix-or-disarm before it either strands or surprise-deploys. The fix is the guard's own documented baseline-bump-with-justification, in the PR. | Amr (2 min) / owning session | 15 min |
| B-0817-03 | **Reg Z/FCRA/CROA text procurement** (§1.12): five ledger entries age past-due starting **tomorrow**. Until texts land, readings stay flagged-never-asserted. | Amr | 30 min |

### P1 — launch-blocking

| id | item | owner | est |
|---|---|---|---|
| B-0817-04 | **Railway payment method + Actions minutes posture** (KTLO-1/2, re-measured — see #536). | Amr | 10 min |
| B-0817-05 | **NMLS session** (§1.13): IL originator? + 4 record pulls + IL checklists + MCR calendar. The originator answer can re-rank the whole launch queue. | Amr | 1 h |
| B-0817-06 | **Prod variables** (§1.2): GCS pair, Sentry + uptime, Maps key, RapidAPI decision, delete `fromemail`. Uploads and address capture are dead in prod today. | Amr | 45 min |
| B-0817-07 | **F3 + F6 applications** (§1.4): open them; lead time runs in parallel. | Amr | 1 h |
| B-0817-08 | **Drain the merge-ready queue**: #514 now; #539/#537 after the CI-dispatch lever; then the review stack (order in the PR-queue section). | Amr | 1–2 h |
| B-0817-09 | **F-040 decision** (§1.14) then the expiry mechanism (column + age gate, expand-only migration). | Amr decide / Claude build | 10 min + 1 PR |
| B-0817-10 | **Adjudicate draft #542** (br5hsb rescue, §3.17): after #537 lands — rebase, drop the superseded F-042 slice, land the 5 compliance-test suites + F-051 fix if green, or close explicitly. | Amr decide / Claude execute | 15 min + 1 session |
| B-0817-11 | **Land the QA sweep**: session live at write time; when it finishes, its report + FINDINGS updates must reach a pushed PR (branch is local-only). If it died silently, tomorrow's primary-engineer picks it up. | Claude | — |
| B-0817-12 | **Scheduler-registration audit for wiring-audit + lender-delivery-gate** (did not fire today; CHARTER §11 — a definition that isn't registered is a fossil). Needs an attended session that can read `~/.claude/scheduled-tasks/`. | Amr+Claude | 10 min |
| B-0817-13 | **Push `barakatammre84-fictional-eureka`** (9 local-only URLA commits). | Amr | 2 min |

### P2 — polish / hygiene

| id | item | owner | est |
|---|---|---|---|
| B-0817-14 | Un-red `pnpm checkup` via a recorded accepted-risk (§3.16, LG-3). | Claude | 1 PR |
| B-0817-15 | Register `reg:watch:save` weekly + `lastRun` age assertion in checkup (§3.15, VP-4). | Claude | 1 PR |
| B-0817-16 | `ASSUMPTIONS.md` corrections (VP-2): email row (DNS, not key), SMS row (signature check is real+armed), Truv row (no seam exists). | Claude | 30 min |
| B-0817-17 | `.env.example`: document `FREDDIE_LPA_API_KEY`, `INTAKE_PAUSED`, `SENDGRID_API_KEY1` (VP-3/E1). | Claude | 15 min |
| B-0817-18 | Close stale FINDINGS rows once verifiable (PE-T1): F-034/035/036 (fixed `02a4d8a`), F-027 (fixed `bba0132`), F-042/ux-20 after #537/#539 merge. **Deferred to the QA-sweep lane — its live session owns FINDINGS.md right now; racing it would conflict.** | Claude (QA-sweep lane) | 30 min |
| B-0817-19 | Branch/worktree cleanup per the hygiene section (≈30 `[gone]` locals via `clean_gone`; 2 merged worktrees; verify-then-delete for 8 orphan remotes ≤2 commits). | Claude | 20 min |
| B-0817-20 | PPE comparison one-pager for F11 (VP-6) — pre-contract founder homework, vendor board owns it. | Amr | 1 h |
| B-0817-21 | RR-005 (URLAForm decomposition — scope as a deliberate project, not a radar budget) + RR-016 (admin/Lenders.tsx) — radar ledger owns them. | Claude | — |

Dropped as already-done during dedupe: LG-4 (queue drained — 17 open → 11 before my adds),
LG-5/§1.1 (probe says flipped; residual folded into §1.1's rewrite), CW-T1 + LG-6 (this run +
#541 + launch-gate's suspension evidence close both), VP-5/§1.9 (prod verified clean; local
residual folded into §1.9), PE-T2/§2.1 (#446 — closed in the roadmap this run).

---

## Roadmap changes landed this run (my §0–§3 authority; §4 untouched)

- **KTLO-1 rewritten**: consumption myth corrected (≈$3.20/mo measured, #536); risk = expiring
  trial credit, unreadable by sessions; rollback-retention coupling with the ~08-20 relapse date.
- **KTLO-2 rewritten**: Actions is the platform bill (~92% of free minutes); 08-06 queueing
  symptom marked stale; today's mitigations (#529, #535) recorded; decision framed (spending cap
  halts merges *and* `migrate-prod`).
- **KTLO-3 annotated**: cold-start unverified *because* cron sweeps mask it (#526 E6).
- **§1.1 rewritten** to its residual: probes say the flip already happened (public since
  2026-08-06; re-proved today); confirm variable values, then archive.
- **§1.2 rewritten from the live variable read** (#526 E2): 4 launch-critical names still unset
  (+ `fromemail` deletion); verified-done clauses (SendGrid key, CRON_SECRET match, DATABASE_URL)
  removed.
- **§1.3 age corrected** (five weeks unworked), **§1.4 annotated** (not opened as of today + the
  certification-package asks), **§1.8 annotated** (Tier-2 watcher dark ⇒ no live guideline
  channel), **§1.9 rescoped** (prod clean; local `.env` residual incl. dead `RAILWAY_API_TOKEN`
  and `OPENAI_API_KEY`).
- **NEW §1.11 email-auth DNS · §1.12 Reg Z/FCRA/CROA procurement (date-bound) · §1.13 NMLS
  session · §1.14 F-040 decision.**
- **§2.1 DELETED as done** (#446 merged 2026-08-07; sweep host + CRON_SECRET verified live today)
  → appended to the archive ledger per maintenance rule 2.
- **§2.2 annotated** (GCS names confirmed still unset today).
- **§3.2 annotated** (the fix exists: open+green #514 — review, don't rebuild).
- **NEW §3.15 register `reg:watch` · §3.16 un-red checkup · §3.17 adjudicate #542/br5hsb.**
- **48h+ unowned check**: every §0/§1 item is founder-owned by construction; none of the §2/§3
  engineering items is older than 48 h without an owner lane (PE/radar/QA). The oldest truly
  unowned work was the br5hsb orphan (5 days) — now visible as #542 with a named next step.

---

## PR queue (12 open after this run's #542; oldest first)

| PR | age (d) | branch | state/checks | note |
|---|---|---|---|---|
| #495 | 5 | claude/determined-mccarthy-ozgcqg | draft, gate ✓ | AdminUsers split — decide: promote or close |
| #514 | 5 | routine/sprint-blitz-2026-08-12 | gate ✓ | **merge-ready** (§3.2). Local branch has 1 unpushed merge commit — ignore it; the PR as pushed is what's green |
| #521 | 1 | claude/fervent-mayer-6ofjk2 | gate ✓ | financial-audit read; review |
| #523 | 0 | dependabot @types/node 26 | gate ✓ | low-risk types bump |
| #524 | 0 | dependabot @google-cloud/storage 8 | gate ✓ | **major bump of the uploads dependency — deliberate review** (#526 E6) |
| #530 | 0 | refactor-radar/…-urla-step-ids | gate ✓ | radar: RR-005 refuted → narrowed step ids |
| #532 | 0 | refactor-radar/…-ledger-audit | gate ✓ | radar ledger audit (RR-009 rank 1) |
| #536 | 0 | docs/vendor-procurement-cost-addendum | gate ✓ | **read first** — it re-prices KTLO-1/KTLO-2 |
| #537 | 0 | routine/primary-engineer-…-1 | **zero check-runs** | F-042 FCRA gate fix. Four dispatches dropped; **escalated — founder lever ("Update branch"), do not merge until a gate runs at head** |
| #539 | 0 | routine/primary-engineer-…-3 | **zero check-runs at head** | ux-20. Gate ran green 19:43Z on the pre-report head; the report-commit push never dispatched; my 20:14Z body-edit nudge didn't either. Same founder lever |
| #540 | 0 | fix/rent-audit-wave | **gate ✗ (bundle ratchet +286 B)** · **auto-merge ARMED** | see ⛔3 — resolve today |
| #542 | 0 | claude/lucid-edison-br5hsb | draft (opened by this run) | 13-commit orphan rescue; adjudicate after #537 |

`mergeable: UNKNOWN` on list reads is GraphQL staleness, not a verdict — states above were
confirmed per-PR (REST for check-runs). No PR besides #540 has auto-merge armed (whole-queue
`autoMergeRequest` check). #525 in today's numbering is CLOSED (launch-gate's superseded first
PR), not stuck.

---

## Register hygiene (REGISTER.md)

- **Cleared** the one stale active claim: `/financial-audit` (2026-08-12, 5 days old) — its
  claimed branch `claude/fervent-mayer-oqk0iv` was merged (#496, #506) and deleted from origin,
  no worktree exists; moved to Recently released with the lane's live signal (#521) noted. The
  weekly routine re-claims on its next tick (CHARTER §5.5).
- No other active claims existed. Radar and PE both claimed and released same-day today — the
  board is being used correctly.

## Repo hygiene

- **Primary checkout**: porcelain clean; parked on the QA sweep's live branch
  (`routine/qa-sweep-2026-08-17`) — untouched by this run. The earlier uncommitted
  FINDINGS/DOMAINS residue was resolved by that session itself (`b39d989`); the older leftovers
  snapshot lives on `origin/wip/primary-checkout-leftovers`.
- **Worktrees**: removable — `.claude/worktrees/pensive-noether-5232f2` (detached at #516's merged
  tip) and `.claude/worktrees/strange-kilby-c389c0` (content preserved on
  `origin/wip/rate-pages-search-extraction`). Live, leave alone — the scratchpad `audit-wt`
  (#540's session) and my own `evening-triage-2026-08-17`.
- **Local-only branches with real unmerged work (one disk failure from gone)**:
  `barakatammre84-fictional-eureka` (9 commits — ⛔10) and `routine/qa-sweep-2026-08-17`
  (1 commit, live session — it should push itself). `routine/qa-sweep-2026-08-12` has zero
  unmerged commits → removable.
- **~30 local branches with `[gone]` upstreams** (their PRs squash-merged and remote-deleted) →
  `clean_gone` candidates (B-0817-19).
- **Orphan remote branches, no PR**: `claude/lucid-edison-br5hsb` → **rescued as draft #542**
  (its invisibility already cost a duplicate F-042 rebuild — #537 vs `15c1f19`, five days apart).
  Verify-then-delete (1–2 commits each): `claude/kind-franklin-{bnjkvr,hl5zld,xuvxii}`,
  `claude/lucid-edison-{28s32n,6uopmz}`, `claude/fervent-mayer-{uqcv21,w2dx4y}`. Verify-by-content
  then delete: `origin/claude/frontend-standardization-2` (12 commits; PR #497 CLOSED; content
  believed landed via #501/#504). Branches of merged PRs not auto-deleted:
  `origin/feat/lease-deletion`, `origin/routine/vendor-procurement-2026-08-17`.
- **`wip/*` snapshots**: intact and correctly labeled do-not-merge.

## Funnel legal posture (24 h window)

Funnel/landing/lead code did change in the window (merged: #528 amortization-calculator
extraction, #509 silent-mutation fixes, #511/#512, #517/#518 rent surfaces), so the check ran:

- **TCPA provenance intact**: `server/routes/leads.ts:100-101` still records
  `consentIp: clientIpForRecord(req)` + `consentUserAgent`; record timestamp on insert. The leads
  route itself had no commits in the window.
- **No new rate/payment/APR copy**: no disclosure or SEO surface changed (empty log on
  `client/src/**/*isclosure*`, `shared/seo/` in the window). #528 was a byte-identical math move
  with no copy change (radar's diff proof). Reg Z trigger-term and Reg N no-approval postures
  therefore unchanged.
- **SMS guards untouched**: `server/services/quietHours.ts` + `smsCompliance.ts` last changed
  2026-07-03 (`3f8c8f5`); no outbound sender exists (#526 E3), so nothing can send outside them.
- #539 (pending merge) *strengthens* FCRA disclosure visibility at the consent ask.

**Posture: intact.**

## Evidence

- Prod current: `curl -s https://www.homiquity.com/api/health` → `"commit":"100460a…"` =
  `git rev-parse origin/main` (20:19Z). Both post-merge CI runs on main completed `success`
  (32063611662, 32063951915) — per the deploy rail, the health `commit` is the proof, and it holds.
- #540: `gh pr checks 540` → `gate fail` (run 32063406681); log tail:
  `bundle-size-guard: FAIL — the eager entry bundle grew 286 raw bytes … baseline 522,148 -> now 522,434`;
  `autoMergeRequest.enabledAt: 2026-08-17T20:01:53Z`; owning session last activity 20:02:11Z
  (`list_sessions`), failure logged 20:05:16Z.
- #539/#537 zero check-runs at head: `gh api repos/…/commits/{3f63ab3,e25652b}/check-runs` →
  `total: 0` (re-checked after the 20:14Z body edit).
- Reports located: `main` holds launch-gate/vendor-procurement/refactor-radar/compliance-watch
  for today; `2026-08-17-primary-engineer.md` only on `origin/routine/primary-engineer-2026-08-17-3`;
  an all-remote-branch `ls-tree` sweep found **no** wiring-audit, lender-gate, or qa-sweep report
  for today.
- QA sweep liveness: `list_sessions` → "Deliverable qa sweep" `isRunning: true`, activity
  2026-08-17T20:13:25Z; `git log routine/qa-sweep-2026-08-17` → `b39d989` 15:50:12 −03:00.
- br5hsb: `git diff --stat origin/main...origin/claude/lucid-edison-br5hsb` → 22 files,
  +1,543/−72; its `15c1f19` = "fix(F-042) … FCRA gate must precede cache disclosure" (2026-08-12)
  vs #537 (same defect, 2026-08-17).
- Vendor FAIL, billing re-measure, variable read: `2026-08-17-vendor-procurement.md` E1/E2/E6 +
  PR #536 addendum (E8/E9).
- Register claim: `REGISTER.md` active row dated 2026-08-12; `claude/fervent-mayer-oqk0iv` absent
  from `git branch -r` and `git branch`; PRs #496/#506 MERGED on that head ref.
- Funnel: greps and `git log --since="24 hours ago"` outputs quoted in the section above.

## Actions this run took (docs-only territory + queue hygiene)

1. This report; CTO_ROADMAP.md edits as listed; REGISTER.md stale-claim clearance; one LESSONS.md
   entry (verify checks at the *head SHA*, not the PR).
2. **#539 body-edit CI nudge** (20:14Z — no §9 trigger on its diff, no auto-merge armed, cannot
   deploy): did **not** dispatch; recorded as evidence that both PE PRs need the founder lever.
3. **Draft #542 opened** from `claude/lucid-edison-br5hsb` (REST; GraphQL flaky today) — clearly
   marked do-not-merge-as-is with the #537 overlap map.
4. No merges, no auto-merge, no production changes, no code. §4 untouched.

---

# Evening delta — the 21:00 scheduled run

The catch-up run wrote at 17:26 local. Three and a half hours later the day looks materially
different in four ways, one of which **changes the top of the founder's list**.

## What changed, and what it costs

### 1. The QA sweep landed — and it carries a P0 the catch-up run could not see

`deliverable-qa-sweep` was "in flight" above; it finished and pushed **PR #544**
(`2026-08-17-qa-sweep.md`, `routine/qa-sweep-2026-08-17`, `MERGEABLE`, gate green at head
`7c32866`). Proof-of-life for that routine resolves **WARN → OK**, and **B-0817-11 is closed**.

Its headline is **F-051 (P0)**, and I re-verified it independently on `origin/main` before
promoting it — the charter's §10 dating rule applies to a finding the same day it is written:

```
$ git show origin/main:server/mismo.ts | sed -n '860p'
  { tag: "AutomatedUnderwritingRecommendationDescription", text: "Approve" },
$ grep -rn "automatedUnderwritingRecommendationDescription" --include="*.ts" server shared client tests
shared/mismo.ts:720:  automatedUnderwritingRecommendationDescription?: string;   # declaration only
$ grep -rn "ausRecommendation" --include="*.ts" server shared
server/routes/aus.ts:230              ausRecommendation: findings.recommendation,
server/services/brokerSubmissionReadiness.ts:323        recommendation: application.ausRecommendation ?? null,
shared/schema/lendingCore.ts:50   ausRecommendation: varchar("aus_recommendation", …)
```

**Confirmed:** a `refer_with_caution` file is delivered to a wholesale lender as `Approve`. That is
acceptance question **A**, and it has been unowned for five days.

**One correction to the sweep's write-up, because it changes the size of the fix.** The sweep states
*"no recommendation field exists anywhere in the MISMO DTO (`grep recommendation shared/mismo.ts` →
nothing), so the emitter had nothing to read."* That is wrong — `shared/mismo.ts:720` declares
`automatedUnderwritingRecommendationDescription`, inside `AutomatedUnderwriting`. The grep as quoted
should have hit it. The defect is real and the severity stands; the *cause* is a mapping gap, not a
missing type, and the fix is correspondingly smaller. Landed that way in §2.4.

The sweep's other rows are landed as **§2.5** (F-080 co-borrower dropped, with its
ship-with-or-before-F-052/F-053 constraint), **§3.18–3.22** (F-076 APR, F-077/F-087 MI, F-078 public
credit-tier calculator, F-079+ux-30 TRID, D-014 the QA script itself), and **§3.23** (the orphan
server). Its ⛔2 and ⛔3 became founder items **§1.12** (rewritten) and **§1.15** (new).

### 2. ⛔3 resolved itself — #540 merged

`a846325` is on `main` and **prod is serving it**:

```
$ curl -s https://www.homiquity.com/api/health
{"status":"ok","commit":"a846325949046431c366050f4bdf8d64dd0272d9","email":{"configured":true,…}}
$ git rev-parse origin/main
a846325949046431c366050f4bdf8d64dd0272d9
```

Drift 0. The red-with-auto-merge-armed hazard is gone, **B-0817-02 is closed**, and a whole-queue
re-check shows **no PR has auto-merge armed** (`autoMergeRequest: null`, 13/13). The standing
"an `--auto` from an earlier session fires the moment Actions recovers" hazard is clear tonight.

### 3. The merge advice above is now stale — main moved under the queue

#540 landing turned six PRs `CONFLICTING`. Re-read per-PR at head:

| PR | catch-up run said | now | check-runs at head |
|---|---|---|---|
| #514 | "**merge-ready**, merge it now" | **CONFLICTING** | 3, but at a stale head — meaningless until rebased |
| #537 | zero checks, needs founder lever | **CONFLICTING** + zero checks | 0 |
| #539 | zero checks, needs founder lever | **CONFLICTING** + zero checks | 0 |
| #521, #530, #532, #542 | gate ✓ / draft | **CONFLICTING** | stale |
| #536, #543, #544 | — | **MERGEABLE** | 3, green |

**This is good news for #537/#539, not bad.** Their four dropped CI dispatches had no fix a session
could reach; now they *need* a rebase for an unrelated reason, and the rebase push is itself a
dispatch. The founder's "Update branch" button resolves the conflict and the zero-check problem in
one click. Do not merge either until a gate actually runs at head — that part stands.

Revised drain order: **#536** (5-min read, it is the evidence for the billing decision) → **#544**
(tonight's findings register — land it so tomorrow's routines can see F-051) → **#543/this PR** →
then rebase-then-merge #514, #537, #539 → then the review stack #530/#532/#521/#523/#495, with
**#524 deliberately** (major bump of the uploads dependency).

### 4. A session is fixing F-051 right now, uncommitted

`git status --porcelain` in the primary checkout went from clean to `M server/mismo.ts` during this
run — 69 insertions, a new `mapAusRecommendation()` that returns `null` on unknown input, and a
rewritten emitter that **omits the whole `AUTOMATED_UNDERWRITINGS` container** rather than
substituting a value. It cites `MISMO_3_0.xsd:20884-20889` for both children being independently
`minOccurs="0"`, and deliberately declines to emit `AutomatedUnderwritingCaseIdentifier` because the
only available id is the simulator's. That is the right fix, done the right way.

**I did not touch it** — CHARTER §6(a) says the primary checkout's residue is snapshot-or-leave, and
this is not residue, it is live work by a peer. Flagging it for one reason only: **it is uncommitted
and unpushed**, so a crashed session loses it. If it has not appeared as a branch by morning,
snapshot it to `wip/*` before anything else touches `server/mismo.ts`.

## Backlog delta

**Closed since the catch-up run:** B-0817-02 (#540 merged) · B-0817-11 (QA sweep landed as #544).

**New, inserted above every surviving P1** — both are acceptance question A, which the charter ranks
first:

| id | item | owner | est |
|---|---|---|---|
| B-0817-22 | **F-051 (P0) — lender package asserts `Approve` for every file** (§2.4). A fix is in progress uncommitted in the primary checkout; the job is to see it committed, tested and landed. | Claude (in flight) | ~1 PR |
| B-0817-23 | **F-080 — co-borrower dropped from the delivered package** (§2.5). Must ship with or before F-052/F-053, never after. | Claude | 1 PR |

**Changed:** B-0817-08 (merge drain) — re-ordered as above; #514 needs a rebase first, and the
#537/#539 lever is now the conflict-resolution button rather than a dispatch mystery. B-0817-03 →
**materially cheaper**: qa-sweep U-26 disproves the "every authoritative source is blocked" premise
that `CLAUDE.md`, `docs/reg-z/README.md` and §1.12 all rest on (`consumerfinance.gov`, the eCFR
versioner API and `law.cornell.edu` all returned 200 to two independent agents; only eCFR HTML is
blocked). The founder ask shrinks from "fetch five texts yourself" to "authorize a session to
capture them, and let it amend the binding clause."

**New P2s:** B-0817-24 kill orphan PID 20814 on :5002 (§3.23 — I re-probed it: `200`, payload
`{"status":"ok","timestamp":…}` with **no `commit` field**, from code dated 2026-08-05 out of a
deleted worktree). B-0817-25 the D-014 fix to the Workflow 3 script (§3.22) — until it lands, a
green Workflow 3 is not evidence.

## Roadmap changes landed in this delta

- **§1.12 rewritten** — U-26 correction; the ask is now "authorize a capture pass + amend the
  `CLAUDE.md` clause", still date-bound 08-18 → 08-23.
- **NEW §1.15** — counsel: is the Loan Options page a §1026.18 disclosure (escalates F-076 P1→P0).
- **NEW §2.4 (F-051)** and **§2.5 (F-080)** — the only two additions to the launch-blocking
  section; both are lender-package integrity, both re-verified against `origin/main` tonight.
- **§3.2 corrected** — #514 is `CONFLICTING`, not merge-ready; its green checks sit at a stale head.
- **NEW §3.18–3.23** — F-076, F-077/F-087, F-078 (live in prod), F-079/ux-30, D-014, orphan server.
- **§4 untouched.** No item promoted to §0–§2 that is not genuinely launch-blocking.

## Register + hygiene delta

- **REGISTER.md**: no new active claims; the QA sweep took none (findings-only territory) and
  released nothing to clean. The board is empty and correct — leave it.
- **`routine/qa-sweep-2026-08-17` is no longer local-only** (pushed as #544), which retires that
  data-loss flag. `barakatammre84-fictional-eureka` (9 commits) is still local-only — ⛔10 stands.
- **New removable worktree**: the scratchpad `audit-wt` (#540's session) — its branch
  `fix/rent-audit-wave` merged and was deleted from origin during this run.
- **Live, do not touch**: the primary checkout (uncommitted F-051 fix), and this run's own
  `triage-wt`.

## Proof-of-life, corrected

| Routine | Catch-up run | Corrected |
|---|---|---|
| deliverable-qa-sweep | WARN — in flight | **OK** — #544, report + FINDINGS landed |
| frontend-wiring-audit | WARN — did not run | **unchanged: did not run** (named; B-0817-12) |
| lender-delivery-gate | WARN — did not run | **unchanged: did not run** (named; B-0817-12) |

Two routines still produced nothing today, which is why proof-of-life stays WARN and B-0817-12
(scheduler-registration audit, CHARTER §11) stays P1. Everything else is unchanged.

## Why this is still FAIL

`STATUS` was already FAIL on vendor-procurement's unauthenticated outbound mail. It stays FAIL for a
second, independent reason the catch-up run could not have known: **a P0 that delivers a false AUS
approval to a wholesale lender is open on `main` tonight.** ⛔3 clearing does not offset that — it
was a queue hazard; this is the product's core promise.

**Founder list, re-ranked.** Insert **F-051** as the new item 3 (displacing the resolved #540 item):
it needs no decision from you — only that the in-flight fix is allowed to land tomorrow ahead of
other work, and that #544 merges so the finding is visible to every routine. Items 1, 2, 4–10 above
stand, with item 5 (Reg Z) now cheaper per §1.12 and item 9 (merge round) re-ordered per §3 above.

## ⛔ FAIL — the escalation runbook (CHARTER §8, verbatim)

Handed over because the day closed FAIL. **Read the scope note first:** neither failure is a
prod-down incident. Prod is healthy and current (`a846325`), so **do not pause intake** — that
lever is here because §8 requires the runbook verbatim on a FAIL, not because tonight calls for it.
The two failing things are (a) outbound email is entirely unauthenticated (§1.11) and (b) **F-051**,
an open P0 that delivers a false AUS approval in the lender package (§2.4).

- **Pause all new business:** set `INTAKE_PAUSED=true` in **Railway → project `Homiquity` →
  service `Homiquity` → Variables (environment `production`)**, then **redeploy** — a restart is
  not enough for anything compiled into the client bundle. Blocked requests get a borrower-safe
  503 (`server/services/maintenanceMode.ts`).
- **Bad deploy:** `git revert <sha>` + push (Railway rebuilds). Image rollback only inside the 72 h
  retention window — see [`runbooks/ROLLBACK.md`](../../runbooks/ROLLBACK.md).
- **Credential incident:** **update consumers first, then rotate.** The reverse ordering caused a
  five-hour outage. Trigger the replacement deploy *before* discarding the bad container.
- **Deploy appears stuck / green but stale:** compare `/api/health`'s `commit` to `origin/main`.

STATUS: FAIL
