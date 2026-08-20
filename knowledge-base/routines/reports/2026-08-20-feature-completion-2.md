# Feature Completion Engine — 2026-08-20 (second run, founder-directed)

**Domain:** 12 — Property, listings & homeowner · **area 22, Homebuyer accelerator**.
**Gap:** the two the first run ([#632](https://github.com/barakatammre84/Homiquity/pull/632)) refused
and escalated. **PR:** [#641](https://github.com/barakatammre84/Homiquity/pull/641) — **DRAFT, §9 tripped.**

STATUS: WARN — the work is complete and proven live, but it ships as a draft: `detectTriggers()`
returns a role/permission-gate trigger, and the security review is human-authored, never mine.

---

## ⛔ Human actions

1. **Write the §9 security review on [PR #641](https://github.com/barakatammre84/Homiquity/pull/641), or reject it.** The diff adds two role-gated staff
   routes (`requireRole("admin","lo","loa")`), which is a TEAM_PRACTICES §9 trigger. Evidence for
   the reviewer — the gates, and the live 403/409 probes against them — is in the PR body under
   *Access-control evidence*. **That section is deliberately not headed "Security review":** the
   guard passes on the presence of that heading, and a routine writing it would be self-certifying
   the exact control it is subject to.
2. **Merge is yours** (or the drain's). CI cannot help here — the `gate` check has been failing in
   ~2 seconds with `steps: []` since the Actions billing lapse, and the founder's minutes reset in
   roughly two weeks. **In this window a green check and a red check both mean nothing**; the only
   evidence is the local gate recorded below.
3. **An NMLS question I will not answer from memory.** Whoever takes these sessions is presented to
   the borrower as "a loan officer from our team". If the conversation reaches loan terms, whether
   that person must be a licensed/sponsored MLO is a `docs/nmls/` question, and CLAUDE.md forbids
   answering it from memory. The copy deliberately does **not** claim the person is licensed.

---

## Summary

The founder answered both escalations: yes, staff the 1:1 — with a **loan officer**, and mind the
word *coaching* — and yes, open the door. So the request now reaches a human instead of a table
nobody read. A borrower can only ever create a `requested` session: the status is server-decided,
the body is validated, and a datetime already in the past is refused. The request fans out in-app to
the admin/lo/loa desk, and a **1:1 requests** card in the LO Command Center lets a loan officer
confirm it, which puts their name on the record and shows it to the borrower. Only then did the
program get its doors — the aspiring-owner sidebar and the RenterHome toolkit — because a link to a
surface that promises what it cannot keep is worse than no link.

---

## Evidence — the whole loop, live on :5002 against real Postgres

`GET /api/health` → `commit: null` (the local-dev signature). Three real sessions:
`renter@test.com` (aspiring_owner), `lo@test.com`, `loa@test.com`.

| # | probe | result |
|---|---|---|
| 1 | borrower requests a time in 2020 | **400** — `"Please pick a date and time in the future."` |
| 2 | borrower posts `status:"confirmed"`, `assignedToUserId:"test-renter"` | stored as **`status='requested'`, `assignedToUserId=None`** — the escalation is dropped, not echoed |
| 3 | LO reads the pending queue | **1 waiting** — `Aspiring Owner \| requested \| Down payment plan` |
| 4 | borrower reads the staff queue | **403** |
| 5 | borrower confirms their own session | **403** |
| 6 | LO confirms | `status=confirmed`, `assignedToUserId=test-lo`, `confirmedAt=2026-08-20T19:53:00.190Z` |
| 7 | a **second** LO confirms the same session | **409** — `"Another loan officer has already confirmed this session."` |
| 8 | LO re-reads the queue | **0** — it drains, because it is pending-only |
| 9 | did a human actually get told? | LO's `/api/notifications` carries 1 × `accelerator_session_requested`: *"Aspiring Owner asked for a 1:1 … Nothing is booked until a loan officer confirms it"* |
| 10 | what the borrower now sees | `status=confirmed  assignedTo=test-lo` — the two surfaces agree |

Row 2 is the one that matters: it is the old defect posed as an attack, and the product refuses it.

### Proven by reintroducing each bug

| mutation | result |
|---|---|
| `status: req.body.status ?? BORROWER_CREATED_SESSION_STATUS` | **1 failed** — *"the create route sets the status itself and never reads it from the body"* |
| restore the toast *"Coaching session has been scheduled."* | **2 failed** — the booking claim and the loan-officer-not-coach copy |

Both reverted; 14/14 green.

### Gate (local — the only evidence available this fortnight)

```
pnpm check (tsc --noEmit)   0 errors
node lane                   see PR body (incl. tests/acceleratorSessionRequests.test.ts, 14)
client lane                 see PR body
guard:schema / guard:migrations   OK — 58 migrations, contiguous idx 0..57
§9 detectTriggers()         role/permission gates  ⇒ DRAFT PR
```

`pnpm db:migrate` was run against the local dev DB to apply `0057`. **Never `db:push`** — the script
is blocked in this repo and prints why.

---

## What this run deliberately did not do

- **No email and no SMS.** A borrower is told in the UI that a loan officer will confirm; nothing is
  sent to them, and nothing is sent to staff outside the app. An outbound leg is a new messaging
  surface and a §9 trigger. This followed `complaintEscalation.ts` (in-app only, and its header
  explains the same choice) rather than `leadNotifications.ts`, which does have an email leg.
- **No `NotificationsPanel.tsx` change.** `entityType` values outside its href map land on
  `/dashboard`, so `accelerator_session` needs a mapping — but that file is claimed by open
  **PR #634**, and racing a claimed file is exactly what the register exists to prevent. The
  notification body names the destination in words as the interim, and the mapping is a proposed
  ticket below. Stated plainly because it is a known rough edge, not an oversight.
- **The table and the API path keep the word `coaching`.** `coaching_sessions` and
  `/api/accelerator/coaching` are unchanged: renaming a table is a contract migration, and the wire
  is not what a borrower reads. Every borrower-visible string now says *loan officer*, and a test
  pins that.
- **The page was never rendered in a browser** — `scripts/browser-probe.cjs` has no session support,
  and reaching an authenticated route would mean typing a password into a login form. **No claim is
  made about how any of this looks at any viewport.**
- **`pnpm test:integration` was not run.**
- **Test data left in the shared dev DB**: `test-renter` now has one confirmed session assigned to
  `test-lo`, on top of the enrollment the first run left at 17/18 milestones.

---

## Proposed tickets — for Evening Triage

| # | rank | ticket |
|---|---|---|
| 1 | MEDIUM | **Map `accelerator_session` in `NotificationsPanel.tsx`'s href derivation** so the bell item opens the LO Command Center instead of `/dashboard`. Blocked today only by PR #634 holding that file. Same latent problem already affects `entityType: "lead"`, which `leadNotifications` has been writing since it shipped — worth fixing both in one pass. |
| 2 | MEDIUM | **`GET /api/leads` and `GET /api/leads/:id` have zero client callers.** Staff cannot see leads anywhere; the bell is the only channel, and it dead-ends. The same shape as the accelerator defect, one surface over. |
| 3 | LOW | **`POST`/`PUT /api/accelerator/enrollment` still pass `req.body` straight to storage** — carried forward from the first run's report, still open. The session routes are now validated; the enrollment routes are not. |
| 4 | LOW | **A confirmed session has no cancel or reschedule path** for either side. Confirming is now real, so the next honest gap is un-confirming. |
---

## Addendum — the session lifecycle (same PR, founder said "go")

The first cut of this shipped `requested` → `confirmed` and stopped, which left **three of the five
statuses unreachable**: nothing could write `completed`, `cancelled` or `no_show`. A confirmed
session was frozen for good — neither side could decline, cancel or move it — so the borrower's page
would go on showing a confirmed meeting for a date that had already passed. That is the same defect
class the request → confirm split fixed, one step later in the flow, and it is the answer to the
founder's *"what is missing"*.

**Transitions are now a table, not scattered `if`s** (`SESSION_TRANSITIONS` in
`shared/acceleratorProgram.ts`), because the interesting rule is *who may make each move* and that
is exactly what branching code loses. Both the routes and the borrower's buttons read it, so **a
control can never exist for an action the server would 409**.

| from → to | who |
|---|---|
| `requested` → `confirmed` | staff |
| `requested` → `cancelled` | staff (decline) or borrower (withdraw) |
| `requested` → `requested` | borrower (move the time) |
| `confirmed` → `requested` | borrower (moving re-opens the ask) |
| `confirmed` → `cancelled` | either |
| `confirmed` → `completed` / `no_show` | staff |
| anything out of a terminal state | **nobody** |

Two rails worth naming:

- **Moving a time re-opens the ask.** A loan officer agreed to a *slot*, not to the borrower's
  calendar, so a rescheduled session returns to `requested` and to the desk queue with `confirmedAt`
  cleared. It does **not** stay confirmed at a time nobody on our side has agreed to — that would be
  the original lie, rebuilt.
- **A meeting cannot be reported before it starts.** `outcomeIsReportable` gates `completed` and
  `no_show`, the only pair of transitions that makes a claim about the past.

**`completed`/`no_show` are reachable from the UI**, not just the API: the LO Command Center card
grew a second section listing that officer's own confirmed sessions. Without it those statuses would
have existed in the vocabulary and in the routes and been unwritable from any screen — the exact
"engine nobody can reach" defect this program keeps producing.

**And the notification now runs both ways.** The first cut told staff a request existed and left the
borrower to find out by revisiting the page. Confirm, decline and outcome all notify the borrower;
the borrower cancelling or moving notifies the assigned loan officer. Still in-app only.

### Live proof — every transition, on :5002 against real Postgres

```
A. the LO DECLINES a request
   decline                 -> cancelled
   borrower cancels it too -> HTTP 409 | This session is already cancelled.
B. the BORROWER withdraws their own request
   withdraw                -> cancelled
C. the BORROWER moves a CONFIRMED session
   after the move          -> status=requested confirmedAt=None assignedTo=test-lo
   back in the LO queue?   -> True
D. reporting an outcome BEFORE the meeting starts
   mark done early         -> HTTP 409 | This session has not started yet.
E. outcome once the meeting has started
   mark done               -> HTTP 200 | status=completed completedAt=2026-08-20T21:12:38.757Z
   change it afterwards    -> HTTP 409 | This session is already completed. (terminal)
   still in the LO's list? -> False
F. a DIFFERENT loan officer tries to report on it
   loa reports on lo's     -> HTTP 409 | This session belongs to another loan officer.
G. what the BORROWER was told
   borrower notifications  -> 6   (accelerator_session_confirmed, _completed, …)
```

Row E is the pair that had no writer at all before this.

### Proven by reintroducing each rail

| mutation | result |
|---|---|
| add `cancelled → requested` to the table | **1 failed** — *"cancelled, completed and no_show have no way out"* |
| replace the clock rail with `if (false)` | **1 failed** — *"the outcome route enforces it"* |
| add `requested → completed` for staff | **1 failed** — *"an outcome cannot be reported on a session nobody confirmed"* |

All three reverted; 19/19 green.

### Still missing after this

- **The financial snapshot is 100% self-reported.** `FinancialUpdateDialog` has no `useQuery` at
  all — nothing prefills credit score, DTI or savings from data the platform already holds, while
  `FEATURE_MAP`'s intent line for this area says *"the borrower's own data, not an estimate dressed
  as one."*
- **No staff can see the plan.** An LO confirms a call with no way to see the borrower's 18
  milestones, phase or financials first; `/borrower-file/:id` is application-shaped.
- **Both enrollment routes still take raw `req.body`** (`createAcceleratorEnrollment({...req.body})`,
  `updateAcceleratorEnrollment(id, req.body)`) — no Zod, no `userId` strip. Flagged three times now,
  fixed none of them; it is a different gap and folding it in would muddy this diff.
- **Milestones still render backwards** (`orderBy(desc(createdAt))`), and there is no way to leave
  the program.
- **`NotificationsPanel` still has no `accelerator_session` href**, so both directions' bell items
  land on `/dashboard`. Blocked on PR #634 holding that file.


STATUS: WARN
