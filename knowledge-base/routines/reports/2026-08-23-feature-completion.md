# Feature Completion Engine — 2026-08-23

STATUS: OK — domain 5 (Underwriting & decisioning), area 6 (Income analysis across the five
qualifying paths), taken under the standing **complex files** segment. One gap, one PR: the
itemised income breakdown did not add up to the total above it, on the borrower's card and on the
LO cockpit. Open `FINDINGS.md` rows: **unchanged** — this gap was not in the register (see Evidence).

## ⛔ Human actions

1. **Review and merge [PR #709](https://github.com/barakatammre84/Homiquity/pull/709).** Ready, not
   draft: `detectTriggers()` over the 12 changed files returns `[]`, so §9 does not fire. No
   migration, no dependency, no regulated-math change.
2. **`CF-0818-01` is still open and this PR walked right past it.** `INCOME_PATH_IDS` is declared
   twice — `shared/incomePaths.ts:30` (canonical) and `shared/situationProfile.ts:31` — identical
   today, guarded by nothing. It is the reason this PR did **not** add a `subject_property_rent`
   path id, which was otherwise the cleaner model. A one-line test asserting the two arrays are
   equal would close it; it belongs to whoever owns `shared/situationProfile.ts`, not to a
   feature-completion tick.
3. **`CF-0818-02` is still open and is procurement, not code.** `capital_gains_present` is
   classified (`server/services/situationClassifier.ts:180-185`) and reconciled
   (`server/services/taxReconciliation.ts:271`) and **no path computes capital-gains income**;
   `docs/fannie-mae/` holds no B3-3.1-09. A borrower whose income is materially capital gains
   qualifies down no path and is told nothing about why. Citable document first, then a path.

## Summary

The multi-path income orchestrator persists an `IncomePathResult` that records what a path is
*worth* and never what it *contributed*, and the subject property's 2–4-unit qualifying rent
contributes to the qualifying total without being a path at all — so every surface that itemises
that total renders rows which do not sum to it. The borrower's card is titled *"How your qualifying
income was calculated"* and subtitled *"the same math your approval used"*; the LO cockpit renders
the same list under the headline figure; both were wrong in the same three ways, all of them
specific to the complex file. The fix adds `appliedMonthlyIncome` / `appliedMonthlyObligation` to
the path envelope — inside the existing `paths` jsonb, so **no migration** — puts the subject unit
rent on the rental row it belongs to under the same B3-3.8-01 citation, and makes the read model
refuse to itemise anything that does not reconcile to the persisted total. No DTI math changed and
the three underwriting engines were not opened. Every claim below is red-first: the tests were run
against the reverted source and fail for the stated reason.

## Evidence

### The defect, measured

A scratch harness over `computeIncomePaths` (`server/services/income/orchestrator.ts:81`), each
case with $6,000/mo of wage income, feeding `toBorrowerIncomeAvailableView`:

```
MIXED  rows: [["agency_wage",6000,true],["rental",500,true]]
MIXED  rowSum: 6500  total: 7250
       breakdown: {"rental":500,"rentalIncomeApplied":1250,"rentalLiabilityApplied":750,...}

DUPLEX rows: [["agency_wage",6000,true]]
DUPLEX rowSum: 6000  total: 7125
       breakdown: {"subjectRentalIncomeApplied":1125,...}

LOSS   rows: [["agency_wage",6000,true],["rental",-750,true]]
LOSS   total: 6000
       breakdown: {"rental":-750,"rentalIncomeApplied":0,"rentalLiabilityApplied":750,...}
```

- **MIXED** — two rentals, +$1,250 and −$750. `computeRentalPath` returns `split.net` as
  `monthlyQualifyingIncome` (`server/services/income/paths/rental.ts:128`) while the total sums
  `rentalIncomeApplied = split.positiveTotal` (`orchestrator.ts:126-128,143`). The row showed $500
  badged **Counted**; $1,250 was counted; the $750 loss moved to monthly obligations with nothing
  said. Rows short by $750.
- **DUPLEX** — owner-occupied 2-unit, $1,500 market rent. `calculateSubjectPropertyQualifyingRent`
  adds 75% = $1,125 to the total (`orchestrator.ts:133-146`) and there is no path for it, so the
  card rendered a single $6,000 line under $7,125.
- **LOSS** — one rental at a loss, pre-verification. `appliedToDti` is true because losses always
  apply, so the card rendered **−$750 · Counted** — a negative income line that is not in the total,
  because a loss is a monthly debt.
- **Fourth, from the code rather than the harness:** `computeBankStatementPath` can return
  `status: "applicable"` with `appliedToDti: false` and a real figure
  (`server/services/income/paths/bankStatement.ts:175-178`). The old view filtered on
  `status === "applicable"` (`shared/borrowerIncomeView.ts`, pre-PR), so an alternative METHOD's
  figure appeared beside a total that excludes it — wrong, and steering, which is the same reason
  `recommendedPathId` is stripped from the payload.

Both surfaces, one root cause — `client/src/components/borrower/IncomeSummaryCard.tsx:87` (borrower)
and `client/src/pages/staff/loCommandCenter/ActiveBorrowerPane.tsx:117` (LO), the latter under a
`primaryMonthlyQualifyingIncome` headline at line 96. `server/routes/cockpit.ts:252` passes
`incomeRow.paths` through raw, so the LO reads the same envelope the borrower does.

### Dating the gap (CHARTER §1)

`git log -S 'subjectRentalIncomeApplied' -- server/ shared/` → the field arrives with the
B3-3.8-01 subject-rent wiring and has never had a path. `git log -S 'monthlyQualifyingIncome' --
shared/borrowerIncomeView.ts` → the borrower view has read the per-path figure since Borrower
Clarity PR 7. Neither is a stale claim from a document: both were reproduced today against
`origin/main` @ `6dd7bbf7`.

**This was not an open `FINDINGS.md` row.** The open-findings count is therefore unchanged by this
tick; the gap came from walking the segment, not from the register. Reported rather than dressed up
as a closure.

### Proof by reintroduction

1. **Orchestrator** — `server/services/income/orchestrator.ts` and `paths/rental.ts` restored from
   `origin/main`, tests kept:
   ```
   Tests  8 failed | 28 passed (36)
   AssertionError: expected null to be 7250      (mixed rental portfolio)
   AssertionError: expected null to be 7125      (owner-occupied duplex)
   AssertionError: expected 'not_indicated' to be 'applicable'
   AssertionError: expected undefined to be +0   (rental loss is an obligation)
   ```
2. **Read-model guard** — `breakdownAvailable = applied !== null && applied === total` mutated to
   drop the `=== total` half:
   ```
   FAIL tests/borrowerIncomeView.test.ts > refuses a breakdown that would not reconcile
   AssertionError: expected true to be false
   ```
3. **LO cockpit** — `ActiveBorrowerPane.tsx` restored from `origin/main`:
   ```
   AssertionError: expected 'Test BorrowerIn Progresspurchase$500,…' to contain '$1,250/mo'
   ```

All three restored; suite green.

### Legacy rows, verified against the real local database

`appliedMonthlyIncome` is optional, so the ~thousands of already-persisted evaluations omit it.
`sumAppliedIncome` returns **null**, never 0, for such a row — coercing it would have rendered
exactly the breakdown-that-does-not-add-up being removed. The read model reconstructs the old
convention (a path's whole figure counted iff `appliedToDti`) and accepts it **only when it equals
the persisted total**. Run over the 8 newest real rows in `income_path_evaluations` on
`localhost:5432`:

```
034aa746  total=12083.33  breakdownAvailable=true  rows=[["agency_wage",12083.33,0]]
225596f6  total=11250     breakdownAvailable=true  rows=[["agency_wage",11250,0]]
4d7a334a  total=7500      breakdownAvailable=true  rows=[["agency_wage",7500,0]]
cffde832  total=7500      breakdownAvailable=true  rows=[["agency_wage",7500,0]]
6efe09ad  total=4000      breakdownAvailable=true  rows=[["agency_wage",4000,0]]
db6c15a1  total=10000     breakdownAvailable=true  rows=[["agency_wage",10000,0]]
4770fb88  total=10000     breakdownAvailable=true  rows=[["agency_wage",10000,0]]
bd2a4c1d  total=10000     breakdownAvailable=true  rows=[["agency_wage",10000,0]]
```

8/8 recovered, no regression for existing files. The reconstruction fails exactly where the old
convention was wrong — a split rental portfolio reconstructs 5,500 against a persisted 6,250 — and
those rows get the honest "breakdown unavailable" line instead of a partial list.

### Gate

```
pnpm check                                    0 errors
pnpm test   node lane    228 files · 228 collected · 3319 passed | 1 skipped
            client lane  125 files · 125 collected ·  844 passed
            orphan files 371 on disk · 0 matched by no lane · all lanes ran every file
guard:tokens querykeys schema migrations kb docs   OK
guard:ui    9 metrics at or below baseline (523 files)
pnpm build && guard:bundle   526,640 raw bytes (at baseline, no regression)
detectTriggers(12 changed files, 605 changed lines) → []      (§9 does not fire)
```

`guard:ui` caught a real thing mid-run: the obligation line was written with `text-[11px]`, copying
the citation line beside it, and pushed `arbitraryTypeScale` 151 → 152. The ratchet only goes down,
so it became `text-xs`. Recorded because "I copied the neighbouring line" is how a ratchet erodes.

### What was not verified

**No browser verification.** The AVAILABLE state needs approved-grade status **and** decision-grade
provenance; every loan application in the local database is `pre_approved` with
`financial_data_provenance = self_reported`, so the card renders its *analyzing* state locally and
the changed branch is unreachable without seeding a file that does not exist. The dev server was
booted in the worktree on :5002 and answers `{"status":"ok",...,"commit":null}` — the local-dev
signature — which proves the server half loads with these changes and nothing more. The rendered
proof is at the DOM level instead: both `IncomeSummaryCard.test.tsx` and the new
`ActiveBorrowerPane.test.tsx` render the real components and assert the real figures, and both go
red when the component is reverted.

**The FEATURE_MAP owner agent was not invoked.** `knowledge-base/handbook/FEATURE_MAP.md` is on
`main` (`HAVE_MAP`), and the prompt's hand-off section would have had this go through
`hq-income-owner`. This session runs under a harness rail that forbids calling the Agent tool
unless the user asks. The agent's file was read directly instead, so its file list and traps were
used; the hand-back protocol was not. Flagging it because a routine that silently skips a step of
its own contract is the failure `CHARTER` §0 is about.

## Proposed tickets

1. **`CF-0818-01` — guard the duplicated `INCOME_PATH_IDS`.** `shared/incomePaths.ts:30` and
   `shared/situationProfile.ts:31` declare the same five ids independently. Identical today. A
   test asserting equality is one line and would have made adding a sixth path id safe, which is
   the option this PR had to decline.
2. **`CF-0818-02` — capital-gains income is classified but computable down no path.** Procurement
   of a citable B3-3.1-09 into `docs/fannie-mae/` first. Until then, consider whether a borrower
   whose file carries `capital_gains_present` should be *told* that source is not yet countable,
   rather than seeing a qualifying total that quietly omits it — that is the "silently qualify
   down no path" case this seat exists to find.
3. **Backfill or re-evaluate old income evaluations for complex files.** A file with a rental split
   or subject unit rent that was evaluated before this PR now shows "breakdown unavailable" until
   its next evaluation. Re-evaluation happens on any income change or decision recalculation, so
   this drains on its own — but a deliberate sweep would drain it faster, and belongs to the
   Backend Data Engineer's lane, not this one.
4. **The LO cockpit's income list has one test and it is the one added here.** `ActiveBorrowerPane`
   is a dense staff surface (conditions, documents, messages, activity) with no other coverage.

STATUS: OK
