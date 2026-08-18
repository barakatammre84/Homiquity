# Frontend Wiring Audit — 2026-08-18

STATUS: OK — two capture-path defects found and fixed on branch, both of the "silent success"
class, both proven by reintroducing the bug. Every gate green; nothing merged.

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
           client lane          77 files,  552 passed        (543 → 552: +9 new)
pnpm guard:querykeys           guard:querykeys / reachability / transport — all OK
pnpm guard:tokens              0 raw palette · 97 bare white/black (at baseline, no regression)
vitest tests/clientSchemaImports.test.ts   10 passed
detectTriggers() over the 5 changed files  →  []   (run, not read — CHARTER §10)
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
4. **Look for the #451 pattern elsewhere.** Two runs have now found the same defect twice in the
   same file — a filter that drops data plus a success message that does not know about the filter.
   Worth a sweep of every surface that filters rows before a POST.

STATUS: OK
