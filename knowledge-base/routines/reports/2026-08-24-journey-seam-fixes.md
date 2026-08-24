# Journey-seam fixes — 2026-08-24

**STATUS: OK** — nine open client-journey findings fixed and proved, including the P1 that locked
borrowers out of their own Loan Estimate. Five more are deliberately untouched because open PRs
claim their files; each now names the PR that blocks it.

## ⛔ Human actions

**None blocking.** Two things to know:

1. **PRs #634, #689 and #657 hold the remaining five fixes.** They were last touched 2026-08-23 and
   are all `DIRTY`. Merging or abandoning them unblocks `J-0820-03/05/06/09/11` and `F-061`; until
   then a second PR cannot start without racing them.
2. **A prior journey-walk report is stranded.** `routine/journey-walk-2026-08-22` was pushed as
   `74e2f0bc` and **never got a PR** — the session died first. Its content is superseded (below),
   so it can be retired rather than merged.

## Summary

The 2026-08-22 walk of journey 2 and the 2026-08-20 walk (#644) found the same set of seam defects;
the earlier one registered them as `J-0820-01..12`. I re-verified **all fourteen against `main` at
`b74d06ae`** — every one still open, none claimed, none in an open PR — then fixed the nine whose
files were free. The headline is `J-0820-01`: `/e-consent` wrote every signature with
`application_id = NULL` while `consentGate` matched on equality, so a borrower saw six green
consents beside a refused Loan Estimate. That now works end to end on a fresh account.

## What was fixed, and how each was proved

| id | fix | proof |
|---|---|---|
| **J-0820-01** (P1) | `EConsent.tsx` resolves the file via `useActiveApplication` and sends `applicationId`; `isConsentGiven` scoped to match the gate | Fresh signup → consent row carries the id → `check/<app>/e_disclosure` returns `hasConsent: true` → the LE's ConsentGate stops firing |
| **J-0820-02** | `dashboard.ts` derives required consents from `getActiveConsentTemplates()` | Test asserts every required type resolves to an active template; fails on revert |
| **J-0820-04** | The false "From your soft credit check" note replaced with copy matching the section's own `SELF_REPORTED` declaration | Browser, on a file with zero `credit_pulls` rows |
| **J-0820-07** | Teaser payment labelled "at the top of this range" | Partial — see below |
| **J-0820-08** | `LoanEstimate.tsx` surfaces the server's message via `friendlyApiError` | New colocated test, both directions; fails on revert |
| **J-0820-10** | `MobileBottomNav` controls `flex-1 min-w-0` | 320px: six controls, "More" ends at **316** (was 340), each 52×53px |
| **J-0820-12** | Poll predicate tracks status via one shared `UNDECIDED_STATUSES` | Terminal statuses excluded by construction |
| **ux-51** | `min-h-[44px]` on the estimator chips and dismiss | 320px: bands **44px** (were 34); `browser-probe` lists none of them |
| **ux-52** | `/signup` links `/terms` and `/privacy` | Rendered, no 320px overflow |

## Four things worth reading

**1. Two of my own tests were false passes, caught by reintroducing the bug.**
The `J-0820-01` assertions searched the source for `applicationId` — and my *explanatory comment*
contained that word, so deleting the fix left them green. The `J-0820-02` assertion had the mirror
problem: it failed on the word `credit_pull` inside a comment describing the defect. Both are now
comment-blind. This is the same trap the design-token guard falls into matching `text-white` in a
comment, and it is only visible if you actually re-break the code — the charter's rule earning its
place.

**2. A colocated test was pinning `J-0820-04` in place.**
`ApplicationSummary.test.tsx` asserted `/never affects your credit score/` — the defect itself, held
green by a test written to lock it in. It now asserts the honest note *and* the absence of the
credit-check claim.

**3. `J-0820-08` is unit-tested, not browser-proved, and that is deliberate.**
The branch is unreachable in the headless pane: it reports `navigator.onLine === false`, so TanStack
parks the retrying query at `status: pending / fetchStatus: paused` and `error` never settles — the
page shows the fallback for a reason that has nothing to do with the fix. Diagnosed by reading the
query cache directly, not guessed. The server was confirmed to return the real 409 by direct probe.

**4. `J-0820-12`'s obvious fix was wrong.**
The plan originally said "poll while `awaitingDecision`". `awaitingDecision` includes **`denied`**,
which is terminal — that rule would have turned this page into a 4-second heartbeat on every
declined file forever. Caught before writing code, by checking `LOAN_APP_TERMINAL_STATUSES`.

## Deferred, with the PR that blocks each

`J-0820-03` (#689) · `J-0820-05` (#634) · `J-0820-06` (#634) · `J-0820-09` (#634) ·
`J-0820-11` (#634) · `F-061` (#689) · the "Est. monthly excludes escrow" observation (#657).

`J-0820-03` is deferred **whole** even though half its fix sits on an unclaimed file: relabelling
one surface while the other still says "loan amount" would leave the two disagreeing in a new way.

`J-0820-07` is **partial** for the same reason — labelling it was possible, but computing the PITI
at the borrower's target needs their actual down payment, which only `PreApproval.tsx` holds.

## Environment note

The local dev database was behind `main`: `users.last_failed_login_at` (migration `0057`) was
missing, so **every** `/api/auth/register` returned 500. `pnpm db:migrate` reported
"migrations applied successfully" **without creating the column** — drizzle-kit's journal is out of
sync with the database, the snapshot-drift CLAUDE.md warns about. Applied that one idempotent
`ADD COLUMN IF NOT EXISTS` directly to the local DB. **No repo migration was authored and no
`shared/schema/**` file was touched** — `0057` already exists on `main`; this was local repair only.

## Observed, not fixed

- `awaitingDecision` including `denied` means a **denied** borrower is shown *"Under Review"* on
  `/loan-options`. That is an adverse-action visibility question adjacent to **ux-24** — flagged,
  not silently changed.
- Two sub-44px controls remain on the Landing at 320px and are outside this scope:
  `input-coach-question` (218×40) and the footer's inline `NMLS Consumer Access` link (135×16).

## Verification run

`pnpm check` clean · `pnpm test` — both lanes green, and `tests/consentApplicationScope.test.ts`
confirmed present in the node lane's run output rather than assumed ·
`security-review-guard` — **no §9 trigger across 13 files**. Note the guard takes
**newline**-separated paths: passed space-separated it silently evaluates one bogus path and prints
the same "OK" a real pass prints. The first run said "1 changed file"; the real answer needed the
correct format.

STATUS: OK
