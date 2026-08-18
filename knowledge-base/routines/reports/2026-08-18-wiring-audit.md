# Frontend Wiring Audit — 2026-08-18

STATUS: OK — three capture-path defects found and fixed on branch, all of the "silent success"
class, each proven by reintroducing the bug. Every gate green; nothing merged. Includes a
completed sweep for the #451 pattern (this report's own ticket 4), run at the founder's request.

## ⛔ Human actions

1. **Review and merge the branch's PR** — `claude/interesting-goodall-351b8b`. It carries the two
   fixes below. Not merged, not auto-merged (CHARTER §8).
2. **Sequencing note for whoever merges refactor-radar's [#530](https://github.com/barakatammre84/Homiquity/pull/530)/[#532](https://github.com/barakatammre84/Homiquity/pull/532):** they touch
   `URLAForm.tsx` at the `STEPS`/`StepContext` block (≈L84-116); this run touches
   `describeUnsavedRows()` (≈L300-340). Disjoint hunks, ~200 lines apart — whoever merges second
   takes both. No conflict expected; no rebase needed either way.
3. **Decide on `?type=investment`** (proposed ticket 1). It is a product gap, not a wiring bug:
   the funnel captures **no occupancy field at all**, so the CTA on `/` that says "investment
   property" hands the funnel an intent with nowhere to land. Occupancy drives LLPA pricing and
   lender eligibility, and adding it needs `shared/schema/**` + a migration — off-limits to this
   routine.

## Summary

Traced the capture path end to end again (calculators → `?type=`/`?price=` entry links → `/apply`
funnel → auth gate → deferred submit → draft restore → URLA → save) and found the two defects
below, both invisible from either end. The #451 "tell the borrower what the save dropped" fix had
been written for the **primary borrower only**, while `buildPayload()` filters *both* slices — so a
co-borrower's half-filled asset was dropped, reported as "Everything is safely stored", and then
erased from the screen by the post-save refetch. Separately, `/rates/cash-out` links to
`/apply?type=cashout` from three CTAs while the funnel matched only `heloc`, so a cash-out inquiry
opened with **Buying a Home** preselected. Both are now fixed with tests that were each verified to
fail against the previous code. No browser verification: dev servers cannot start in an unattended
run (CHARTER §10) — this is test-and-typecheck evidence only.

## Wiring map (the path audited)

```
calculators ──writeCalculatorPrefill (sessionStorage)──┐
public LPs / rates ──?type= ?price= ?state= ?propertyId=┤
                                                        ▼
                                              /apply  PreApproval.tsx
                                    defaultValues ← url params  ← ★ BREAK 2
                                    useCalculatorPrefill (gap-fill only)
                                    useCoachPrefill
                                                        │
                                    unauth at final step│ → PENDING_SUBMIT + autosave (localStorage)
                                                        ▼
                                          signup → getPostAuthRoute → /apply
                                              useDeferredSubmit (claim-then-arm, exactly-once)
                                                        │
                                    POST /api/loan-applications (invite id, FCRA consent)
                                                        ▼
                                    draft row ── useDraftRestore / useServerDraftAutosave
                                                        ▼
                                        /urla  URLAForm.tsx
                              hydrate ← urlaKeys.detail   buildPayload() → POST /api/urla/:id/save
                                        describeUnsavedRows()  ← ★ BREAK 1
                                        invalidate urlaKeys.detail + loanApplicationKeys.detail (TRID)
```

## Break points

### CRITICAL — 1. The co-borrower's dropped rows were reported to nobody

`buildPayload()` filters **both** borrower slices through `isUrlaRowSaveable`, which drops any row
the database would reject (`urla_assets.account_type` and `urla_liabilities.liability_type` are
`NOT NULL`). #451 made that honest — but only for slot 1.

**Evidence (pre-fix):**
- `client/src/pages/borrower/URLAForm.tsx:302-306` — `describeUnsavedRows()` read
  `borrowerData[1]?.employmentRecords`, `borrowerData[1]?.assets`, `borrowerData[1]?.liabilities`
  and nothing else.
- `client/src/pages/borrower/URLAForm.tsx:425-427` — `if (hasCoBorrower) payload.coApplicants =
  [buildSectionsPayload(borrowerData[2] ?? emptySlice())]`, and `buildSectionsPayload` applies the
  identical `isUrlaRowSaveable` filter (`:404-407`).
- `shared/lib/urlaRowContent.ts:70-73` — the required-field table the filter enforces.
- `client/src/pages/borrower/URLAForm.tsx:380` — the post-save `invalidateQueries(urlaKeys.detail)`
  rehydrates from the server, which never received the row, so the screen loses it too.

**The failing state, reproduced:** with the fix reverted, the toast reads verbatim
`"Everything is safely stored — you can pick this up anytime."` while the co-borrower's asset row
is absent from the payload. Both the assertion and the received string are in the run output below.

Ranked CRITICAL on **both** acceptance questions: co-borrower assets and liabilities are qualifying
data, so the delivered file understates the borrowers (question A), and the borrower is told the
opposite of what happened (question B).

### MEDIUM — 2. `/rates/cash-out` spoke a `?type=` the funnel did not accept

**Evidence (pre-fix):**
- `client/src/pages/lending/PreApproval.tsx:105` — `const defaultLoanPurpose = urlType ===
  "refinance" ? "refinance" : urlType === "heloc" ? "cash_out" : "purchase"`.
- `client/src/pages/rates/CashOutRates.tsx:119,132,148` — three CTAs to `/apply?type=cashout`.
- `client/src/pages/lending/preApproval/questions.ts:57-68` — the purpose step, whose third option
  *is* `cash_out`. The step is asked, so this is a wrong preselection rather than a skipped
  question — which is why it is MEDIUM and not CRITICAL. A borrower who accepts the preselection
  files a **purchase** application off a cash-out inquiry, and `loanPurpose` drives program
  eligibility and pricing from there.

Same shape as the calculator credit band (`preApproval/calculatorPrefill.ts`): an entry point
speaking a vocabulary the funnel does not accept. Quieter, though — the credit band wrote a value
the schema *rejected*; this one falls through to a valid default, so nothing throws and no guard
fires.

### LOW — 3. `?type=investment` has nothing to map onto

`client/src/pages/public/Landing.tsx:81` links to `/apply?type=investment`. The funnel captures no
occupancy field (`shared/preApprovalForm.ts:117-186` — no occupancy in the schema), so the intent
is dropped. **Not fixed:** the fix is a schema field + migration, off-limits to this routine
(CHARTER §6). Proposed ticket 1.

### LOW — 4. `?readiness=` is written and read by nobody

`client/src/components/coach/panels.tsx:85` emits `/apply?source=coach&readiness=${tier}`.
`PreApproval.tsx` reads `type`, `price`, `state`, `propertyType`, `propertyId`, `source` — never
`readiness`. Harmless (no data corrupted), but it is the "written, cleaned up, never read"
half-wire shape. Proposed ticket 2.

### LOW — 5. `Messages.tsx` still runs three uncoordinated polls

`client/src/pages/borrower/Messages.tsx:34` (30 s heartbeat `setInterval`), `:47` (30 s),
`:59` (5 s), `:66` (3 s) ≈ 36 requests/min/tab, no backoff. Carried forward unfixed from the
2026-08-12 report's ticket 5 — re-verified as still live today. React Query pauses `refetchInterval`
on a blurred tab (`refetchIntervalInBackground` defaults false), so the exposure is narrower than it
looks; the bare `setInterval` heartbeat does **not** pause. Ranked LOW: it touches neither capture
quality nor borrower friction directly.

## The fixes landed

**1.** `client/src/pages/borrower/URLAForm.tsx` — `describeUnsavedRows()` now describes slot 2,
gated on the **same** `hasCoBorrower` flag `buildPayload()` gates `coApplicants` on, so the two
cannot disagree about which rows were filtered. Each note names whose row it is once a second
borrower exists (`one co-borrower asset row still needs an account type`); single-borrower wording
is byte-identical to before. New colocated test `client/src/pages/borrower/URLAForm.test.tsx`
drives the real page — hydrate a co-borrower, switch to their tab, walk to Assets with the page's
own Continue button, type a bank with no account type, Save.

Deliberately **not** a refactor: `describeUnsavedRows()` stays argument-less and
`buildPayload`/`buildSectionsPayload`/`STEPS`/the hydration effect are untouched, per
[`handbook/URLA_FORM_REFACTOR_TRAP.md`](../../handbook/URLA_FORM_REFACTOR_TRAP.md).

**2.** `client/src/pages/lending/preApproval/entryType.ts` (new) — one named home for the `?type=`
→ `loanPurpose` translation, with every emitting call site listed beside it. A `Map`, not a
`Record`: the key comes straight off the URL, and `({} as Record<string, T>)["constructor"]`
returns a truthy function that would sail past a `?? "purchase"` fallback. `PreApproval.tsx:105`
now calls it. Its test pins all seven `?type=` values present in `client/src` today — including
the three (`va`, `first-time`, `self-employed`) that resolve to `purchase` **deliberately**,
because they preselect a borrower attribute rather than a purpose.

## Evidence — gate output

Branch `claude/interesting-goodall-351b8b`, rebased onto `origin/main` (`24fd54c`), `pnpm install
--frozen-lockfile` re-run after the rebase.

```
pnpm check                     exit 0
pnpm test  node lane           195 files, 2767 passed | 1 skipped
           client lane          78 files,  557 passed        (543 → 557: +14 new)
pnpm guard:querykeys           guard:querykeys / reachability / transport — all OK
pnpm guard:tokens              0 raw palette · 97 bare white/black (at baseline, no regression)
vitest tests/clientSchemaImports.test.ts   10 passed
detectTriggers() over the 7 changed files  →  []   (run, not read — CHARTER §10)
```

**Honesty check on the new tests** — reverted `URLAForm.tsx` and re-ran:

```
× names the co-borrower's incomplete asset row instead of claiming a clean save
× names whose rows they are once a second borrower exists
AssertionError: expected 'Everything is safely stored — you can…' to contain 'co-borrower asset row still needs an …'
Received: "Everything is safely stored — you can pick this up anytime."
Tests  2 failed | 1 passed (3)
```

The third case ("still drops the row from the payload") passes both ways on purpose — it is a
characterization test pinning that the **filter** is unchanged. The fix is the telling, not the
sending: a row the database cannot accept must still not be sent.

**Not verified:** no browser check. Dev servers cannot start in an unattended run (CHARTER §10).
This is test-and-typecheck evidence only.

**Claims dated before reporting** (CHARTER §10): `git log -S 'describeUnsavedRows' --
client/src/pages/borrower/URLAForm.tsx` → introduced by the #451 fix and never extended; `git log
-S 'type=cashout' -- client/src/pages/rates/CashOutRates.tsx` → the CTA predates the funnel's
current `defaultLoanPurpose` ternary. Both defects are live on `origin/main` as of this run, not
recycled rows from an older report.

## Proposed tickets

1. **Capture occupancy in the funnel** (primary / second home / investment). `?type=investment`
   exists as a CTA on `/` with no field to land in, and occupancy drives LLPA pricing and lender
   eligibility. Needs `shared/schema/**` + a hand-authored migration — a Primary Engineer item, not
   a Wiring Audit one.
2. **Drop or consume `?readiness=`** (`components/coach/panels.tsx:85`). One line either way; pick
   one so the link stops implying a handoff that does not exist.
3. **Consolidate `Messages.tsx`'s three polls** onto `useShellBadges`/SSE, as every other live
   surface already was, and pause the heartbeat `setInterval` on a hidden tab. Carried from the
   2026-08-12 report, re-verified live.
5. **Give "clear this field" a wire representation.** `loanApplicationIntakeUpdateSchema` requires
   non-empty for every field it receives, so a borrower can correct a value but never blank one —
   `/profile` now says so, the funnel's server draft and the URLA save still cannot express it.
   Needs a server-schema change + migration; Primary Engineer, not this routine.
4. ~~**Look for the #451 pattern elsewhere.**~~ **DONE this run** — see the sweep section above.
   One more live instance found and fixed (`Profile.tsx`); the rest of the client is clean.


## Addendum — the #451 pattern sweep (ticket 4, completed this run)

Founder asked for the sweep this report proposed. The pattern, stated so it can be searched for:
**the payload sent is a proper subset of what the user entered, and the success message does not
know.** Four ingredient-shapes were swept, each mechanically rather than by eye.

### Shape A — a filter inside a mutation that sends

Detector: every `useMutation({…})` block containing both `apiRequest(` and `.filter(`, brace-matched
out of the AST-free source (`/tmp/sweep.cjs`, throwaway).

**3 hits, 0 defects.** `AutopilotConsole.tsx:201`, `Profile.tsx:134`, `ScenarioDesk.tsx:197` — all
`.filter(Boolean)` over derived display strings or a comma-split allowlist, none dropping
user-entered rows.

### Shape B — a filter in a payload builder called at the `.mutate()` site

This is the shape URLAForm had (`buildPayload()` filters, the mutation never sees it). Swept by
listing every non-`filter(Boolean)` `.filter(` in the 35 files that contain a mutation, then reading
each. **~55 occurrences, 1 already-fixed defect (URLAForm), 0 new.** Everything else is
render-derived (`Tasks.tsx` bucket splits, `EConsent.tsx` pending/completed, dashboard counts) or a
*deliberate, borrower-visible* removal (`AgentEdit.tsx:97,114` unchecking a specialty,
`DocRequestDraftDialog.tsx:46` unticking a requested doc, `PublishDialog.tsx:203` deleting a cell).

### Shape C — conditional payload assembly (`if (x) payload.y = …`)

**17 hits, 1 defect — `Profile.tsx`, fixed above.** The rest:

- `GapCalculator.tsx:139-148` — guards on `!== undefined`, not blankness. A field the borrower did
  not touch is absent; a field they cleared is still sent. Correct.
- `LeasePayments.tsx:102-103` — guards on truthiness, but the values are form *strings*, so `"0"`
  survives, and the comment states the absent-vs-empty contract the API distinguishes for a missed
  period. Correct, and outside this routine's territory in any case.
- `ScheduleDialog.tsx:27-28` — optional staff scheduling dates. Correct.

### Shape D — a success toast with no failure path

Detector: mutations that send, toast on success, and declare no `onError` (`/tmp/sweep2.cjs`).

**0 hits.** This shape is fully closed across `client/src` — worth recording, because it was the
2026-08-12 run's finding 3 (four public forms rendering success on a rejected POST) and it has not
regressed.

### Server side

`isUrlaRowSaveable` is shared, so the route's four `continue`s
(`server/routes/borrower/urla.ts:506,540,557,659`) now skip exactly what the client already
withheld — defence in depth, not a second, quieter filter. `pickTableFields` allowlists from the
real Drizzle table, so it cannot drift from the schema, and the two virtual write-only fields are
explicitly passed through (`["accountNumber"]` at `:541` and `:558`; `selfEmploymentIncome`
re-merged at `:511-518`). No borrower route swallows a partial write behind a 200.

### The residue — reported, not fixed

**A clear is unrepresentable across the whole intake path, not just on `/profile`.** The root cause
is one rule: `loanApplicationIntakeUpdateSchema` requires non-empty for any field it receives, so
"set this back to blank" has no wire representation. `/profile` now *says so*. Two other consumers
of the same rule still cannot express it:

- `useServerDraftAutosave.buildDraftPatchPayload` (`:31-40`) omits empties, documented as "absent
  means unchanged" so partial progress cannot blank earlier answers — deliberate and right for
  mid-typing autosave. But it means an authenticated borrower who *clears* a funnel field, leaves,
  and later restores the server draft gets the old value back as though they had answered it. No
  success message is involved (autosave is silent by design), so it is not strictly the #451
  pattern — it is the same root cause one layer down.
- The URLA save has the same property for its scalar sections.

Fixing this properly is a server-schema change (a sentinel for "clear", or `.nullable()` on the
update schema) plus its migration — outside this routine's territory (CHARTER §6). Proposed as
ticket 5.

### Sweep verdict

The pattern was **not** widespread: two live instances in the client (`URLAForm`, `Profile`), both
now fixed and both with the same root cause — *a validation rule enforced by dropping data rather
than by reporting it*. That phrasing is the thing to grep for next time, not `.filter(`.

STATUS: OK
