# Feature Completion Engine — 2026-08-20

**Domain:** 12 — Property, listings & homeowner · **area 22, Homebuyer accelerator program**
(`FEATURE_MAP.md` row 22, **Last reviewed: never** — one of the 23 of 41 unmeasured areas).
**Gap:** the program's progress never moved. **PR:** [#632](https://github.com/barakatammre84/Homiquity/pull/632).
**Open `FINDINGS.md` rows:** 161 before · 161 after — **this run closed none and added none**; see
*Proposed tickets*, and *Honesty* for why it did not write to that register.

STATUS: OK — one completion gap shipped with live proof; three adjacent gaps refused with reasons.

---

## ⛔ Human actions

1. **Does Homiquity staff 1:1 coaching sessions?** This decides the accelerator's next move and I
   will not guess it. Today `ScheduleSessionDialog` writes a `coaching_sessions` row and tells the
   borrower *"Coaching session has been scheduled."* — and `getCoachingSessions` has exactly one
   reader in the entire codebase: the borrower's own page. No staff surface, no notification, no
   task, no calendar. A borrower would keep an appointment nobody on our side knows exists.
   - **If yes** → the session needs a staff-visible destination before the control is honest.
   - **If no** → the control should say what is true (a personal plan, not a booking with us), or
     go. Either is a product decision; *never invent a service tier we do not offer* is the rail.
   - Until then **the accelerator keeps no front door** (see item 2), so this promise stays dormant
     rather than live.
2. **Approve opening a door to `/accelerator`, after item 1.** The program is reachable *only* by
   typing the URL — `grep -rn '/accelerator' client/src` returns exactly one hit, its own `<Route>`
   in `App.tsx:541`. Zero links, zero nav entries, zero cards. This is a fully built program
   (enrollment, 18 seeded milestones, phase tracking, a financial snapshot) with no way in.
   I deliberately did not wire one: a link would convert a dormant false promise into a live one.
   Note also that the obvious doors are claimed today — `Navigation.tsx` sits in both PR #605 and
   PR #615.

---

## Summary

The Homebuyer Accelerator is a real program the client cannot reach, and its headline number was
wrong in both directions. Nothing in the codebase had ever written `accelerator_enrollments.current_phase`,
so a borrower who ticked all eighteen seeded milestones still read *Phase 1 of 6 · 17%* — and the
17% itself was `currentPhase / totalPhases`, a number that claimed progress before any work was
done and would have claimed 100% while the final phase was still open. Progress is now **derived
from the milestone set rather than incremented**, which is the only shape that is also correct when
a borrower un-ticks something, and the header states the fraction it actually has (*n of 18
milestones complete*) instead of a phase ratio. The same surface carried a second, quieter defect:
the client's six phase names had drifted from the six the server seeds as milestone categories, so
the header called phase 1 "Foundation" while every milestone inside it was badged "Financial
Assessment" — one shared definition now feeds both. Three further gaps in this area were refused
rather than missed, and each carries its reason below.

---

## Evidence

### The gap, dated (CHARTER §10: date a standing claim before acting on it)

This is not a stale finding recycled from a document — it was derived from the code and it is live
at `origin/main` @ `53044804`:

```
$ git log --oneline -S 'currentPhase' -- server/ shared/
8ee9fd33 refactor(server): split the 4,295-line borrower.ts registrar into 14 route groups (#193)
f89838cb Initial commit for MortgageStream

$ grep -rn "currentPhase" server/ shared/ client/src   # accelerator rows only
shared/schema/admin.ts:645:  currentPhase: integer("current_phase").default(1),
client/src/pages/education/acceleratorProgram/ProgramHeader.tsx:8:  const progressPercent = Math.round((enrollment.currentPhase / enrollment.totalPhases) * 100);
```

The column is declared and read. It is written by nothing. The client had been *expecting* that
write since it was authored — `MilestonesSection.tsx:31` invalidates `["/api/accelerator/enrollment"]`
on every milestone toggle, an invalidation that could not have changed a single pixel.

### Live proof, worktree server on :5002 against real Postgres

`GET /api/health` → `{"status":"ok","commit":null}` — `commit: null` is the local-dev signature.
Logged in as `renter@test.com` (`aspiring_owner`), enrolled, then ticked each phase in turn:

```
start (1 of 18 ticked):         phase=1 status=active    completedAt=null
after every phase-1 milestone:  phase=2 status=active    completedAt=null
after every phase-2 milestone:  phase=3 status=active    completedAt=null
after every phase-3 milestone:  phase=4 status=active    completedAt=null
after every phase-4 milestone:  phase=5 status=active    completedAt=null
after every phase-5 milestone:  phase=6 status=active    completedAt=null
after every phase-6 milestone:  phase=6 status=completed completedAt=2026-08-20T17:18:11.030Z
after UN-ticking one phase-2:   phase=2 status=active    completedAt=null
```

The last line is the property that matters: progress is derived, so it is correct in both
directions. An incrementing counter would have stayed at phase 6 forever.

Seeding verified in the same session — `GET /api/accelerator/milestones/<id>` returns 18 rows, and
phase 1's three all carry `category: "Financial Assessment"`, which is now also the name the header
renders for phase 1.

### Proven by reintroducing each bug (three legs, three separate mutations)

| mutation | result |
|---|---|
| drop the `currentPhase` branch from `enrollmentProgressPatch` | node lane **1 failed** — *"moves the phase when the milestones moved"* |
| restore `Math.round(currentPhase / totalPhases * 100)` in `ProgramHeader` | client lane **3 failed** — the 0%, the 33% and the `aria-valuenow` cases |
| restore the divergent hand-written `PHASE_NAMES` map | client lane **1 failed** — *"names the phase the way the seeded milestones in it are named"* |

Each mutation was reverted and the lane returned green.

### Gate

```
pnpm check (tsc --noEmit)   0 errors
node lane                   213 files · 3097 passed | 1 skipped   (incl. tests/acceleratorProgress.test.ts, 14)
client lane                 113 files ·  750 passed               (incl. ProgramHeader.test.tsx, 7)
guard:tokens                at baseline ✅        guard:querykeys  OK (key + reachability + transport)
guard:ui                    9 metrics at baseline; §0 table regenerated (112 -> 113 client tests)
guard:schema                OK                   guard:migrations OK (57, contiguous)
guard:kb                    191 docs, all indexed guard:docs       ✅
guard:citations             at baseline ✅        pnpm build       ✓
guard:bundle                eager entry 523,895 raw (at baseline, no regression)
§9 detectTriggers()         []  (over the real diff, via parseChangedLines — CHARTER §10)
```

**`guard:ui` was missed on the first pass and caught by the pre-push hook** — worth recording,
because the hook is the only reason it was caught at all. It failed not on a metric (all nine are at
baseline; nothing regressed) but on **§0's adoption table being stale**, and the cause is this PR's
own colocated test: the table's *"110 client test file(s)"* is generated from the file count, and
adding one moved it to 111. Regenerated with `pnpm guard:ui --write-table` and committed
(`cc25597c`), which is exactly the procedure the guard's failure text prescribes. Verified the
staleness is **caused by this branch and not inherited**: with `origin/main`'s versions of the two
changed client files swapped back in and the new test removed, `guard:ui` reports *"UI standard OK:
508 files scanned"*. The one-line diff will conflict with PRs #619 and #623, which also touch
`DESIGN_SYSTEM.md` — resolve it by regenerating, never by taking a side.

**Three node-lane failures in the pre-push run were timeouts, not assertions.** Under this machine's
load (13 peer sessions; the lane took 663s against 66s in the isolated run) `adverseActionPregenerateHardening`
and `urlaCoApplicantRemoval` both died in `beforeAll` at *"Hook timed out in 60000ms"*, and two
`intakeNeverDenies` cases at *"Test timed out in 45000ms"*. **The ECOA §1002.9 invariant was not
violated — those two tests never reached an assertion**, which matters because CHARTER §6 makes a
compliance-invariant failure an incident rather than a flake, and the distinction is the timeout
message. All three files pass in isolation (`44 passed`), and none imports anything this PR touches.
The `security-review-guard: FAIL — CHANGED_FILES is empty` text in that log is the guard's *own test
fixture* printing its failure copy (its sample path is `server/routes/thing.ts`), not a real trip.

### Rebased onto ten merges, and the conflict that proves the point

`main` moved by **ten PRs** while this run was in flight (#628, #605, #623, #631, #630, #617, #607,
#619, #598, #624), so the branch went `CONFLICTING`/`DIRTY` — and **GitHub schedules no check-run at
all for a conflicted PR**, which is why `gh pr checks` reported nothing rather than reporting a
failure. Resolved by merging `origin/main` into the pushed branch (never a force-push; it is blocked
here), then reinstalling, because a worktree with stale `node_modules` fakes a red `tsc`.

Both conflicts were the shared-file hazards `REGISTER.md` names, and both resolved additively:

- **`REGISTER.md`** — my released row against three peers' rows landing in the same table position.
  Kept all four.
- **`DESIGN_SYSTEM.md` §0** — mine said `111 client test file(s)`, main said `112` (PR #605 added
  tests too). **Neither side is correct and neither should be chosen**: the number is a measurement,
  so the resolution is to re-run `pnpm guard:ui --write-table`, which produced `113` = main's 112 +
  this PR's one. This is the concrete case for the rule *resolve a generated number by regenerating*.

Post-merge, the whole gate was re-run rather than assumed: `tsc` 0, node 213/3097, client 113/750,
every `guard:*` green, `guard:bundle` 523,895 at baseline, `detectTriggers()` still `[]` over the
12-file diff against `main`. The 109-byte bundle "improvement" this run declined to claim is gone —
main's own merges absorbed it, which is the evidence that declining it was right.

**On the bundle baseline:** the guard offered to tighten it by 109 bytes and I reverted that write.
The delta is not attributable to this change — the accelerator is a lazy route and nothing eager
imports the new shared module — so it is pre-existing drift, and claiming someone else's 109 bytes
would poison the attribution of the next real regression. The guard passes either way; it only
fails on a regression. (This is also the baseline-race trap: `guard:bundle` and `guard:citations`
both *write* their baselines, so an uncommitted rewrite follows you between branches.)

### Schema / migrations / prod impact

**None.** No `shared/schema/**` change, no migration, no env var, no dependency. Every column
written (`current_phase`, `status`, `completed_at`) already exists and is already nullable or
defaulted. `pnpm db:push` was never run.

---

## Proposed tickets — for Evening Triage to land

| # | rank | ticket |
|---|---|---|
| 1 | **HIGH** (question B) | **The accelerator's coaching session books nothing.** `client/src/pages/education/acceleratorProgram/ScheduleSessionDialog.tsx:26` toasts *"Coaching session has been scheduled."*; `POST /api/accelerator/coaching` (`server/routes/borrower/realtorPrograms.ts:290`) stores the row; `storage.getCoachingSessions` has one reader — the borrower's own page. Nobody is told. This is the repo's dominant defect class (the UI says an operation happened) in its most expensive form: the borrower plans around it. **Blocked on ⛔ item 1** — whether we staff coaching is a founder call, not an agent's. The file is also in open PR #605, so it is claimed today regardless. |
| 2 | **HIGH** (question B) | **Give the accelerator a door — after ticket 1.** Zero entry points; `/accelerator` appears once in `client/src`, as its own route. The aspiring-owner surfaces (`RenterHome.tsx`, the borrower dashboard) are the natural homes. Sequencing matters: a door before ticket 1 makes a dormant false promise a live one. `Navigation.tsx` is claimed by #605 and #615. |
| 3 | MEDIUM (question A hygiene) | **Both accelerator enrollment writes pass `req.body` straight to storage.** `POST /api/accelerator/enrollment:161` spreads the raw body into `createAcceleratorEnrollment`; `PUT .../:id:219` hands it to `updateAcceleratorEnrollment` — and unlike its milestone and coaching siblings, which explicitly strip `enrollmentId` "to prevent ownership-link reassignment", neither strips `userId`. No Zod on either. A borrower can set their own `currentPhase`, `status`, or credit score, or reassign the enrollment. Impact is contained today because nothing downstream reads these fields — which is exactly why it should be fixed before anything does. |
| 4 | LOW | **`getAcceleratorMilestones` orders by `desc(createdAt)`**, so within a phase the plan renders backwards ("Set budget", "Calculate current DTI", "Review credit report"). Verified live. Needs a stable sort key: the 18 seeds are inserted in a loop and can share a `defaultNow()` timestamp, so `asc(createdAt)` alone is not deterministic. |
| 5 | LOW (dev-only) | **`/test-login`'s role cards are `generic` divs, not buttons** — the whole staff/client account grid is unreachable by keyboard and unnamed to assistive tech (`read_page` tree, this run). Dev-only page, so it is not a client-facing WCAG failure, but it is what stopped this run from driving the authenticated UI in a browser. |

---

## What this run did not do

- **The page was never rendered in a browser.** `scripts/browser-probe.cjs` has no cookie or session
  support, so it cannot reach an authenticated route, and driving the UI would have meant typing a
  password into a login form — which this session does not do. The UI evidence here is 7 component
  tests rendering the real `ProgramHeader` against real seeded milestone data, plus the live API
  walk above. **No claim is made about how the page looks at any viewport.** The one layout risk I
  introduced — the longer progress label — is why the row carries `flex-wrap` and `gap-2`; that is a
  design decision, not a verification.
- **The owner agent was not invoked.** `FEATURE_MAP.md` is on `origin/main` (`HAVE_MAP`), so the
  hand-to-the-owner path applied and area 22's owner is `hq-accelerator-owner`. It is **not
  registered in this session** — `.claude/agents` is snapshotted at session start and the 41 owner
  agents merged in #603 (`53044804`) after that snapshot, so no `hq-*-owner` appears in this
  session's agent roster and invoking one would have failed. I read
  `.claude/agents/hq-accelerator-owner.md` from `origin/main` instead and worked to its scope,
  authority chain and definition of done. Its §5.5 integration-lane requirement was met in spirit by
  the live :5002 walk rather than by `pnpm test:integration`, which was not run.
- **`FINDINGS.md` was not edited.** Its own header restricts additions to findings that survived
  `finding-verifier`; mine have not been through it. They are proposed tickets here instead — which
  is also CHARTER §9's channel. The register is additionally in flight in PRs #618 and #607.
- **`pnpm test:integration` was not run** (never part of `pnpm test`; needs its own live server).
- **No fix to the three refused gaps**, for the reasons in the table above.
- **Test data left in the shared dev database.** The live walk enrolled `test-renter`
  (`renter@test.com`) in the accelerator and finished 17 of its 18 milestones. There is no delete
  endpoint for an enrollment, so the row stands: a peer opening `/accelerator` as the aspiring owner
  will find a program already in phase 2 rather than the enrollment screen. Harmless, but it is not
  a pristine fixture and saying so is cheaper than someone re-deriving it.

---

## Peer reports read (CHARTER §4)

`reports/` holds nothing dated 2026-08-20 at the time of this run; the most recent on disk are
2026-08-18 (App Walker, Evening Triage, QA Sweep, Wiring Audit). Today's peer output is in open PRs
rather than merged reports — #625 (primary-engineer), #619 (wiring audit), #618 (journey walk), #616
(trunk health). **WARN, not silence:** all four exist, none has merged, so a `reports/`-only sweep
would wrongly conclude the day was empty. Domains checked for collision before picking: every one of
the 28 open PRs' changed files. The two standing priority segments were both claimed today — income
by #610, the jumbo/conforming boundary by #606 — which is why the rotation moved to a never-reviewed
area instead.

STATUS: OK
