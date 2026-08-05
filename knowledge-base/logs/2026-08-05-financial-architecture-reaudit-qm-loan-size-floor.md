# Financial Architecture Re-Audit — 2026-08-05

**Scope:** the same four areas as the [2026-08-04 audit](./2026-08-04-financial-architecture-capital-structure-audit.md)
— capital flow, risk/liability, unit economics, balance sheet — re-run against HEAD one day
later, after that audit's remediation wave landed.

**Method:** verify the prior fixes still hold at HEAD, then look for what the prior pass left
uncalculated or missed. Every figure below was computed by executing the repository's own
functions (`evaluatePointsAndFeesFloor`, `knownPrepaidFinanceCharges`, the 2026 QM threshold
table), not estimated.

**Bottom line.** The 2026-08-04 remediation holds — 2,071 unit tests green, both capital-flow
gates intact. But that audit closed with an explicit instruction it did not carry out — *"the
product has an implicit minimum viable loan amount that nobody has calculated. **Calculate
it.**"* This pass calculated it, and the answer is the most consequential financial finding on
the platform: **at every seeded lender-paid comp plan, the platform's own fee schedule puts a
band of loan amounts over the QM cap before a single third-party charge is added — and that band
sits over the segment the product is built to serve.**

---

## Severity-ordered summary

| # | Finding | Area | Severity |
|---|---|---|---|
| F-17 | A non-QM dead band ($107k–$206k at the default comp plan) sits over the target segment | Unit economics / Risk | **High** |
| F-18 | The QM constraint is evaluated at the wrong end of the file — the fix is expired by the time the breach is found | Risk / Margin leakage | **High** |
| F-19 | Tax service fee counts in the QM denominator but not the numerator | Risk | Low |
| — | F-1…F-13 remediation holds at HEAD | all | ✅ verified |
| — | F-9 values, F-14 channel decision | — | ⚠️ still open, unchanged |

---

## F-17 — The fee schedule creates a non-QM dead band over the target market (High)

### The architectural problem

Homiquity's borrower-facing charges are **fixed dollars** ($500 application + $1,500
underwriting = $2,000, `server/services/loanCosts.ts:44-46`) while the QM points-and-fees cap
above $137,958 is a **percentage** (3% of the Reg Z Total Loan Amount,
`shared/fannieMae/qmThresholds.ts`). Originator compensation is a third input, set in basis
points.

A fixed cost against a cap that is a percentage in some tiers and a flat dollar amount in others
does not bind smoothly. There are loan amounts at which the platform's **own** charges exhaust
the entire QM cap, and no file at those amounts can be originated as a QM loan at that comp plan,
regardless of how clean the borrower is. Because the cap's *shape* changes across tiers while the
fee does not, those amounts form a band with originable loans on either side rather than a simple
floor.

Where that band sits had never been computed.

### Quantified — computed from the repo's own functions

> **Correction (2026-08-05, same day).** This section originally reported a single *minimum
> viable loan amount* per comp plan. That framing was wrong, and the test written to pin it
> caught the error. The QM cap changes **shape** across the note-date tiers — 5% of the Reg Z
> total, then a flat $4,139, then 3% — so a fixed $2,000 of platform fees clears the generous low
> tiers, fails once the loan outgrows the flat tier, and clears again when 3% of a large loan
> outruns it. The real structure is a **dead band with viable amounts on both sides**, not a
> floor. The numbers first reported ($166k / $207k / $276k) were the band's *upper* edge —
> correct as "the amount above which every file clears", but they wrongly implied everything
> below fails. Corrected figures below; `tests/compensationElectionQmGate.test.ts` now pins the
> edges.

Sweeping loan amounts at $1 granularity through the platform's own floor evaluation, at the comp
plans seeded in `server/seedMarketPricing.ts:77,97,117`, with a 2026 note date:

| Wholesale lender | Comp plan | **Non-QM dead band** | Clears above |
|---|---|---|---|
| BlueRiver | lender-paid 175 bps | **$122,229 – $165,039** | $165,040 |
| Summit | lender-paid 200 bps (default) | **$106,951 – $206,299** | $206,300 |
| Atlas | lender-paid 225 bps | **$95,067 – $275,067** | $275,068 |

(Each plan also fails below a low-end threshold — $70,166 at Summit — where the fixed fees exceed
even the 5% tier. Between that point and the band, files clear.)

Worked examples at the Summit default (200 bps):

| Loan amount | Platform floor | QM cap | Verdict |
|---|---|---|---|
| $100,000 | $4,000 | $4,139 (flat tier) | clears by $139 |
| $150,000 | $5,000 | $4,139 (flat tier) | **over cap** |
| $200,000 | $6,000 | $5,937 (3% tier) | **over cap** |
| $250,000 | $7,000 | $7,437 (3% tier) | clears by $437 |

**The band is non-monotonic in loan size, which is the strangest part.** A borrower at $100,000
is originable; the same borrower at $150,000 is not; at $400,000 they are again. Nothing about
the borrower changed — only which QM tier their loan amount lands in versus a fee that does not
move with it.

**Three properties make this worse than the table suggests:**

1. **The floor is a lower bound.** `pointsAndFeesFloor` counts only origination, points, the two
   platform fees and comp. Every third-party charge that also counts toward §1026.32(b)(1) is
   excluded. The true band is **wider** than every figure above.
2. **The margins at the edges are nominal.** At Summit's $206,300 the file clears by single
   dollars, and at $100,000 by $139. These are knife edges, not thresholds with headroom.
3. **Comp plans are not a per-file dial.** A wholesale comp plan is set with the lender for a
   period, not elected loan-by-loan — so "use fewer bps on small loans" is very likely not
   available as a remedy. **This needs counsel confirmation against §1026.36(d)(1) before it is
   relied on in either direction**; it is flagged, not asserted.

### Why this is a business-model finding and not a pricing detail

The platform's stated go-to-market is Illinois first-time buyers with down-payment assistance.
The seeded IHDA programs in `server/seedData/illinoisDpa.ts` cap assistance in ways that reveal
the price band they serve — IHDAccess Repayable at 10% up to $10,000 (a ~$100k price),
Forgivable at 4% up to $6,000 and Deferred at 5% up to $7,500 (~$150k), Home at 6% up to $15,000
(~$250k).

**That price band maps onto loan amounts that sit largely inside the dead band.** The company has
built an Illinois DPA directory, a gap calculator, a renter incubator and a DPA wizard aimed at
buyers whose loan amounts fall mostly in the $107k–$206k range its own fee schedule cannot
originate as QM at the default comp plan.

### The consequence is a hard stop, not a warning

An over-cap file is a **blocker**, not an advisory, at both money-path chokepoints:

- `server/routes/aus.ts:189-198` — the AUS gate refuses to build a DU casefile when
  `criticalErrors` is non-empty, and the QM breach is pushed there
  (`server/services/mismoValidation.ts:738`).
- `server/services/brokerSubmissionReadiness.ts:191-192` — lender-package assembly pushes
  `"QM pre-flight: points and fees exceed the Reg Z cap for this loan amount"` as a package
  blocker.

So the file is fully costed — credit pull, LO labor, disclosures, possibly an appraisal — and
then cannot be submitted. **Revenue is zero and cost is fully incurred.** This is the F-11
pull-through leak with a specific, predictable, segment-wide cause rather than a random one.

### Structural fix

This is a business decision the code can only make visible. The three levers:

1. **Re-scale the platform fees against loan size** — the $2,000 is fixed against a percentage
   cap. A fee that is capped as a percentage of the loan amount removes the structural floor
   rather than moving it.
2. **Negotiate a lower comp plan** as the standing plan, accepting less revenue per file in
   exchange for the small-loan segment being originable at all.
3. **Declare the minimum loan amount as product policy** and disqualify below it at intake —
   the honest version of the status quo, which spends acquisition cost on files that cannot
   close.

Whichever is chosen, **encode the floor as a constant and check it at intake**, so a file that
cannot clear QM is never opened rather than being discovered dead at submission.

---

## F-18 — The QM constraint is evaluated at the wrong end of the file (High)

### The architectural problem

`evaluatePointsAndFeesFloor` has exactly **one** consumer in the entire repository:
`server/services/mismoValidation.ts:526` — the submission-readiness path. Verified by grep across
`server/`, `client/` and `shared/`.

The single field that determines whether a file can clear QM is the compensation election. It is
written by `PATCH /api/loan-applications/:id/compensation`
(`server/routes/lending/pricing.ts:51-112`), which validates `bps` as
`z.number().int().min(0).max(1000)` — **any value in that range is accepted with no QM feedback
whatsoever.** The staff UI that calls it (`client/src/pages/staff/borrowerFile/CompensationCard.tsx`)
likewise shows no cap, no headroom, and no warning.

And the election **freezes** once the Loan Estimate issues — the same route returns
`409 compensation_locked_after_le`, correctly, because changing who pays the originator after
disclosure is a changed-circumstance and redisclosure event.

### The sequencing defect

Put together, the lifecycle is:

1. Staff elect comp (no QM check available at this moment).
2. The Loan Estimate issues — **the election is now locked**.
3. The file progresses, accruing cost.
4. At AUS or package assembly, the QM floor is evaluated for the first time and **blocks**.
5. The only remedy is the field frozen at step 2, now reachable solely through a documented
   changed circumstance and redisclosure — if at all.

**The check runs after its own remedy expires.** That is the architectural defect: the constraint
is knowable at step 1 from data the system already has (loan amount, comp bps, the fee schedule
constants), and it is deferred to step 4.

### Quantified

Every file in the F-17 band that reaches step 4 is a full origination cost converted to zero
revenue. Using the prior audit's own cost lines, a fully-costed file that dies at submission
forfeits the $8,000–$11,000 of comp it would have earned and consumes the cost-to-originate
anyway. At the Summit default, that is the outcome for **every file between $106,951 and
$206,299** — not an
edge case in the target segment but the modal one.

### Structural fix

Call `evaluatePointsAndFeesFloor` **inside the compensation-election endpoint** and return the
QM-safe maximum bps for this file's loan amount alongside the election. Two behaviours follow
naturally:

- The election response carries `maxQmSafeBps` and remaining headroom in dollars; the staff card
  renders it next to the bps input.
- An election that puts the file over the cap on the platform's own charges alone is refused at
  election time — the one moment when changing it is still free.

The function, the thresholds and the fee constants all already exist and are already exported
for exactly this reason (`loanCosts.ts:41-43` says so explicitly: *"two surfaces, one
schedule"*). This is a wiring change, not new math.

---

## F-19 — The tax service fee counts in the QM denominator but not the numerator (Low)

`PLATFORM_TAX_SERVICE_FEE` ($100) is treated as a **prepaid finance charge** in two places —
`knownPrepaidFinanceCharges` (`loanCosts.ts:61`) and the APR computation
(`server/services/apr.ts:150`). It is **absent** from `pointsAndFeesFloor`'s components
(`shared/compliance/loCompensation.ts:146-158`).

The same $100 therefore *reduces* the Reg Z Total Loan Amount (shrinking the cap) while *not*
being counted against that cap. Since §1026.32(b)(1)(i) draws points and fees from the finance
charge, a charge the platform itself classifies as a finance charge in two places should appear
in both computations or neither. **Which of the two treatments is correct needs verification
against the regulation** — this finding asserts only that they are inconsistent with each other.

**Impact, computed:** including it widens Summit's dead band, moving its upper edge from
**$206,300 to $216,300**, and Atlas's from **$275,067 to $288,400**. Given F-17's $7 margin at the
threshold, a $100 systematic understatement is decisive precisely in the band where files sit.

**Fix.** Add the tax service fee to `PointsAndFeesFloorInput` and to the floor's components, or
document why a finance charge is excluded from points and fees. Note the floor is documented as
a lower bound, so the omission is not *wrong* — but this is a charge the platform knows and has
already classified, not an unknown third-party item, so leaving it out makes the bound looser
for no benefit.

---

## Verified — the 2026-08-04 remediation holds at HEAD

Re-checked directly, not taken from the log:

- **Test suite green:** 140 server test files / 1,831 tests, plus 41 client files / 240 tests —
  **2,071 passing, 0 failing.**
- **F-3 (phantom lock) holds.** `POST /api/rate-locks` now requires `lenderId`,
  `lockConfirmationNumber`, `confirmedRate` and `confirmedExpiresAt`; it rejects an unknown
  wholesale lender (`unknown_lender`) and a confirmation already expired
  (`confirmation_expired`) — `server/routes/borrower/rateLocks.ts:56-75`. A lock can no longer be
  minted from an internal row alone.
- **F-5 (counterparty) holds**, and is handled thoughtfully downstream: `antiSteeringOptions.ts:60-73`
  derives a `singleCreditor` flag from the concentration position and declines to guess where
  counsel must draw the "significant number of creditors" line.
- **F-13** register and **F-6/F-11** comp and cost ledgers are present and covered
  (`shared/contingentLiabilities.ts`, `compensationLedger.ts`, `costLedger.ts`).

**Still open, unchanged from yesterday and correctly so:**

- **F-9** — fee provenance architecture shipped; all ten constants remain `platform_estimate`
  and transfer taxes remain `suspectedInaccurate`. Needs a human with the Illinois statute.
- **F-14** — the broker/correspondent channel decision remains founder-owned and open
  ([CHANNEL_DECISION.md](../governance/CHANNEL_DECISION.md)). The delivery-stack freeze guard is
  in place and the constant still reads `broker`.

### Counterparty concentration — restated, not a new finding

The audit prompt asks about concentration. The position is unchanged and already recorded under
F-5: with zero executed broker agreements, concentration is **100% on whichever lender signs
first**, and the platform correctly refuses to pretend otherwise (the `singleCreditor` flag
above). This is a founder/contracting constraint, not architectural debt — the code models it
honestly.

### Capital flow and balance sheet — no new findings

F-16 stands: the asset-light broker structure is correct, and there is no duration mismatch on
assets because there are no assets. The one place a broker takes duration risk — the rate
commitment — was closed by F-3 and the fix holds. Nothing in this pass changes that assessment.

---

## Recommended sequence

1. **F-18 first.** It is a wiring change over functions that already exist, and it converts F-17
   from a discovered-too-late blocker into a decision made at the one moment it is still free.
2. **F-19 with it** — same file, same test, and it corrects the number F-18 would surface.
3. **F-17 is a founder decision**, and it should be made before acquisition spend goes into the
   DPA/first-time-buyer segment. Fees, comp plan, or a declared minimum loan amount — one of the
   three has to move.

---

## Remediation — F-18 (2026-08-05)

**Shipped.** The QM points-and-fees floor is now evaluated at the compensation election, the
moment the outcome is decided and the last moment it is free to change.

### The basis moved to one place

The computation was previously assembled inline inside `services/mismoValidation.ts`, which is
why no other surface could reach it. It now lives in `services/loanCosts.ts` — beside the fee
schedule it is derived from, on the same "two surfaces, one schedule" principle that already
governs the exported fee constants:

- `regulationZTotalLoanAmountStandIn(loanAmount, compensation)` — the §1026.32(b)(4) stand-in,
  accepting a null election (no election ⇒ no borrower-paid origination fee to subtract).
- `evaluatePlatformQmFloor(noteDate, loanAmount, compensation)` — the three-valued verdict.
- `estimatedNoteDate(closingDate)` — the note-date convention, shared so both surfaces select
  the same threshold table.
- `maxElectableCompensationBps(noteDate, loanAmount, model)` — the highest whole-bps rate that is
  not definitively over cap, or **null** when the fixed platform fees alone exhaust the cap, in
  which case no rate rescues the file and F-17's levers are the only remedy.

`mismoValidation.ts` now calls the same helpers, so the election and the submission check cannot
score one file differently.

### The gate

`PATCH /api/loan-applications/:id/compensation` evaluates the *requested* election before writing
it, and:

- **refuses `over_cap` with `422 qm_points_and_fees_exceeded`**, returning the floor, the cap, the
  tier, the component breakdown, `maxElectableBps`, and a remedy line that distinguishes "elect
  N bps or less" from "no compensation rate makes this file QM-eligible";
- **records every accepted election's headroom** in a `qm` block on the response
  (`floorAmount`, `maxAllowableAmount`, `headroomAmount`, `maxElectableBps`);
- **audits the refusal** as `loan_application.compensation_election_refused`, not only the
  successful election, so a blocked file leaves a trail.

Three properties are deliberate:

1. **Only `over_cap` refuses.** `not_cleared` is reported, never treated as a pass — the floor is
   a lower bound and the complete §1026.32(b)(1) figure is still unknown at election time.
2. **A missing loan amount cannot block.** A file with no purchase price yet returns
   `not_evaluated` and the election proceeds; pricing legitimately precedes a property.
3. **The refusal precedes the write.** Pinned by a test, so an over-cap election cannot be
   persisted and then reported.

### Verification

Typecheck clean · **2,095 unit tests green** (+24) · new suite
`tests/compensationElectionQmGate.test.ts` · KB index, doc-freshness, schema and delivery-stack
freeze guards all pass. No migration, no schema change, no behaviour change to any borrower
surface.

### Deliberately left open

- **The staff card does not yet render the headroom.** `CompensationCard.tsx` shows the election;
  the `qm` block and the 422's `maxElectableBps` are available to it but unwired. Staff learn the
  ceiling from the refusal message today, which is functional but late — wiring it into the input
  is the follow-on.
- **F-19 is not fixed here.** The tax service fee remains outside the floor's components, so the
  ceiling this endpoint reports is a hair generous. Fixing it moves the numbers, which is why it
  is its own change with its own test, not a silent rider on this one.
- **F-17 is untouched.** This surfaces the constraint at the right time; it does not resolve it.
  A file inside the dead band still cannot be originated — staff now learn that at election
  instead of at submission.

---

## Provenance

Re-audit run 2026-08-05 against HEAD `7621686`. Figures produced by executing the repository's
own `evaluatePointsAndFeesFloor` against the 2026 QM threshold table and the seeded comp plans;
the algebra was independently confirmed against the code's output at every threshold quoted.

Regulatory readings are flagged rather than asserted where they require verification, per the
CLAUDE.md rule against answering compliance questions from memory. F-17's comp-plan-flexibility
point and F-19's numerator/denominator question both need counsel.
