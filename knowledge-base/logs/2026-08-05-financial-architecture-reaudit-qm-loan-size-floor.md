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
| F-17 | A non-QM dead band ($102k–$216k at the default comp plan) sits over the target segment | Unit economics / Risk | **High** — ✅ resolved |
| F-18 | The QM constraint is evaluated at the wrong end of the file — the fix is expired by the time the breach is found | Risk / Margin leakage | **High** — ✅ fixed |
| F-19 | Tax service fee counts in the QM denominator but not the numerator | Risk | Low — ✅ fixed |
| — | F-1…F-13 remediation holds at HEAD | all | ✅ verified |
| — | F-9 values, F-14 channel decision | — | ⚠️ still open, unchanged |

---

## F-17 — The fee schedule creates a non-QM dead band over the target market (High)

> **✅ Resolved 2026-08-05** — see [Resolution — F-17](#resolution--f-17-2026-08-05) below. The
> analysis in this section describes the platform as it was *before* that change; the bands quoted
> are what the fixed schedule produced, and they no longer occur. Kept intact because the
> reasoning is what motivated the fix.

### The architectural problem

Homiquity's borrower-facing charges are **fixed dollars** ($500 application + $1,500
underwriting + $100 tax service = $2,100, `server/services/loanCosts.ts`) while the QM
points-and-fees cap
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
> total, then a flat $4,139, then 3% — so a fixed platform-fee total clears the generous low
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
| BlueRiver | lender-paid 175 bps | **$116,515 – $173,039** | $173,040 |
| Summit | lender-paid 200 bps (default) | **$101,951 – $216,299** | $216,300 |
| Atlas | lender-paid 225 bps | **$90,623 – $288,399** | $288,400 |

(Each plan also fails below a low-end threshold — $73,499 at Summit — where the fixed fees exceed
even the 5% tier. Between that point and the band, files clear.)

> **Figures updated 2026-08-05 by the F-19 fix**, which added the tax service fee to the
> points-and-fees numerator. The bands above are post-fix and are what the code now enforces;
> they were $106,951–$206,299 (Summit) and $95,067–$275,067 (Atlas) before it.

Worked examples at the Summit default (200 bps):

| Loan amount | Platform floor | QM cap | Verdict |
|---|---|---|---|
| $100,000 | $4,100 | $4,139 (flat tier) | clears by $39 |
| $150,000 | $5,100 | $4,139 (flat tier) | **over cap** |
| $200,000 | $6,100 | $5,937 (3% tier) | **over cap** |
| $250,000 | $7,100 | $7,437 (3% tier) | clears by $337 |

**The band is non-monotonic in loan size, which is the strangest part.** A borrower at $100,000
is originable; the same borrower at $150,000 is not; at $400,000 they are again. Nothing about
the borrower changed — only which QM tier their loan amount lands in versus a fee that does not
move with it.

**Three properties make this worse than the table suggests:**

1. **The floor is a lower bound.** `pointsAndFeesFloor` counts only origination, points, the
   platform's own finance charges and comp. Every third-party charge that also counts toward
   §1026.32(b)(1) is excluded. The true band is **wider** than every figure above.
2. **The margins at the edges are nominal.** At Summit's $216,300 the file clears by single
   dollars, and at $100,000 by $39. These are knife edges, not thresholds with headroom.
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
buyers whose loan amounts fall mostly in the $102k–$216k range its own fee schedule cannot
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

This is a business decision the code can only make visible. The three levers — **lever 1 was
taken**, see the resolution section:

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
anyway. At the Summit default, that is the outcome for **every file between $101,951 and
$216,299** — not an
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

### Remediation — F-19 (2026-08-05)

**The fix is structural, not arithmetic.** Adding $100 to a list would have closed this instance
and left the class open: a fourth platform fee could be added tomorrow and counted in one
computation but not the other. So the classification became a single list, and both computations
read it.

- **`PLATFORM_FINANCE_CHARGES`** (`server/services/loanCosts.ts`) is now the one place that says
  which of the platform's own charges are finance charges under §1026.4.
- `knownPrepaidFinanceCharges()` sums it to derive the Reg Z Total Loan Amount — the
  **denominator**.
- `PointsAndFeesFloorInput.applicationFee` / `.underwritingFee` were replaced by
  `platformFinanceCharges: readonly PointsAndFeesComponent[]`, fed the same list — the
  **numerator**. Named fee fields were the mechanism that let the two drift; a list cannot.
- Both the ordinary sum and the borrower-paid `max(origination, comp)` branch use it, since that
  branch adds the platform total by hand and was a second place the asymmetry could hide.

**No new regulatory reading was made.** The code already asserted the tax service fee is a
finance charge, in `knownPrepaidFinanceCharges` and in `apr.ts`. This change propagates that
existing assertion to the third place rather than introducing a fourth opinion. If the
classification is wrong, it is now **one edit** and both computations correct together — which is
the property that was missing.

**What this costs, stated plainly.** Counting the fee widened the F-17 dead band: Summit's upper
edge moved $206,300 → **$216,300**, Atlas's $275,067 → **$288,400** (exactly as predicted above).
Roughly $10–13k of loan amounts per comp plan are now refused at the election that previously
were not. That is conservative against the QM cap, but it **refuses business**, so it is not
costless and must not sit unverified.

**Still open — and deliberately loud.** Whether a tax service fee *is* a finance charge under
§1026.4(a) could not be verified: `ecfr.gov` and `consumerfinance.gov` both returned CONNECT 403
in this environment, and there is still no local Reg Z copy under `docs/`. Ledger entry
`regz-1026-4-platform-finance-charge-classification` records exactly what was and was not
verified, carries the consequence above, and sits on a **30-day** review interval so
`pnpm checkup` goes loud if it is forgotten.

**Verification.** Typecheck clean · **2,110 tests green** · 4 new invariant tests pinning that the
floor's platform total equals what the stand-in subtracts, under both compensation branches ·
regulatory-freshness gate passes with the new entry.

---

## Resolution — F-17 (2026-08-05)

**The dead band is gone, and cannot come back.**

### Why no choice of fee resolved it

The band existed because a **fixed** dollar fee met a cap that is 5% in one tier, a flat $4,139
in the next, and 3% above that. Any fixed number is wrong at *some* loan size — so re-pricing the
schedule would only move the band, and the annual CFPB threshold adjustment would move it again.
Declaring a minimum loan amount would not resolve it either; it would abandon the segment and go
stale every January.

What had to go was the fixedness.

### What shipped

**The platform's own fees are now a ceiling, not a price.** A file is charged the standard
schedule whenever it fits; when it does not, the reducible part is trimmed proportionally until
it does.

- `maxPlatformFinanceChargeTotal()` binary-searches the exact largest platform total that clears
  the cap — monotone in the total, since a bigger fee raises the floor *and* lowers the cap — so
  the tier tables are never duplicated.
- `resolvePlatformFinanceCharges()` scales the reducible charges to that budget, rounding **down**
  to whole dollars so rounding can never push a file back over.
- **Only what is ours is reducible.** The tax service fee is a vendor's charge passed through; we
  cannot discount someone else's fee, so it is marked `reducible: false` and survives at full
  value. That asymmetry is what keeps the fit honest.
- `evaluateFileQmFloor()` is what the gates now score — the file **as it would actually be
  charged**, so a file is no longer refused over a fee it was never going to be charged.

Charging less than a disclosed schedule is always permitted, needs no changed circumstance, and
is the borrower-favourable direction — so the mechanism is safe in exactly the direction that
matters.

### Measured result

Swept at $1 granularity from $20,000 to $500,000, at every seeded comp plan:

| Comp plan | Before | After |
|---|---|---|
| BlueRiver 175 bps | dead band $116,515–$173,039 | **clears everywhere** |
| Summit 200 bps | dead band $101,951–$216,299 | **clears everywhere** |
| Atlas 225 bps | dead band $90,623–$288,399 | **clears everywhere** |
| 275 bps (plan maximum) | failed even at $400,000 | **clears everywhere** |

Worked cost, Summit 200 bps: $400k charges the full $2,100 (unchanged); $200k charges $1,940;
$150k charges $1,456; $120k charges $1,738. **No file that works today pays more or less than it
did** — the trim only touches files that were previously refused outright, converting a fully
costed zero-revenue file into a funded one.

### The honest residual

This does not manufacture room that does not exist. When **compensation alone** exceeds the cap —
at or above roughly 300 bps, since the top tier caps points and fees at 3% — there is nothing left
to trim toward. Those files stay non-originable, the schedule stays standard rather than
pretending, and the gates still refuse them. That is a comp-plan problem, and the fix is a comp
plan, not a fee.

The election ceiling now reflects this: it is bounded by compensation (~293–297 bps across the
range) rather than collapsing on small loans.

### What a human must confirm — this narrows an earlier invariant

The F-1 remediation asserted that borrower-facing totals are **wholly invariant** to lender-paid
compensation, because the Loan Estimate has no "paid by others" column. That is no longer
literally true: compensation and our fees consume the same cap, so a richer comp plan now yields a
*smaller* borrower fee. The test that encoded the old invariant is what caught this.

What survives, and is now pinned instead, is the property that carries the regulatory weight:

- compensation is **never added** to any borrower-facing total, and
- **more compensation can never increase a borrower charge** — the directional invariant.

Economically this is a lender credit and it always runs in the borrower's favour. But whether a
fee that varies with the comp plan is acceptable disclosure practice is a **counsel question, not
an engineering one**, and so is the fair-lending posture of a formulaic reduction driven by loan
amount. Both are recorded in ledger entry `platform-fee-schedule-qm-fit` on a **30-day** review
interval.

### Follow-on — the levers became operable, not just visible (2026-08-05)

Resolving F-17 in code left both of its inputs still requiring a deploy to move: the fee schedule
was compile-time constants, and the wholesale comp bands were seed data with no surface. Since
those are exactly the numbers a lender negotiation changes, they are now admin-editable.

- **`platform_fee_schedules`** (migration `0047`) — **append-only and versioned**. Publishing
  supersedes the active row and inserts a new one inside one transaction; nothing is ever updated
  in place, because a fee schedule is a fact about how a file was priced and an issued Loan
  Estimate has to stay reproducible. A partial unique index makes a concurrent double-publish fail
  loudly rather than leaving two rows claiming to be current.
- **No seed row, deliberately.** An empty table means "use the compiled-in baseline"
  (`DEFAULT_PLATFORM_FEE_SCHEDULE`). Seeding the constants into the table as well would fork the
  baseline in two places and let them drift.
- **Purity is preserved.** `services/loanCosts.ts` still reads no global — every function takes
  the schedule as a *parameter*. `services/platformFeeSchedule.ts` is the one impure edge that
  reads the published row and hands it in, with a short cache invalidated on publish and a
  fall back to the baseline if the read fails, so pricing never hard-fails on a config table.
- **The admin panel previews before it publishes** (`/admin/pricing-policy`). Raising fees does
  not merely raise revenue — it eats the room compensation needs — so the page shows, per loan
  size, what would actually be charged, whether our own fees get trimmed, and the resulting comp
  ceiling. A fee change also cannot be anonymous: a reason is required and the publish is audited.
- **Wholesale comp bands** were already DB-backed and simply had no surface; they now have one,
  with the same audit trail.

F-19's invariant is pinned for *any* schedule, not just the default: `tests/platformFeeSchedule.test.ts`
asserts the numerator and denominator draw on the same total whatever an admin publishes.

**F-17's business levers are therefore spent down to one.** Fees are no longer the constraint at
any loan size. What remains is the comp-plan ceiling — and that is a negotiation, not a code
change.

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

1. **F-18 first.** ✅ done — a wiring change over functions that already existed, converting F-17
   from a discovered-too-late blocker into a decision made at the one moment it is still free.
2. **F-19 with it** — ✅ done, and it corrected the numbers F-18 surfaces.
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

Typecheck clean · **2,106 tests green** (+35: 1,859 server / 247 client) · new suite
`tests/compensationElectionQmGate.test.ts` + 7 added component tests · KB index, doc-freshness,
schema, delivery-stack freeze and design-token guards all pass. No migration, no schema change,
no behaviour change to any borrower surface.

Not visually verified in a browser — the card is covered by component tests and the token guard,
which is where this repo draws that line.

### The staff card (follow-on, shipped same day)

The endpoint alone still made staff learn the cap by tripping the 422 — the F-18 sequencing
defect one layer up. So the read side landed with it:

- **`GET /api/loan-applications/:id/compensation/qm`** — same internal-staff, assignment-scoped
  gates as the PATCH, read-only so no audit entry. Returns the ceiling **per compensation model**
  (they price differently, and the dialog toggles between them without refetching) plus the
  current election's score.
- **One scorer for both.** `buildQmPicture()` is what the PATCH refuses off and the GET reports
  off, so the two surfaces cannot disagree about a file — the same argument that put the basis in
  `loanCosts.ts` in the first place, applied one level up.
- **`CompensationCard.tsx`** shows the headroom on an elected file (labelled *platform charges
  only, so the true figure is higher* — a floor must never read as a cleared figure), shows the
  ceiling under the bps input, and **disables Save above it**, mirroring the server's 422 the same
  way the card already mirrors the post-LE 409. When no rate clears at all (F-17), it says so in a
  `warning` Alert instead of leaving staff hunting for a number that does not exist.
- A file with no loan amount yet is left unconstrained: the ceiling is absent, not zero.

7 component tests (`CompensationCard.test.tsx`, 14 total) plus source-walk guards pinning that
the card consumes the ceiling and that both surfaces build from one helper.

### Deliberately left open at the time

- **F-17 was untouched by F-18.** Surfacing the constraint at the right time is not resolving it.
  That resolution landed the same day — see below.

---

## Security review — TEAM_PRACTICES §9 (2026-08-05)

The admin pricing-policy surface adds `requireRole("admin")` gates, which is a §9
**role/permission gate** trigger. Structured pass run before merge; outcome recorded in the PR
body per §9. **No HIGH or MEDIUM findings.**

Covered: authorization (5/5 new admin endpoints gated, pinned by a count-parity test; the new
staff QM read endpoint reuses the sibling PATCH's `isInternalStaffRole` +
`verifyInternalStaffApplicationAccess` assignment scoping), SQL injection (Drizzle-parameterized
throughout; the one raw fragment interpolates a column reference, not a string), mass assignment
(Zod strips unknown keys, and `version`/`createdBy`/`effectiveFrom` are server-derived — the
session supplies `createdBy`, never the body), XSS (React, no `dangerouslySetInnerHTML`), CSRF
(covered — the only carve-out is `/api/webhooks/`), and data exposure (the new table holds no
PII, and is not on `RESPONSE_BODY_LOG_ALLOWLIST`).

Confirmed by inspection that neither of the two triggers the guard **cannot** see is present: no
`shared/schema/` column holding PII, and no new PII sub-processor.

> **Correction to the merge commit `2cacf33`.** Its message states "no TEAM_PRACTICES §9 trigger
> among the 28 changed files". That was wrong. The local guard invocation behind that claim passed
> only file *names*; CI passes the diff *content*, which is what detects an added `requireRole`.
> CI was right and the commit message is not — the trigger fired, and the review above is the
> response. Recorded here because a pushed commit message cannot be corrected in place.

---

## Provenance

Re-audit run 2026-08-05 against HEAD `7621686`. Figures produced by executing the repository's
own `evaluatePointsAndFeesFloor` against the 2026 QM threshold table and the seeded comp plans;
the algebra was independently confirmed against the code's output at every threshold quoted.

Regulatory readings are flagged rather than asserted where they require verification, per the
CLAUDE.md rule against answering compliance questions from memory. F-17's comp-plan-flexibility
point and F-19's numerator/denominator question both need counsel.
