# Journey walks — the four Landing doors, 2026-08-19

> **Why this file and not [FINDINGS.md](../FINDINGS.md):** that register is claimed by five
> open PRs (#607, #611, #615, #618, #542) and the claim lock says pick something else rather
> than plan to rebase. These rows are parked here so they survive the session that produced
> them; **whoever owns the register next should fold them in and delete this file.**
> `J-0819-*` ids were minted by the walkers and are NOT yet reconciled against the register —
> re-number on adoption.

Four persona walkers drove the four doors introduced by PR #595 end to end in a real browser.

## Method caveat — read before trusting any storage-boundary row

The four walkers ran **concurrently against one dev server and one browser profile**, so they
shared a `localStorage` origin and overwrote each other's evidence (one walker found another's
funnel draft in its own tab). That server then died mid-run; two walks recovered on a fresh
listener and completed, two are partial. **Storage-boundary findings from that run are not
trustworthy.** Walkers need serialising, or one server each.

Second caveat: `pnpm dev` is `tsx server/index-dev.ts` with **no watch flag**, so a
long-running server keeps serving stale *server* code while Vite keeps the client current.
Every walker flagged it independently. Restart the server after any `server/` change or
server-rendered copy cannot be honestly graded.

## Verified by the orchestrator (reproduced first-hand, then fixed in #595)

| Finding | Evidence |
|---|---|
| Renting door promised a credit benefit the product disclaims | `/first-time-buyer` never mentions a bureau; `MyLease.tsx:160` — "Saving a lease does not report anything to the credit bureaus". **Reg N / MAP Rule §1014.3.** Copy retracted. |
| Self-employed door promised income handling the funnel cannot do | Rentals dead-end the funnel; SE entry never read by the orchestrator. Copy retracted. |
| `/va-loans` claimed "We underwrite it" | Homiquity is a broker. Reworded. |
| `/loan-options` claimed Homiquity underwrites and decides | "Your application is with our underwriting team" above the footer disclaiming exactly that. Flagged by two walkers independently. Reworded. |
| Naming guard had two scope holes | `git ls-files "client/src/**/*.tsx"` matches **zero top-level files**, and `shared/` was out of scope. Fixed; guard widened. |
| A fifth assistant name shipped | `coachingTurn.ts:494` greeted first-time chatters with "I'm your Homiquity readiness assistant" — invisible to a four-literal vocabulary. Fixed. |

## Open — NOT fixed, and NOT independently verified by the orchestrator

These are walker claims with file:line evidence. **Verify before acting.** They were left alone
because they are regulated math or data-integrity defects wanting an owner who can cite the
guideline, not copy fixes.

| id | sev | Claim | Cited evidence |
|---|---|---|---|
| J-0819-01 | P1 | A $1.2M **jumbo** balance renders as three **"Conventional"** payment scenarios with a "Lock This Rate" CTA, while the same page prices it correctly as "30-Year Fixed Jumbo". Compliance-flagged. | `server/services/loanAnalysis.ts:24` types `loanType` as `"conventional"\|"fha"\|"va"`; file contains no conforming-limit constant |
| J-0819-03 | P1 | URLA renders "Self-Employed" **ticked** and Base Income filled, but stores `isSelfEmployed:false`, `baseIncome:null` — display-only defaults, so the SE income path finds zero self-employed jobs | `urla/EmploymentSection.tsx:196,216`; consumer `income/paths/selfEmployment.ts:29` |
| J-0819-07 | P1 | The funnel's self-employment entry is never read; the orchestrator books the whole income as **agency wage** and reports "Employment income" as the only source | `income/orchestrator.ts:346-348` reads only `type === "rental"` |
| J-0819-02 | P1 | Adding **Rental Income** makes the funnel uncompletable — the address never commits to form state, the gate hard-requires it, and no error is shown | `IncomeSourcesStep.tsx:222-227`; gate `preApprovalMachine.ts:279-284` |
| J-0819-05 | P1 | Submitting a second application never updates the active-file mirror, so the borrower is shown another file's checklist | `hooks/useActiveApplication.ts:20-36` |
| J-0819-06 | P1 | The only borrower link to the income-summary page **404s** | `LoanDetails.tsx:49` → `/pipeline/:id/offers`; route is `/pipeline/:id` (`App.tsx:433`) |
| J-0819-02(r) | P2 | `/first-time-buyer` renders **no site navigation** — every outbound link is the application or `/afford` | rendered DOM: `document.querySelector('nav') === null` |
| J-0819-03(r) | P2 | `/first-time-buyer` renders a rate slider and a monthly payment one click from a page whose stated rail is no rate/payment figures. **Needs a Reg Z §1026.24(d) verdict.** | `FirstTimeBuyer.tsx:230-243,266`; disclosure at `:303` |
| J-0819-05(r) | P2 | Coach chat recites income/credit as "on file" while the panel beside it reads "0 of 11 captured" | chat reads the application, panel reads coach intake only |
| J-0819-06(r) | P2 | `renter@test.com` owns a `processing` application, so `RenterHome` — the aspiring-owner sandbox floor — is unreachable on the seat that journey requires | `Dashboard.tsx:242` `showIncubatorHome(...)` |
| — | P2 | `/afford` renders a vendor **503** as the visitor's mistake: "Make sure the address is correct." | `AffordabilityCheck.tsx` lookup `onError` |
| — | P2 | `Footer.tsx:59` advertises a product named **"Homiquity Lend"** in the same footer that disclaims lending | founder decision — product naming |

Already owned elsewhere, do not duplicate: the stale 2024 conforming limit in `AdvisoryPanel.tsx`
is **PR #606**; `main` having no required gate is **PR #614**.

## Confirmed working

- **Jumbo is real on the offer path** — `/loan-options` priced a $1.2M file as "30-Year Fixed
  Jumbo · 6.756%", and the decision correctly routed to review rather than approving on
  conforming grids. This is why the move-up door's "jumbo included" copy stands.
- The landing hero question survives the signup boundary and is **actually sent** by the coach.
- The no-signup estimator path completes in three steps with no account and no credit check.
- "Homi" held on every rendered surface all four walkers touched.
