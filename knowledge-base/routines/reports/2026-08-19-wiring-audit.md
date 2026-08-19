# Frontend Wiring Audit — 2026-08-19

STATUS: WARN — one capture-path defect found and fixed on branch (the URLA progress bar described
the open borrower tab while claiming to describe the application), proven by reintroduction, every
gate green. WARN because the run's other two findings are **not mine to land**: the funnel's server
draft silently discards three captured answers (a `server/**` whitelist, CHARTER §6b's lane), and
PR #587 is red for a reason that is a peer's branch to fix.

## ⛔ Human actions

1. **Review and merge this branch's PR** — `claude/agitated-chatterjee-af3449`. One fix, one file,
   three new colocated tests. Not merged, not auto-merged (CHARTER §8).
2. **PR #587 is red, and the cause is three files that do not belong to it.** Its gate fails on
   `guard:bundle` (+109 eager bytes) — not from its calculator change, but because the branch
   carries a **superseded copy of #596's ux-30 work**: `routeGates.ts` and `LoanDetails.tsx` are
   byte-identical to #596 (`git patch-id` match), and `App.tsx` carries the *earlier* `DisclosurePage`
   wrapper that #596 deliberately replaced with an inline gate to avoid those very bytes. #587's own
   body says it "branches off current `main` and needs nothing from it", so the three files are
   unintended. Restoring them turns it green:

   ```bash
   git checkout fix/calculator-mobile-overflow && git checkout origin/main -- client/src/App.tsx client/src/lib/routeGates.ts client/src/pages/borrower/borrowerDashboard/LoanDetails.tsx
   ```

   Not done here: pushing to another session's branch needs it stalled *and* its owner unreachable
   (CHARTER §5, "assist without hijacking"), and this is an unattended run — a wrong call would
   rewrite someone's stack silently.
3. **Decide who lands the draft-autosave whitelist gap** (Break point 2 below). It is three names in
   an array in `server/routes/lending/statusDecisions.ts`, and §6 puts `server/**` outside this
   routine's territory — §6b assigns backend payload correctness to the **Backend Data Engineer**
   (daily 11:00Z). The exact patch is written out below so that run costs nothing to start.

## Summary

Traced the capture path end to end (calculators → `?type=`/`?state=` entry links → `/apply` funnel
→ licensed-state gate → auth gate → deferred submit → server draft → restore → URLA → save) and
found three breaks, all invisible from either end. The one I could land: the URLA progress bar is
labelled "Application progress" but counted only the borrower tab you had open, so it read "5 of 7"
with a co-borrower's six sections empty and fell to "1 of 7" the instant you switched tabs — the
higher reading being the one that stops a borrower filling the rest in. The second is a server
whitelist that drops three funnel answers on every autosave, including the two VA residual-income
inputs and the one field the restore path *reads back* — proof the two sides of that wire disagree.
The third is PR #587's red gate. **The licensed-state gate, by contrast, holds under attack**: I
tried to walk a `?state=CA` deep link past it and could not (no Continue button on that step,
`Enter` excluded, auto-advance gated) — worth recording because it is the shape of defect this
routine keeps finding elsewhere. No browser verification: dev servers cannot start in an unattended
run (CHARTER §10) — this is test, typecheck and guard evidence only.

## Wiring map (the path audited)

```
calculators / rates LPs ──?type= ?price= ?state=──┐
                                                  ▼
                                        /apply  PreApproval.tsx
                         defaultValues ← url params
                         StateStep ── isLicensedState() gate ✓ HOLDS (no Continue button,
                                       Enter excluded, auto-advance gated)
                                                  │
                  authenticated ──► useServerDraftAutosave (debounced PATCH)
                                       buildDraftPatchPayload  → sends 3 fields …
                                                  ▼
                            PATCH /api/loan-applications/:id
                            loanApplicationIntakeUpdateSchema  ✓ validates them
                            UPDATABLE_COLUMNS whitelist        ✗ ★ BREAK 2 — drops them
                                                  ▼
                                        draft row (3 answers missing)
                                                  │
                     useDraftRestore ── draftToFormValues reads avoidsInterestFinancing
                                        back off a column nothing ever wrote  ← same break,
                                                  │                             other side
                     unauth at final ─► PENDING_SUBMIT + localStorage ─► signup ─► deferred submit
                                                  ▼
                            POST /api/loan-applications (consumes the draft; writes all 3) ✓
                                                  ▼
                                          /urla  URLAForm.tsx
                          per-borrower slices 1|2 ── stepContext = ACTIVE slice
                          progress bar "Application progress" ← ★ BREAK 1
```

## Break points

### CRITICAL — 1. "Application progress" measured the tab you had open (FIXED, this branch)

`stepContext` is built from `slice`, the **active** borrower's data, and the progress bar is
computed from it while being labelled `Application progress` in its `aria-label` and rendering
"N of M sections complete" as its visible text.

On a file with a co-borrower this gives one fact two answers:

- open on the primary with their sections done → **"5 of 7 sections complete"**, a nearly full bar,
  while the co-borrower's six sections are empty;
- click **Co-Borrower** → the same bar reads **"1 of 7"**. Finished work rendering as less progress
  (DESIGN_SYSTEM §13 Agreement; the same class as the `TaskProgress` denominator fixed 2026-08-18).

The higher reading is the harmful one. URLA is what the ULDD/URLA package is built from (CHARTER §1
question A), and a borrower told their application is nearly done has no reason to open the other
tab. Reachable in the ordinary direction too: `Add Co-Borrower` sets `activeSeq = 2`, so a couple
filling the co-borrower's sections first sees a bar that describes only them.

**Evidence (pre-fix):**
- `client/src/pages/borrower/URLAForm.tsx:568` — `const stepContext: StepContext = { slice, … }`,
  where `slice = borrowerData[activeSeq]` (`:247`).
- the line this fix replaced, one below it: `const completedCount = STEPS.filter((s) => s.isComplete(stepContext)).length`
  — `git show origin/main:client/src/pages/borrower/URLAForm.tsx | sed -n '561p'`.
- `client/src/pages/borrower/URLAForm.tsx:637` — the bar's `aria-label` still opens
  `Application progress:`, which is the claim the count has to earn.
- `client/src/pages/borrower/URLAForm.tsx:682-683` — `setHasCoBorrower(true); setActiveSeq(2)` on
  **Add Co-Borrower**, which is what makes the 7/7 → 0/7 transition a two-click path.
- Six of the seven steps read `slice` (`:127,136,144,152,169,177`); only `property` reads
  `propertyInfo`/`app` (`:160`) — so the file genuinely has 6 sections per borrower plus 1 shared.

**The fix (landed):** the bar counts the whole application — every per-borrower section once per
borrower, the shared property/loan section once — so the number cannot change with the tab and the
numerator only ever rises. Adding a co-borrower raises the *denominator* (7 → 13), which is the
truth about the work the file now needs, and the copy names the scope. The rail's per-step check
marks are unchanged and stay per-borrower: the "Editing for:" control above them already says whose.

**Proven by reintroduction.** Restoring `STEPS.filter((s) => s.isComplete(stepContext)).length`:

```
× counts the co-borrower's unfinished sections instead of reporting the file nearly done
    expected '5 of 7 sections complete — you and yo…' to contain '5 of 13 sections complete'
× does not change when the borrower switches tabs — one file, one number
    expected '1 of 7 sections complete — you and yo…' to contain '5 of 13 sections complete'
  Tests  2 failed | 7 passed (9)
```

Exactly the two co-borrower assertions red, reading the bug verbatim. Restored: 9 passed. A third
test pins the single-borrower file at 7 so the denominator cannot drift for everyone else.

`URLA_FORM_REFACTOR_TRAP.md` respected: no move of `STEPS`/`buildPayload`/hydration, no
memo/useCallback/debounce, the `hasCoBorrower` latch untouched.

### CRITICAL — 2. The funnel's server draft silently discards three captured answers (NOT LANDED — §6b lane)

`buildDraftPatchPayload` sends every non-empty answer on every debounce. The PATCH schema
**validates** all of them. The route then copies only a fixed whitelist onto the row, and three
funnel fields are not on it:

| Field | What it is | Column |
|---|---|---|
| `householdFamilySize` | VA residual income, 38 CFR 36.4340(e) | `household_family_size` |
| `homeSquareFootage` | VA residual income, same rule | `home_square_footage` |
| `avoidsInterestFinancing` | the UAL P7 routing preference the borrower opted into | `avoids_interest_financing` |

**Evidence:**
- `server/routes/lending/statusDecisions.ts:78-84` — `UPDATABLE_COLUMNS`, and `:86-89`, the loop
  that copies only those keys. Unchanged since the #202 registrar split; the three fields were all
  added to the funnel afterwards.
- `shared/preApprovalForm.ts:164,174,180` — all three are `preApprovalFormBaseSchema` fields, so
  `loanApplicationIntakeUpdateSchema` (`shared/schema/lendingUrla.ts:641-663`, `.partial()` over
  that base) accepts them. They are dropped **after** passing validation, which is why nothing 400s
  and nothing is logged.
- `shared/schema/lendingCore.ts:88,93,94` — all three are real columns.
- `client/src/pages/lending/preApproval/useServerDraftAutosave.ts:36-46` — the payload builder omits
  only empties and `hasAdditionalIncome`; these three travel on every tick.
- `client/src/funnel/preApprovalMachine.ts:176` — the two VA steps are injected for any borrower
  reporting military service, so this is the veteran path, not an edge case.
- **The two sides of the wire disagree, in code:**
  `client/src/pages/lending/preApproval/useDraftRestore.ts:66` restores
  `avoidsInterestFinancing: !!draft.avoidsInterestFinancing` — reading back a column no draft path
  can ever write. It resolves to `false` every time, so an explicit opt-in returns as a silent "no".
- Nothing else writes them to a draft either: `COACH_WRITABLE_FIELDS`
  (`server/services/coachProfileSync.ts:72-84`) excludes all three, and the only writer is the
  intake POST (`server/routes/lending/applications.ts:79-84`), which flips the row out of `draft`
  in the same call.

**Impact:** a borrower who fills the funnel and resumes later loses these answers. The two VA
inputs are then re-asked (the restore walks from `loanPurpose`), so the visible harm there is
friction — but `avoidsInterestFinancing` comes back **unchecked**, sitting beside `isVeteran` and
`isFirstTimeBuyer`, which *do* restore correctly, under a toast reading "We loaded your saved
progress". One step, three checkboxes, two honest and one silently reset.

**The patch, for whoever owns it** — `server/routes/lending/statusDecisions.ts:78-84`:

```diff
       const UPDATABLE_COLUMNS = [
         "annualIncome", "monthlyDebts", "creditScore", "employmentType",
         "employmentYears", "propertyType", "purchasePrice", "downPayment",
         "loanPurpose", "isVeteran", "isFirstTimeBuyer", "propertyState",
         "employerName", "propertyAddress", "propertyCity", "propertyZip",
-        "incomeSources",
+        "incomeSources", "householdFamilySize", "homeSquareFootage",
+        "avoidsInterestFinancing",
       ] as const;
```

Note for that run: the two VA fields are `integer` columns and the update schema hands them over as
**strings** (`stringifyIntakeScalars`), so unlike the other whitelist entries they need the same
`parseInt` the intake route does (`applications.ts:82-83`) — copying them straight through would
write a string into an integer column. `draftToFormValues`
(`client/src/pages/lending/preApproval/useDraftRestore.ts:44-68`) also needs the matching two lines
to read them back; that half is `client/src/**` and this routine will land it the moment the server
half exists. Landing the client half alone today would be inert, and inert-but-plausible is how the
`avoidsInterestFinancing` line above came to exist in the first place.

**Why it is not fixed here:** CHARTER §6 scopes this routine to `client/src/**`, and §6b assigns
backend payload correctness to the Backend Data Engineer, which fires daily at 11:00Z. Reported
rather than taken.

### MEDIUM — 3. PR #587's gate is red on three files that belong to PR #596

See ⛔ 2. `guard:bundle` FAIL, +109 raw eager bytes over the 523,176 baseline
(`gh run view --job 95888447793 --log-failed`). #587's own diff against `main` carries
`App.tsx`, `routeGates.ts` and `LoanDetails.tsx` alongside its nine calculator className changes;
`git patch-id --stable` makes two of the three byte-identical to #596, and the third is #596's
superseded `DisclosurePage` wrapper — the one #596's own comment says it inlined to save "56 extra
bytes on the eager entry every visitor downloads".

**Probable mechanism, worth a trap:** the **primary checkout** (`/Users/ammrebarakat/Developer/Homiquity`)
is currently on `feat/landing-coach-first` with those exact three files dirty in the working tree.
A session that committed from the primary checkout rather than from its worktree would sweep them
into whatever branch it was on. I hit the same trap from the other direction this run — see below.

### LOW — 4. The licensed-state gate holds (no defect; recorded so the next run does not re-audit it)

`LICENSED_STATES = ["IL"]` (`shared/companyIdentity.ts:120`) and `stepGate` has **no**
`propertyState` case (`client/src/funnel/preApprovalMachine.ts:316`, `default: return GATE_OK`), so
the gate lives entirely in the UI — which is the shape that usually fails. It does not:
`?state=CA` prefills the combobox (`PreApproval.tsx:138`), the notice renders
(`StateStep.tsx:83-102`), auto-advance is gated on `isLicensedState` (`:63`), the Continue button is
**not rendered** for `type === "state"` (`PreApproval.tsx:850`), and `Enter` is excluded for that
step (`:450`). There is no path from an unlicensed state to the FCRA acknowledgment on the final
step. Illinois launch (§1a) is unaffected.

## What I could not verify

- **No browser evidence.** Dev servers cannot start in an unattended run (CHARTER §10); nothing here
  was rendered in a real viewport, and `scripts/browser-probe.cjs` was not run.
- **Break 2 is proven by reading the code path, not by exercising it** — no DB was touched. The
  claim rests on the whitelist, the schema and the column list, all cited above.

## Evidence — gates

```
pnpm check                                            → tsc, 0 errors
pnpm test  (node lane)                                → 203 files, 3000 passed | 1 skipped
pnpm test  (client lane)                              → 104 files, 683 passed
vitest client URLAForm.test.tsx                       → 9 passed (3 new)
pnpm guard:querykeys                                  → reachability OK · transport OK
pnpm guard:tokens                                     → 0 raw palette / 97 bare literals, at baseline
vitest tests/clientSchemaImports.test.ts              → 10 passed
pnpm build && pnpm guard:bundle                       → 523,176 raw, at baseline (no eager growth)
detectTriggers(changedFiles, changedLines)            → []  (CHARTER §10 — run, not read)
```

## Trap found this run — the worktree/primary-checkout mixup

Every `cd /Users/ammrebarakat/Developer/Homiquity && …` from inside a worktree session reads and
writes the **primary checkout**, which is on someone else's branch with someone else's uncommitted
edits. My first attempt at the new tests appended 107 lines to the primary checkout's
`URLAForm.test.tsx`; the worktree's test run then reported "6 passed" with none of them collected,
which is the only reason I noticed. Reverted with `git checkout --` on that one file after checking
the diff contained nothing but my own addition (the peer's three dirty files untouched), and every
file I had read that way was re-verified identical to `origin/main` with
`git diff --quiet origin/main <primary-HEAD> -- <path>` before its evidence was used. Break 3 above
is very likely the same trap, committed instead of caught.

## Proposed tickets

1. **`server/**` — land the `UPDATABLE_COLUMNS` patch in Break 2**, with the `parseInt` note, plus a
   route test that PATCHes all three fields and reads them back. Owner: Backend Data Engineer (§6b).
2. **`client/src/**` — restore the two VA fields in `draftToFormValues`**, once ticket 1 lands.
   Owner: this routine, next run.
3. **Delete `avoidsInterestFinancing` from `draftToFormValues` if ticket 1 is rejected.** A line that
   reads a column nothing writes is worse than an absent line: it makes the round-trip look closed.
4. **#587: drop the three ux-30 files** (⛔ 2). Owner: whoever owns that branch.

## Register

Claim added `2026-08-19T13:20Z`, released in this PR (CHARTER §5.6). No overlap: `URLAForm.tsx`
appears in none of the seven open PRs' file lists, and the only active claim (F-077 FHA leg) is
`server/services/**`.

STATUS: WARN
