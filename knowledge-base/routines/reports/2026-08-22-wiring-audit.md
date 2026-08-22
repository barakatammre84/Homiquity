# Frontend Wiring Audit — 2026-08-22

STATUS: WARN — a three-field silent write-drop on the capture path, found by tracing one value's
whole round trip. **Half of it is fixed on branch** (the read side, `client/src`, proven by
reintroduction); **the other half is a server allow-list outside this routine's territory** and is
escalated below with the exact edit. WARN also because the day's full gate could not be completed
inside the run — the machine is carrying five other `tsc` processes and two other vitest runs from
peer worktrees — and because `reports/` has no 2026-08-21 entry from any routine.

## ⛔ Human actions

1. **⛔ `server/routes/lending/statusDecisions.ts:78-84` silently discards three funnel answers.**
   The drafts-only `PATCH /api/loan-applications/:id` — the endpoint the funnel's own autosave
   writes to every 2.5s — filters the validated body through an `UPDATABLE_COLUMNS` allow-list that
   omits **`householdFamilySize`**, **`homeSquareFootage`** and **`avoidsInterestFinancing`**. The
   schema accepts them, the columns exist, the values arrive — and the route drops them on the
   floor. No 400, no log, no toast. This is the silent-success shape in its purest form: the
   borrower answers, the UI says nothing is wrong, and the answer never lands.
   **This routine may not fix it** — CHARTER §6 puts the Capture Path Engineer in `client/src/**`,
   and `server/**` is the Backend Data Engineer's lane (§6b). The file is unclaimed: no open PR
   touches it and its last commit is `5805f013` (#373). The edit is three strings; the
   verification recipe is in Evidence.
2. **Nothing merged, nothing pushed to `main`.** The client fix sits on the worktree branch
   `claude/musing-kepler-ca48fc`. Merging is L3 (CHARTER §1b).
3. **The 2026-08-21 gap.** `reports/` jumps from eight `2026-08-20-*` files straight to today. Per
   CHARTER §3 that may simply mean the laptop was shut; Evening Triage is the seat that
   distinguishes "shut" from "broke". Flagging, not guessing.
4. **The full gate did not return inside this run — see Evidence for exactly what did and did not
   run.** No dev server was started; an unattended run cannot, so no browser verification happened.

## Summary

Four censuses over `client/src`; three came back clean and are recorded as negative findings so the
next run does not repeat them (raw `fetch` without `res.ok`; `useMutation` without `onError`;
element-wise-orphan `invalidateQueries` keys). The fourth found the defect, and finding it required
walking the value's *whole* round trip rather than either end: **the VA residual-income pair is
dropped twice, once going out and once coming back, by two different mechanisms in two different
lanes.**

The read-side drop is fixed here. The write-side drop is the more serious of the two and is
escalated, because a route that validates a field and then silently omits it from its own write is
not a UI problem.

## Wiring map (the segment audited)

```
funnel answers  (PreApprovalFormData: 16 defaults + avoidsInterestFinancing)
   │
   ├─ localStorage autosave ─► useFunnelAutosave: JSON.stringify(values)        ✓ whole object
   │     restore: { ...form.getValues(), ...saved.values }                      ✓ complete
   │
   ├─ server autosave ──────► buildDraftPatchPayload: every non-empty field     ✓ sends all 3
   │     PATCH /api/loan-applications/:id
   │        └─ loanApplicationIntakeUpdateSchema.safeParse                      ✓ accepts all 3
   │        └─ UPDATABLE_COLUMNS filter        statusDecisions.ts:78-84
   │              householdFamilySize      ✗ NOT IN LIST  ── BREAK (write)
   │              homeSquareFootage        ✗ NOT IN LIST  ── BREAK (write)
   │              avoidsInterestFinancing  ✗ NOT IN LIST  ── BREAK (write)
   │        └─ storage.updateLoanApplication(updateData)   → 200 OK, 3 fields gone
   │
   ├─ server restore ───────► draftToFormValues()          useDraftRestore.ts:44
   │        householdFamilySize   ✗ NOT MAPPED  ── BREAK (read)   ← FIXED HERE
   │        homeSquareFootage     ✗ NOT MAPPED  ── BREAK (read)   ← FIXED HERE
   │        avoidsInterestFinancing ✓ mapped — off a column nothing writes
   │     then form.reset(values)                                                ⇒ blanks
   │
   └─ submit ───────────────► POST /api/loan-applications
         applications.ts:63-85 maps ALL of them, including the VA pair           ✓ complete
         underwritingEngine.ts:431,447,467 consumes both for VA residual         ✓ consumed
```

Two legs of five carry these answers correctly; the submit does, the localStorage copy does, and
the two server legs — the two that exist *precisely* to survive a device switch or a mid-funnel
signup — do not.

## Break points

### CRITICAL — founder-directive category 2 (the client completes it, the data is dropped) — ESCALATED, not fixed

**BP-1 · `UPDATABLE_COLUMNS` drops three validated funnel answers on every draft autosave.**

`server/routes/lending/statusDecisions.ts:78-84`. The list is 17 strings; the funnel collects three
answers that are not among them:

| field | collected by | column | in `UPDATABLE_COLUMNS`? |
|---|---|---|---|
| `householdFamilySize` | `questions.ts:134`, routed in for veterans (`preApprovalMachine.ts:172-176`) | `lendingCore.ts:93` `household_family_size` | **no** |
| `homeSquareFootage` | `questions.ts:146`, same | `lendingCore.ts:94` `home_square_footage` | **no** |
| `avoidsInterestFinancing` | `questions.ts:98`, the UAL P7 routing signal | `lendingCore.ts:88` `avoids_interest_financing` | **no** |

The comment above the list explains the design — *"Only real `loan_applications` columns — the
funnel schema also carries UI-only helpers (`hasAdditionalIncome`) that must not reach the DB"* —
and the design is right. The list is simply incomplete: all three of these **are** real columns.
An allow-list is the correct shape and a field missing from one is invisible by construction, which
is why this survived. Note the list also carries four fields the funnel does not collect
(`employerName`, `propertyAddress`, `propertyCity`, `propertyZip`), so it is not tracking the funnel
at all — it is a hand-maintained list that drifted.

**Consequence.** A veteran answers "how many people are in your household" and "roughly how big is
the home", the funnel autosaves, the request returns 200, and the draft row keeps `NULL` in both
columns. Same for the P7 financing-preference answer, which is a *routing* signal — a borrower who
declares they require financing that avoids interest has that declaration discarded on every draft
save. Nothing anywhere tells them. The values only reach the database at final submit
(`applications.ts:82-83`), so any borrower who abandons and resumes has answered those questions for
nothing.

**The fix this routine may not make** (three strings, no schema change, columns already exist):

```
  const UPDATABLE_COLUMNS = [
    "annualIncome", "monthlyDebts", "creditScore", "employmentType",
    "employmentYears", "propertyType", "purchasePrice", "downPayment",
    "loanPurpose", "isVeteran", "isFirstTimeBuyer", "propertyState",
+   "householdFamilySize", "homeSquareFootage", "avoidsInterestFinancing",
    "employerName", "propertyAddress", "propertyCity", "propertyZip",
    "incomeSources",
  ] as const;
```

Whoever takes it should also consider deriving the list from the intake schema's own keys minus a
named UI-only set, rather than maintaining a parallel array — the parallel array *is* the defect.

### MEDIUM — the same defect's read half — FIXED on branch

**BP-2 · `draftToFormValues` dropped the VA residual-income pair coming back in.**

`client/src/pages/lending/preApproval/useDraftRestore.ts:44-70` (pre-fix). The function is fed
straight into `form.reset(...)` at `:122`, so it is not a patch over the current form — it *is* the
form. It spreads `...current` (on a fresh load, `PRE_APPROVAL_DEFAULTS`, where both fields are `""`)
and then names 15 fields explicitly. `householdFamilySize` and `homeSquareFootage` were not among
them, so both were reset to blank while `:130-133` toasted *"Draft restored from your account / We
loaded your saved progress."* — DESIGN_SYSTEM.md §13's **agreement** clause failing, two elements
disagreeing about the same fact.

**Be precise about what this fix does today.** Because BP-1 means those columns are always `NULL`
for a funnel draft, the restore currently has nothing to lose, and the *observable* behaviour on
`main` today is unchanged by this commit. **This is a latent fix, and calling it a user-visible one
would be false.** It is worth landing anyway, for two reasons that are not "it might matter later":

1. It is the necessary half of a pair. Fixing BP-1 alone would persist the answers and *still* blank
   them on restore — the borrower would be no better off, and the write fix would look done.
2. The test that comes with it is the part that has standing value. It pins the **class**: given a
   draft with every persisted funnel answer filled, no key of `PRE_APPROVAL_DEFAULTS` may come back
   still equal to its blank default. `hasAdditionalIncome` is the one documented exclusion (derived
   from `incomeSources.length`, no column); `avoidsInterestFinancing` gets its own assertion because
   `PRE_APPROVAL_DEFAULTS` does not carry it and the sweep cannot see it. Adding a question to the
   funnel now fails this test until the mapping is updated.

The mapping change itself uses the same integer→string widening `employmentYears` and `creditScore`
already use, `|| ""`-guarded so a stored `0` — below the schema's floors of 1 person and 100 sq ft —
never enters the form as an answer.

### Negative findings — recorded so the next run does not re-derive them

**NF-1 · `await fetch` with no `res.ok` check: none left.** Three files in `client/src` call `fetch`
directly (`lib/queryClient.ts`, `lib/logout.ts`, `calculators/rentToOwnReadiness/RentCard.tsx`);
`RentCard.tsx:31` checks and throws. Everything else goes through `apiRequest`, which throws
`ApiError` on any non-2xx (`queryClient.ts:42-69`). The four-public-forms class is closed.

**NF-2 · `useMutation` without an `onError`: 2 of 138 call sites**, both staff —
`components/staff/RiskBriefPanel.tsx:19` and `pages/lending/loanOptions/WhatIfPanel.tsx:62` (the
latter has an `onSuccess`, so it is the silent-success shape, on a what-if panel rather than a
capture surface). Tickets below; neither earns this run's fix slot.

**NF-3 · Query-key invalidation: 0 element-wise orphans** across 182 `invalidateQueries` sites and
93 distinct literal query keys. The `loanApplicationKeys` / `consentKeys` / `taskEngineKeys`
factories (`lib/queryClient.ts:178-380`) plus `pnpm guard:querykeys` have closed the
`partialMatchKey`-is-element-wise class. The two strict misses are the factories' own `all()`
prefixes — which is what a prefix is supposed to look like.

**NF-4 · The funnel→DB *submit* mapping is complete**, in deliberate contrast to the *draft* mapping
above: `applications.ts:63-85` maps every field including all three of BP-1's, with
`avoidsInterestFinancing ?? null` never defaulted. `calculatorPrefill` / `coachPrefill` are additive
patches that only fill blanks, so an omission there is a missed prefill, not data loss.

## Evidence

Worktree `strange-kilby-c389c0`, branch `claude/musing-kepler-ca48fc`, at `origin/main` tip
`4206025f`, `git rev-list --count HEAD..origin/main` = 0, `pnpm install --frozen-lockfile` re-run
after sync (exit 0).

**BP-1, read from the file:**

```
$ sed -n '78,84p' server/routes/lending/statusDecisions.ts
      const UPDATABLE_COLUMNS = [
        "annualIncome", "monthlyDebts", "creditScore", "employmentType",
        "employmentYears", "propertyType", "purchasePrice", "downPayment",
        "loanPurpose", "isVeteran", "isFirstTimeBuyer", "propertyState",
        "employerName", "propertyAddress", "propertyCity", "propertyZip",
        "incomeSources",
      ] as const;
```

and the columns those three names would have written, which exist:

```
$ grep -n "avoids_interest_financing\|household_family_size\|home_square_footage" shared/schema/lendingCore.ts
88:  avoidsInterestFinancing: boolean("avoids_interest_financing"),
93:  householdFamilySize: integer("household_family_size"),
94:  homeSquareFootage: integer("home_square_footage"),
```

**How to verify BP-1 without a browser** (for whoever takes it): the payload builder already sends
them — `buildDraftPatchPayload` (`useServerDraftAutosave.ts:38-48`) omits only empty values and the
UI-only `hasAdditionalIncome` — and `loanApplicationIntakeUpdateSchema` is derived from
`preApprovalFormBaseSchema`, which declares both VA fields (`shared/preApprovalForm.ts:174-185`).
So a PATCH carrying `{"householdFamilySize":"4"}` returns 200 and leaves the column `NULL`. An
integration test asserting the column after the PATCH is the honest proof, and its absence is why
this was invisible.

**Censuses:**

```
$ node /tmp/qk2.mjs
distinct query keys: 93 invalidations: 182
STRICT (element-wise) orphan invalidations: 2
client/src/lib/queryClient.ts:187  inval="/api/loan-applications"  NO QUERY AT ALL
client/src/lib/queryClient.ts:363  inval="/api/task-engine"  NO QUERY AT ALL

$ node /tmp/mut2.mjs
useMutation call sites: 138  without onError: 2
client/src/components/staff/RiskBriefPanel.tsx:19
client/src/pages/lending/loanOptions/WhatIfPanel.tsx:62  onSuccess-present
```

**BP-2 fix, proven by reintroduction** — both fields deleted again from `draftToFormValues`, suite
re-run, then restored:

```
× carries the VA residual-income pair back out of the draft
    AssertionError: expected '' to be '4'
× restores EVERY persisted funnel answer, not just the ones someone remembered
    AssertionError: expected [ 'householdFamilySize', …(1) ] to deeply equal []
  Tests  2 failed | 4 passed (6)
```

with the fix in place:

```
$ npx vitest run --config vitest.client.config.ts \
    client/src/pages/lending/preApproval/useDraftRestore.test.ts
Test Files  1 passed (1)
     Tests  6 passed (6)
```

**§9 security triggers — run, not read** (`scripts/security-review-guard.cjs`'s own `detectTriggers`
over this run's changed files and diff lines):

```
files: [ 'client/src/pages/lending/preApproval/useDraftRestore.ts',
         'client/src/pages/lending/preApproval/useDraftRestore.test.ts' ]
triggers: []
```

**What could NOT be verified, plainly.** `pnpm check`, the full `pnpm test` (node + client lanes),
`pnpm guard:querykeys`, `pnpm guard:tokens` and `tests/clientSchemaImports.test.ts` were launched
and had not returned when this report was written — `pnpm check` alone ran past 30 minutes of wall
clock. That is contention, not failure: `ps aux` showed **five other `tsc --noEmit` processes and
two other vitest runs** from peer worktrees (`hq-selling-guide`, `income-wt`, `sg-wt`,
`hygiene-followup-0822`), with a 1-minute load average of **13** and a 15-minute average of **26**.
The diff is two added lines in one client hook, a new colocated test, and one register row; it
crosses no type boundary, no schema, no design token and no query key, so a red gate is unlikely —
**but unlikely is not verified, and this report does not claim it was.** Run the full gate before
merging. **No dev server was started.**

## Proposed tickets (for Evening Triage — not landed here)

1. **⛔ P1 — `UPDATABLE_COLUMNS` drops `householdFamilySize`, `homeSquareFootage` and
   `avoidsInterestFinancing`** (`server/routes/lending/statusDecisions.ts:78-84`). Backend Data
   Engineer's lane (§6b). Three strings; no schema change; columns exist. Ship it with an
   integration test that PATCHes a draft and reads the columns back — the absence of that test is
   the reason a validated field could be silently discarded. Consider deriving the list from the
   intake schema's keys minus a named UI-only set, because the hand-maintained parallel array is the
   defect, not the three omissions.
2. **P3 — `WhatIfPanel.tsx:62`**: `useMutation` with an `onSuccess` and no `onError` — the
   silent-success shape on a borrower-adjacent surface.
3. **P3 — `RiskBriefPanel.tsx:19`**: same shape, staff surface.
4. **P2 — cross-device resume drops the borrower at step 1.** The server-draft restore calls
   `goTo("loanPurpose")` (`useDraftRestore.ts:127`) while the localStorage path resumes at the saved
   step (`:146`), so resuming on a second device means re-clicking the whole prefilled funnel.
   **Deliberately NOT fixed here.** The draft row stores no step marker, and deriving one from
   "which answers are filled" is unsafe: `loanPurpose`, `propertyType` and `employmentType` all
   restore to non-empty *defaults*, so a derived resume could skip a question the borrower never
   answered — including `veteranAndFirstTime`, which routes the VA path. Guessing here would create
   a category-1 defect to fix a category-3 one. Doing it right needs a persisted step marker, i.e. a
   schema change: Backend Data Engineer for the column, Capture Path Engineer for the client half.

## Register

Claimed `useDraftRestore.ts` at 2026-08-22T09:30Z (commit `7d4a8a63`), noting the adjacency with
PR #634 (which holds `PreApproval.tsx`, `calculatorPrefill.ts` and `useDeferredSubmit.test.ts` in
the same directory — untouched here). `server/routes/lending/statusDecisions.ts` was checked and is
unclaimed by any open PR; it was **not** taken, on territory grounds (CHARTER §6), and is escalated
above instead. Row released in the same branch.

STATUS: WARN
