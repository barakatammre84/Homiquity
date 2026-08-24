# Feature Completion Engine — 2026-08-24

**Domain:** 11 — Staff, partner & pipeline ops · **Area:** [FEATURE_MAP](../../handbook/FEATURE_MAP.md) **#15, Task engine and SLA operations** (`Last reviewed: never`)
**Also:** a real race in `tests/intakeActionItems.test.ts` that had been reddening the shared CI gate at random.
**Gap:** `/task/:id` — the only borrower surface that says *which document you sent and what we made of it* — had **zero entry points anywhere in the client**.
**PR:** [#732](https://github.com/barakatammre84/Homiquity/pull/732) (`routine/feature-completion-2026-08-24`)
**Open findings:** 257 before → 257 after (**F-0820-58 closed**, **F-0824-01 opened** — found in passing, in a different area).

STATUS: OK — one unreachable capability given a front door, one open P2 closed, one new P2 recorded and deliberately not fixed, and a flaky test in the shared gate diagnosed to its mechanism and fixed.

---

## ⛔ Human actions

1. **Merge the PR** (L3 — the founder is the only merger).
2. **F-0824-01 needs an owner.** `GET /api/predictions/me` 500s for any borrower whose cohort has data, so `PredictionInsights` never renders on the borrower dashboard. It is area 36 (`hq-data-intel-owner`), not area 15, and the honest fix is a coercion at the read boundary covering all five `sql<number>`-over-`numeric` declarations — not a patch at the one call site that happens to throw. Recorded, not fixed.
3. **Decide whether a borrower task should have a clock.** Not a defect; a product question this run refused to answer for itself — see *Refused*, item 1.

---

## Summary

Area 15 had never had a feature review, and the thing it was missing was not an engine — it was a door. `client/src/pages/borrower/TaskDetail.tsx` is a 500-line page that has been maintained across at least five PRs (#328, #484, #502, #504, #509, #605) and carries its own test file, and the entire client held **two** references to its route: the declaration in `App.tsx:404` and the page's own `useRoute`. Nothing linked to it, so the only borrower answer to *"you said you're reviewing it — reviewing what?"* was to type a URL. Every task row on `/tasks` now links to it — one door per task, wrapping the title only, because a `Link` around a card containing an Upload button would nest two interactive controls and `DESIGN_SYSTEM.md` §12 holds `nestedInteractive` at zero. While in that file, F-0820-58 (open P2 since 2026-08-20) was closed: the page offered Approve/Reject to all 8 staff roles while the server 403s anyone outside the internal 6.

---

## Evidence

### The gap — dated, then measured

```
$ grep -rn "task/" client/src | grep -v "tasks/" | grep -v "\.test\."
client/src/App.tsx:404:        <Route path="/task/:id">
client/src/pages/borrower/TaskDetail.tsx:67:  const [, params] = useRoute("/task/:id");
```

Two references, repo-wide. `git log -S 'TaskDetail' -- client/src/App.tsx` → `f89838cb Initial commit` — the route has never had a linker. `git log --oneline -- client/src/pages/borrower/TaskDetail.tsx` shows five maintenance PRs on it since, including #484's per-document Approve/Reject fix and #605's touch-target pass: **the page was being kept correct the whole time it was unreachable.**

What is on it and nowhere else, for a borrower:

- the documents linked to the task, each with its own verdict (`Verified` / `Pending Review`) and upload timestamp — `TaskDetail.tsx:267-321`;
- the full `documentInstructions`, which `/tasks` shows only as truncated italic text on a rejected row (`Tasks.tsx:492-496`);
- a `Task Complete — your document has been verified` state.

`/tasks`'s two terminal buckets are where this bites hardest. "Under Review" renders the title, a badge, and the words `Awaiting review` (`Tasks.tsx:541-544`); "Completed" renders the title and a badge (`Tasks.tsx:553-580`). Neither has an upload dialog, so before this change there was no route from either to the file.

### Browser proof (local, `http://localhost:5002` — worktree convention; `/api/health` → `commit: null`, the local-dev signature)

Signed in as `buyer@test.com`, at `/task/4860c84a-…`:

> **Upload: Homeowners Insurance Required** · Completed · Normal Priority
> Uploaded Documents — 1 document(s) uploaded for this task
> `chase-statement-jan.pdf` · Jul 17, 2026 at 7:48 AM · **✓ Verified**
> Task Complete — Your document has been verified

`/tasks` after the change, as a borrower with 9 checklist items:

```js
Array.from(document.querySelectorAll('a[href^="/task/"]')).map(a => a.textContent.trim())
// 9 links, one per task: "Letter of Expla…", "Homeowners I…", "Purchase Con…", …
```

At **320 px**: `document.documentElement.scrollWidth` = 320 (no overflow), rows unchanged at 57/69/69 px, and the link hit box measures **42 px** tall — `py-3` on an *inline* anchor grows the hit area without moving the line box, so the tap target nearly clears 44 px while the truncating checklist row keeps its rhythm. A block `.touch-target` (`min-height: 44px`) would have relaid out every row it sits in. Network on both pages: all 200.

### Proof by reintroduction — 8 mutations, 8 caught

| # | mutation | result |
|---|---|---|
| M1 | point the anchor at `/tasks` instead of `/task/:id` (feature removed) | **6 red** |
| M2 | drop the link from the *Under Review* bucket only | **1 red** |
| M3 | drop it from *Completed* only | **2 red** |
| M4 | drop it from the *Document Checklist* only | **2 red** |
| M5 | add a **second** link in the *To Do* bucket (two doors) | **1 red** |
| M6 | drop it from *Needs Your Attention* only | **2 red** |
| M7 | drop it from *To Do* only | **2 red** |
| M8/M9 | widen the verify gate back to `isStaffRole` / over-narrow it to `admin` | **2 red / 11 red** |

M5 is the one worth recording: **the first draft of the one-door test did not catch it.** It exercised only two buckets, so a duplicate link added to a third walked past a `toEqual` assertion that looked exhaustive. The test now puts one task in every bucket at once. That is the same shape as the trap in `knowledge-base/` about source-scanning tests matching their own comments — an assertion is only as strong as the fixture underneath it.

### F-0820-58 — closed

`TaskDetail.tsx:195` computed `canVerify` from `isStaffRole` (the 8-role set) while `PATCH /api/tasks/:taskId/documents/:docId/verify` (`server/routes/task-engine.ts:521-523`) answers `403 "Only internal staff can verify documents"` to anyone outside `isInternalStaff` (6 roles). A broker or lender on a deal team was shown two buttons that could only ever fail.

Fixed by **narrowing the client**, which is the rule `tests/routeGateDrift.test.ts:193` already states in its own words (*"It is fixed by NARROWING the client, never by widening the server"*) — document verification is an underwriting act, and `shared/roles.ts:78-79` records broker/lender as external partners. Pinned **behaviourally**: `TaskDetail.test.tsx` now renders the page as each of the 8 staff roles plus a borrower and asserts which are offered the controls (6 yes, 3 no). The server half is pinned in `routeGateDrift.test.ts`, which had **zero** mentions of this surface — if the server is ever widened, that test fails and forces the decision.

### A third item, unplanned — the shared gate was flaky, and it is not any more

CI went red on this PR in `tests/intakeActionItems.test.ts`, a lane my diff cannot reach (two client
pages, two client tests, one node test that only *reads* server source, and docs). `main` was green
on the identical base commit, and re-running the failed job passed — **37 steps, a real run, not a
billing corpse**. That is the point where the honest options are "call it a flake and move on" or
"find out". CHARTER §5's assist ladder says a red gate is never someone else's job, so:

The test polls `GET /api/applications/:id/action-items` until `items.length > 0`, then asserts a
**document** item exists. Those are not the same condition. The consent item is built from the
consents table (`server/routes/lending/dashboard.ts:338-350`) and therefore exists the instant the
application row does, because a fresh file has no `disclosure`/`privacy_policy` consent — while the
document items come from tasks `initializeLoanPipeline` writes afterwards. Sampling the live
endpoint every 100 ms after the 201:

```
create 201
t=0ms    items=1   documents=0  types=[consent]
t=100ms  items=10  documents=9  types=[document,consent]
```

**The window is real and the first sample is inside it.** On a loaded runner the poll returns at
t=0 and the next line fails on a file that was about to be correct. Fixed by polling for the
document item rather than for a non-empty list — a strict tightening, and it still fails (through
`pollUntil`'s timeout) if the document tasks never arrive, which is the regression the test exists
for. **Mutation-proven:** point the poll at a type that never appears → `Timed out waiting for
document action items for an under_review file`, red. Verified against the local server, restored,
green.

### Gates

```
pnpm check                                            → 0 errors
pnpm test                                             → node 231 files / 3,373 tests · client 125 files / 861 tests · 0 orphans, all lanes ran every file on disk
pnpm guard:tokens querykeys schema migrations kb docs ui → all OK (nestedInteractive 0, subMinTouchTarget 0, both at baseline)
pnpm build && pnpm guard:bundle                       → 526,640 raw bytes, at baseline, no regression
security-review-guard (CHANGED_FILES, newline-separated) → no §9 trigger among 3 changed files
```

No schema change, no migration, no dependency change, no regulated math, no server code touched except a test's read of it.

---

## Refused, and why

1. **Did not give borrower tasks an SLA or a due date.** Measured against the local database: of **1,403** `BORROWER`-owned tasks, **0** carry a `task_type_code`, **0** a `sla_due_at`, **0** a `due_date` — every one is created by `pipelineEngine.generateDocumentTasks` through `storage.createTask`, which bypasses `taskEngine.createTask` and therefore the whole seeded 22-row SLA mapping. `computeSlaStatus` (`server/services/taskEngine.ts:157-160`) returns `green, timeRemaining: null` for all of them, and the dashboard card renders that honestly as no due line. So the SLA engine is real, seeded, and applies to **no borrower task**. It was not wired up here, because putting a deadline in front of a borrower is a promise with consequences attached and *"never invent a service tier we do not offer"* binds — that is a founder call, not a routine's.
2. **Did not add a staff entry point to `/task/:id`.** The page's staff half is also unreachable by navigation (its Back button goes to `/staff-dashboard`, but nothing sends anyone there). Staff have `DocumentReviewPanel` as their own review surface; whether TaskDetail's staff half is a needed second door or a duplicate to retire is an area-15/area-11 question that wants a decision, not a link. One gap, one PR.
3. **Did not fix F-0824-01.** Area 36, different owner, and the correct fix touches five declarations rather than the one that throws.
4. **Did not touch the `/tasks` ↔ dashboard-card query split.** `/tasks` reads `/api/tasks` (by `assignedToUserId`); the dashboard card reads `/api/task-engine/applications/:id/borrower-tasks` (by `applicationId` + owner role). They agree today — checked: **0** borrower tasks assigned to anyone but the application owner, and the 268 staff transparency rows the card shows are deliberately not the borrower's work. But `taskEngine.createTask` never writes `assignedToUserId`, so a `BORROWER`-owned task created through `POST /api/task-engine/tasks` would appear on the card and **not** on `/tasks`. No such row exists yet. Recorded here rather than pre-emptively patched.

---

## Proposed tickets

- **T1 (area 36, P2)** — fix F-0824-01 at the read boundary in `predictiveEngine.ts`: coerce all five `sql<number>` declarations over `numeric` (`:205`, `:328-331`) rather than patching `:235`.
- **T2 (area 15, product)** — decide whether borrower document tasks get an SLA class and a visible due date, and if so which. Everything needed is already built and seeded; only the policy is missing.
- **T3 (area 15/11)** — decide whether `/task/:id`'s staff half is kept (give it an entry point from the staff queue) or retired in favour of `DocumentReviewPanel`.
- **T4 (area 15, P3)** — make `taskEngine.createTask` set `assignedToUserId` for `BORROWER`-owned tasks, or make `/api/tasks` read by owner role, so the two borrower task surfaces cannot diverge.

STATUS: OK
