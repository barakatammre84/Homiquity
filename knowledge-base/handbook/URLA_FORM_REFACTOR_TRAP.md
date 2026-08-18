# URLAForm.tsx — the refactor trap

> **Re-verified 2026-08-17** (refactor-radar, owner-directed pass at RR-005). The file has grown
> 625 → 750 lines since this was written, so every claim below was re-checked against the current
> code rather than trusted. **The prohibition stands** — all five structural hazards are still
> live. Two things changed, both recorded inline below: the `hasCoBorrower` latch is no longer
> strictly `true`-only, and the "Related, NOT fixed" defect at the bottom **has since been fixed**.
> One prerequisite is now done: `STEPS[].id` is a union, not `string` (hazard 2).

> **Recovered 2026-08-12** from `claude/determined-mccarthy-7ga80s`, an orphan branch that
> never had a pull request. It was written to `.agents/memory/`, which is not where this repo
> keeps knowledge, so it would have been deleted with the branch. Content unchanged apart from
> this note and the heading. Original commit preserved at tag
> `archive/claude-determined-mccarthy-7ga80s-head`.

`client/src/pages/borrower/URLAForm.tsx` is ~625 lines and looks like an
overdue split: a 68-line `STEPS` table of pure predicates, a pure hydration
mapper inside a `useEffect`, and a pure-looking `buildPayload`. Sections were
already extracted to `client/src/pages/borrower/urla/`, so finishing the job
reads as obvious cleanup.

It is not. Three independent adversarial reviews (2026-08-06) refuted all three
extractions. Each failure mode is invisible to `tsc`, to the full 2,576-test
suite, and to every CI guard — so a green gate is not evidence you got away with it.

**Rule:** Do NOT extract `buildPayload`/`buildSectionsPayload`, the `STEPS`
table, or the hydration effect out of URLAForm.tsx. Leave the density; it is
load-bearing.

**1. `buildPayload()` takes no arguments ON PURPOSE.** That is what enforces
"the primary borrower is always slot 1". `slice` (the borrower currently on
screen, `borrowerData[activeSeq]`), `borrowerData[1]` and `borrowerData[2]` are
*all* typed `BorrowerSlice`. Give the extracted function a parameter and passing
the **active** slice where slot 1 belongs compiles with zero error. The damage is
not cosmetic: `server/routes/borrower/urla.ts:485` rewrites
`borrowerSequenceNumber` on id-keyed updates, so a co-applicant's PII is written
permanently into the primary borrower's rows. Scope is the type system here.

**2. ~~`STEPS[].id` is typed `string`, not a union~~ — DONE 2026-08-17.** The seven ids are
matched against hardcoded `<TabsContent value="borrower">` string literals ~580 lines away in the
same file (it was ~400 when this was written). While `id` was `string` that was a
compiler-unchecked contract: a renamed id silently rendered an empty tab panel.

`id` is now `UrlaStepId`, a union of the seven, and each panel literal is pinned with
`satisfies UrlaStepId`, so the contract is checked **in both directions**. Verified by
reintroducing each failure mode and watching `tsc` go red — a typo'd panel literal gives
`TS1360 Type '"liabilites"' does not satisfy the expected type 'UrlaStepId'`, and a renamed step
id gives `TS2322 … is not assignable to type 'UrlaStepId'`.

This was the prerequisite this doc named for ever moving the STEPS table. **It is the
prerequisite only — the move is still refuted, and doing it does not license the move.**

**3. `updateSlice` closes over the render's `activeSeq` for the map KEY** while
using a functional updater for the value. It is safe today only because no child
memoizes or debounces its `onChange`. Adding `React.memo` / `useCallback` /
debounce — the exact "optimization" a refactor invites — makes a stale callback
write one borrower's PII into the other's slice.

Also load-bearing and easy to "clean up" wrongly: `hasCoBorrower` is a one-way
latch (`:257`, only ever set `true`). That monotonicity is what lets Add
Co-Borrower survive the post-save refetch.

> **Amended 2026-08-17:** there is now a fourth `setHasCoBorrower` site — `false`, in
> `removeCoBorrowerMutation.onSuccess` (the #450 fix). The rule is unchanged and the file says so
> in its own comment: **hydration** is still monotonic (only ever sets `true`), and the latch is
> cleared *only* after a real `DELETE …/co-applicant/2` succeeds. Do not read the extra setter as
> permission to make the latch two-way from local state — that is the exact bug #450 fixed. And `stepContext`/`completedCount` are
computed *after* the three early returns, so they can never become hooks.

**What IS safe: nothing that has been checked so far.** Eight extraction
proposals went through independent adversarial review and **all eight were
refuted** — including the three that look like inert JSX moves. Do not read the
list above as "everything else is fine".

The JSX blocks fail for a different reason than the logic does: the *core* move
is inert, but each proposal was mis-scoped, and the natural implementation breaks
something. Two worked examples, so the shape of the hazard is clear:

- **The three early returns (`:347-396`) cannot be moved to a dispatcher.**
  `if (!activeApplication) return …` at `:378` is the ONLY thing that narrows
  `activeApplication` from `LoanApplication | undefined`
  (`useActiveApplication.ts:84`, `strict: true`) so that `app` at `:398` types as
  `LoanApplication`. Three consumers need the non-optional type — `StepContext.app`
  (`:83`), `EmploymentSection` (`urla/EmploymentSection.tsx:19`) and
  `PropertySection` (`urla/PropertySection.tsx:24`). Replace the `if/return`s with
  `const state = renderStates(...); if (state) return state;` and `pnpm check`
  fails in three places — a **hard CI red** in the gate job. The wrapper/children
  form crashes at runtime instead. Only a third shape works, and it is not the
  obvious one.
- **A "save lifecycle" hook over `:317-338` silently swallows `:321-322`**
  (`stepIndex` / `isLastStep`), which seven sites outside the save path consume
  and which must stay.

The reusable lesson: on this page, a proposal that names a **line range** but not
the **shape** of the resulting call site is not yet a safe plan. Verify the shape
compiles under `strict` before believing it. And measure the gain first — the
page's line count is not the problem it appears to be.

**~~Related, NOT fixed~~ — FIXED, do not re-report.** This section used to read:

> `isUSCitizen` is required by `server/services/mismoValidation.ts:345` and exported as
> `USCitizenIndicator` (`server/mismo.ts:379`), the column exists
> (`shared/schema/lendingUrla.ts:480`) — but nothing in `client/` ever collects it, so every real
> application is permanently GSE-gate-blocked. `seedDemoFile.ts:131` sets it `true`, which is why
> demo files pass and this went unnoticed.

That was true when written and **was fixed by `42813a0` (#491)**, *"section 5 required a
citizenship column nothing writes, blocking every application"*. Section 5 no longer scores
citizenship at all: on the URLA that fact is **Section 1a**, not a Section 5 declaration, and
`scoreIdentity` already asserts `personalInfo.citizenship` there — which *is* the field the
borrower fills in. Removing it from section 5 narrowed a duplicate, not a control.

Still true, and still the reason it went unnoticed for so long: **the fixture was the seed.**
`grep -rn "isUSCitizen" client/src/` returns nothing to this day — correctly, because Section 1a
`citizenship` is the collected field.

*(Re-verified 2026-08-17. Kept rather than deleted because a stale "NOT fixed" claim costs a whole
run — this doc's own lesson, and the charter's §10 rule: date every standing claim before acting
on it.)*
