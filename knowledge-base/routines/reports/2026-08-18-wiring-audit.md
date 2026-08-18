# Frontend Wiring Audit — 2026-08-18

STATUS: OK — three capture-path defects found and fixed on branch, all of the "silent success"
class, each proven by reintroducing the bug, plus the root cause behind two of them removed.
Every gate green; nothing merged. Tickets 4 (the #451 sweep) and 5 (a wire representation for
"clear") were both completed this run at the founder's direction — 5 carries a §6 territory
deviation, recorded below.

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
pnpm test  node lane           196 files, 2785 passed | 1 skipped   (195 → 196: intakeClearSemantics)
pnpm guard:bundle              522,481 raw — at baseline, raised 47 bytes in Addendum 4 (justified there);
                               run against a FRESH build — it measures a build, not the source
           client lane          78 files,  558 passed              (543 → 558: +15 new)
pnpm guard:querykeys           guard:querykeys / reachability / transport — all OK
pnpm guard:tokens              0 raw palette · 97 bare white/black (at baseline, no regression)
vitest tests/clientSchemaImports.test.ts   10 passed
detectTriggers() over all changed files    →  []   (run, not read — CHARTER §10)
pnpm guard:schema              OK — no new column reached the schema, so nothing to migrate
pnpm guard:migrations          OK — 57 migrations, contiguous, all journalled
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
5. ~~**Give "clear this field" a wire representation.**~~ **DONE this run** (founder-directed; §6
   territory deviation recorded in Addendum 2). Needed no migration — the columns were already
   nullable.
6. ~~**`zodSchemaSemantics` cannot see per-field rules on a preprocessed schema.**~~ **DONE this
   run** (founder-directed) — Addendum 3.
7. ~~**Let the funnel commit a clear.**~~ **DONE this run** (founder-directed) — Addendum 4. The
   commit point turned out not to be the per-step Continue after all; see there for why.
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

## Addendum 2 — ticket 5, done: "clear this field" now has a wire representation

**⛔ Territory deviation, stated plainly.** CHARTER §6 puts `shared/schema/**` outside this
routine's lane. The founder directed this work explicitly, which is the same basis as
refactor-radar's owner-directed RR-005 pass on 2026-08-17. It is recorded here rather than
absorbed silently, because a rail the machine can relax *for itself* is not a rail (§1b) — this
one was relaxed by its owner, once, for a named piece of work.

### The rule that caused both #451-pattern defects

`loanApplicationIntakeUpdateSchema` is `.partial()`, giving exactly two wire states: **absent** =
"leave this alone" (what lets the funnel's debounced autosave send partial progress without
blanking earlier answers) and **present** = must satisfy the base rules, all of which reject an
empty string. "Set this back to blank" had nothing to travel as, so every surface that met the
wall dropped the edit before sending. That is one rule, enforced by discarding data instead of
reporting it — and it is why the sweep found the same shape twice.

`null` is now the third state, catalogued in `CLEARABLE_INTAKE_FIELDS`
(`shared/preApprovalForm.ts`): the ten free-text/money/years fields a borrower can actually empty
in a UI. Not `""` — an empty string is what a form control emits on its own, and treating that as
a command to erase would make every accidental blank destructive.

Deliberately excluded: the four select-only fields (no "empty" exists for a UI to produce) and the
three intent booleans. `avoidsInterestFinancing` especially — null there already means "not
asked", distinct from an explicit no, and a later PATCH must not be able to reach in and unset it.

Each clearable field **wraps its own validator** with `.nullable()` rather than restating it, so
`annualIncome: "abc"` is still a 400. Null is not a bypass.

### No migration — and that is a finding, not an omission

Every affected column in `loan_applications` is **already nullable**
(`shared/schema/lendingCore.ts:63-81`). Clearing returns the row to the state a draft is in before
the borrower answers — a shape the whole app already handles. `pnpm guard:schema` asks whether a
new *column* reached the schema without DDL; none did, so it is green **honestly**, not by
suppression, and no no-op migration was invented to satisfy a path rule the guard does not have.

### Risks cleared before writing, not after

| Risk | Finding |
|---|---|
| Could clearing stop a started Loan Estimate clock? | **No.** `evaluateTridTrigger` is set-once — `server/services/trid.ts:167` early-returns whenever `tridTriggeredAt` is set, and the module is the only writer. Reg Z §1026.19(e)(1)(iii) holds. |
| Could clearing `propertyState` slip an unlicensed state through? | **No.** `unlicensedStateRejection` treats null as "not supplied" (`shared/companyIdentity.ts:200`) — identical to a fresh draft. |
| Does the cross-field check survive a half-cleared pair? | Yes. `downPaymentWithinPurchasePrice` already guarded on falsiness; only its **type** was too narrow. `tsc` caught that, correctly, and the type was widened rather than cast away at the call site. |
| **Can the AI coach erase a borrower's answer?** | **No — and this is the property that makes admitting null safe at all.** The coach writes to the SAME schema, fed by an LLM reading a chat transcript. `presentFields` (`server/services/coachProfileSync.ts:155-160`) drops `undefined`, `null` and `""` before anything is built, and the candidate map is typed `string \| boolean`. Pinned by test so it stays true rather than being re-derived by whoever reads the schema next. |

### Evidence

`tests/intakeClearSemantics.test.ts` — 18 cases, added to `vitest.config.ts`'s `include:` array and
**confirmed present in the full-lane run** (`--reporter=verbose` names it 14 times; the node lane
went 195 → 196 files). It pins the three states; the catalog/schema agreement *in both directions*;
that a bad value on a clearable field is still a 400; that the coach cannot reach the clear; and —
on the **real route**, over the hermetic express harness `tests/urlaLoanDetailsSave.test.ts`
established — that a null reaches the column as a null while absent fields are not swept along,
that `""` is still a 400, and that the edit is still draft-only (409 on a submitted file).

`client/src/pages/profile/Profile.test.tsx` gains the invariant that matters long-term: **every
field the profile editor can empty has a wire clear.** The "we couldn't clear those fields" branch
from Addendum 1 is kept as the honest last resort, and that test is what keeps it unreachable —
failing the day someone adds an emptyable field without catalogueing it, rather than the day a
borrower hits it.

**Verified honest:** against the previous schema, `{ monthlyDebts: null }` returns
`Invalid input: expected string, received null`. The state genuinely did not exist.

### A finding about a guard, found on the way

`tests/zodSchemaSemantics.test.ts` passed **unchanged** through a change that altered what ten
fields admit. That is not the snapshot vouching for the change — it is a blind spot:
`shapeProbes` reads `schema.shape`, and a schema wrapped in `z.preprocess(...)` / `.transform()`
exposes none, so only the ten top-level scalar probes run and every per-field rule goes unpinned.

**5 of the 195 snapshotted schemas are in that state — and two of the five are
`loanApplicationIntakeSchema` and `loanApplicationIntakeUpdateSchema`,** the pair that admits
borrower financial data into a loan file. Not fixed here: unwrapping the inner object for probing
would re-record rows across the whole snapshot, which is its own decision. Proposed as ticket 6.

### The bundle guard caught the first attempt — and the fix was to move the bytes

`pnpm guard:bundle` went red in CI (local runs the guard only against a build, which this run had
not regenerated): the eager entry grew **50 raw bytes**, 522,434 → 522,484. The catalog had been
put in `shared/preApprovalForm.ts` — a reasonable home right up until you notice that module sits
in the eager entry chunk every visitor downloads before anything renders, for a predicate that one
lazily-routed page reads.

It now lives in `shared/intakeClearable.ts` and rides in `/profile`'s chunk. Back to **522,434
exactly, at baseline**. The guard asked the right question; re-baselining would have answered a
different one. (The same edit also removed four consts an earlier step in this branch had left
duplicated at the tail of `preApprovalForm.ts`.)

### What ticket 5 does NOT change

`useServerDraftAutosave.buildDraftPatchPayload` still omits empties and still does **not** send
null. That is deliberate: it fires on a debounce while the borrower is typing, so a transiently
empty field must never be read as an erasure. Clearing is an explicit act and belongs to an
explicit Save. The consequence noted in Addendum 1 therefore stands — an authenticated borrower who
clears a funnel field, leaves, and later restores the server draft still gets the old value back.
Closing that needs the funnel to commit clears at a deliberate moment (its per-step Continue is the
candidate), which is a funnel-flow decision, not a schema one. Ticket 7.

## Addendum 3 — ticket 6, done: the zod guard can now see through its own wrappers

**⛔ Territory deviation again.** CHARTER §6 confines this routine to `client/src/**`;
`tests/**` is outside it. Founder-directed, same basis as tickets 4 and 5, recorded rather than
absorbed.

### The hole

`shapeProbes` read `schema.shape`. A schema wrapped in `z.preprocess(...)` or `.transform(...)`
exposes none, so those schemas got the ten top-level scalar probes and **nothing per-field**. Five
of ~195 were in that state, two of them `loanApplicationIntakeSchema` and
`loanApplicationIntakeUpdateSchema` — the pair that admits borrower financial data into a loan
file. Ticket 5 changed what ten of those fields accept and this test passed unchanged, which is
how the hole surfaced.

### The fix, and the thing it deliberately does not change

`unwrapToShape` walks the wrapper chain breadth-first and returns the first shape it finds. Both
sides are searched rather than encoding which one carries the object per constructor name —
`z.preprocess(fn, obj)` keeps it on `.out`, `obj.transform(fn)` keeps it on `.in`, and that is the
sort of internal that moves between zod majors. Only one side ever has a shape.

**It changes only which field names the probes use.** Every probe is still parsed against the
OUTER exported schema (`outcome(val, input)`), so the recorded decision stays "what does the thing
we export accept?" — preprocessing included — rather than "what does its inner object accept?".
Those are different questions and only the first is worth pinning.

### One new probe, because the fix alone was not enough

The unwrap on its own would **still not** have caught ticket 5: `valueForKey` supplies plausible
values, so the null question was never asked of any field. `all-keys-null` asks it of every key at
once, and the faulted-path list is the payload — a field that starts admitting null **drops out of
it**. One line per schema, full nullability coverage.

That is the right thing to pin here specifically, because null is how the intake update schema
says "clear this borrower's answer". The recorded line now reads as a precise statement of which
fields are clearable:

```
schema.loanApplicationIntakeUpdateSchema [all-keys-null]
  reject:avoidsInterestFinancing,creditScore,employmentType,hasAdditionalIncome,homeSquareFootage,
         householdFamilySize,incomeSources,isFirstTimeBuyer,isVeteran,loanPurpose,propertyType
```

The six clearable base fields are **absent from that list** — they accept null. The full
`loanApplicationIntakeSchema` still faults all of them, which is correct: only the *update* schema
is clearable, and the snapshot now documents the difference between the two.

### The delta was audited, not eyeballed

Re-recording touched 400 lines. Checked semantically rather than by reading git's line count:

| Check | Result |
|---|---|
| schemas added / removed | **0 / 0** |
| probes removed | **0** |
| **existing probe values changed** | **0** |
| probes added | `all-*` ×194, `missing-*` ×12, `wrongtype-*` ×2 |

Purely additive coverage — nothing previously pinned moved. (The 192 "deletions" git reports are
JSON comma reflow.)

### What is still scalar-only, and why that is correct

Three schemas: `lookupAxisTypeSchema` (enum), `incomePathsSchema` (array), `incomePathResultSchema`
(discriminated union). None has a single object shape to probe, so scalar probes are the complete
answer. Probing a union per-variant is a separate idea, not a gap this closes — stated so the next
reader does not mistake three remaining rows for three remaining bugs.

**Verified honest:** reverting ticket 5's nullability turns the
`loanApplicationIntakeUpdateSchema [all-keys-null]` line red, naming exactly the six fields that
lost their clear.

## Addendum 4 — ticket 7, done: the funnel commits a clear

**⛔ Territory:** `client/src/**` is in-lane; `tests/**` and `scripts/` are not. Founder-directed,
like tickets 4-6. Fourth deviation this run — see the note at the end.

### The commit point is a transition, not the Continue button

This report proposed the per-step Continue as the candidate commit point. **That was the wrong
frame.** The question is not *when* to commit a clear, it is *how to recognise one*, and once
that is answered the debounce is a perfectly good moment.

`buildDraftPatchPayload` omits empty answers, which is correct on its own terms — an absent field
means "unchanged" and the funnel form is full of not-yet-reached blanks. But it made an ERASED
answer indistinguishable from an unanswered one, so a clear never travelled.

Now that `null` means "clear this", the tempting move is to send null for every empty field.
**That would be catastrophic**: the funnel form starts BLANK on every visit while the server draft
may hold a full set of answers from another device, so the first debounce would null out the entire
draft — "resume where you left off" turned into "lose everything you had". Emptiness cannot
distinguish "not reached yet" from "deleted". Only a transition can.

`buildDraftClears` emits a clear only for a field **this session has seen hold a value**. A fresh
visit has no such field and therefore clears nothing.

### Three details that are each a bug if got wrong

- **Held fields are remembered on every observed change, not only at debounce time.**
  `useDraftRestore` hydrates the form in one shot (`form.reset`), so a borrower who restores and
  immediately clears a field would otherwise have that clear missed — the debounce never saw the
  value.
- **A cleared field is forgotten only AFTER the request succeeds.** Earlier, and every later tick
  re-sends the same nulls; on failure, dropping it loses the clear in silence — which is the exact
  defect this thread is about, and this hook swallows failures by design so nothing else would
  notice.
- **A field with no wire clear is omitted, never nulled.** A null on a validator that rejects it
  400s the WHOLE PATCH, so one bad key would silently stop persisting every other answer on the
  page.

`incomeSources` sends `[]` rather than null — the schema already accepts an empty array and that is
the honest value for "I removed them all". No catalog entry and no schema change; it also closes
the same defect for the income-sources step, where removing every source previously left the old
array on the draft.

### The bundle baseline WAS raised this time — 47 bytes, and why that is not a contradiction

`shared/intakeClearable.ts` now has two lazy consumers (`/profile` and the funnel), so Rollup
hoists it into the shared graph. That is Rollup doing the right thing — **one copy instead of
two** — and the only way to avoid it is to restate the clearable-field list inside the funnel,
which is precisely the duplication-drift class that produced the credit-band and `?type=cashout`
defects **this same run fixed**. 47 bytes buys one source of truth for which fields can be erased.

Contrast Addendum 2, where the bump was **refused**: there the bytes were avoidable by choosing a
different module, so moving them was strictly better. The rule is not "never raise the baseline",
it is "never raise it instead of understanding it".

### Evidence

- `client/src/pages/lending/preApproval/useServerDraftAutosave.test.ts` (new, client lane,
  glob-picked) drives the **hook** — debounce, PATCH body, and when a held field may be forgotten
  — because the claim of this ticket is about the wiring, not the pure rule.
- `tests/funnelDraftPersistence.test.ts` gains 8 cases on the pure rule, including the fresh-visit
  case and the "never null a field with no wire clear" guard.

**Verified honest:** with the clear-commit removed, **4 of the 5 hook tests fail** — the erased
answer simply never appears in the PATCH body. The fifth is the fresh-visit safety property and
passes both ways, correctly.

### What remains open

Declining the restore banner still leaves the server draft's old answers in place until submit
overwrites the row. That is existing, documented behaviour (`useDraftRestore`: "start over
overwrites the old draft instead of stranding it"), not a regression, and changing it is a
different decision about what "start over" means. Not touched here.

---

## Note on this run's shape

Four of this run's items (tickets 4-7) were founder-directed and three of them reached outside
CHARTER §6's `client/src/**` lane — `shared/schema/**`, `tests/**`, `scripts/`. Each is recorded
as a deviation rather than absorbed, per §1b's rule that a rail the machine relaxes for itself is
not a rail.

But four deviations in one run is a signal about the rail, not about the run. If this is the shape
the Wiring Audit is wanted in, **§6 should be amended to say so** — an audit that traces a defect
from a CTA to a column and back cannot always fix it inside `client/src/**`, and the last three
tickets are the proof. That is a founder-only edit (§1b), so this routine proposes it and stops.

STATUS: OK
