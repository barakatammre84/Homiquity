# Selling Guide conformance ledger

**Source of truth:** Fannie Mae *Selling Guide*, edition **08-05-2026**, committed at
[`docs/fannie-mae/selling-guide/`](../../docs/fannie-mae/selling-guide/).

Per [CLAUDE.md](../../CLAUDE.md) the *Selling Guide* is the top of the Fannie document
hierarchy — it **controls over every job aid** in `docs/fannie-mae/`, and over anything in
this repo. Until 2026-08-20 that hierarchy was unenforceable in practice: the Guide itself
was not in the repo, the online job aid returns `403`, and several sections carried blocked
verdicts because there was nothing to check them against. It is now local and greppable.

## How to check a rule (no tooling required)

```bash
grep -n "B3-6-05" docs/fannie-mae/selling-guide/section-index.tsv
```

That gives the PDF page. Then read the section straight out of the committed text:

```bash
awk '/\[\[PAGE 523 /,/\[\[PAGE 531 /' docs/fannie-mae/selling-guide/selling-guide-text.txt
```

Every page in `selling-guide-text.txt` is prefixed `[[PAGE n | <section>]]`, so a plain
`grep -n` for any phrase tells you which section states it. Regenerate the text and index
after dropping in a newer edition with `python3 scripts/extract-selling-guide.py`.

⚠️ **Use `grep -F` for any phrase containing `$`.** BSD grep (the macOS default) treats the
`$` in `greater of $10 or 5%` as an anchor and returns **zero matches on text that is
verbatim present** — a false "the Guide doesn't say that", which is the worst possible failure
mode for a source-of-truth document. `grep -cF` on the same phrase returns 1. Extraction
artifacts also wrap lines mid-sentence, so a long quotation may legitimately span two lines:
grep a distinctive fragment, not a whole sentence.

`highlights.json` carries the 175 highlight annotations from the source PDF. In this
edition they mark the sections **revised in the 08-05-2026 release** — treat it as the
change list, not as commentary.

## Standing rule

A Selling Guide reading may **tighten** a gate or **remove** a borrower charge. It may never
loosen a gate in a way that creates the violation the gate guards against. Where the Guide
permits a borrower-favorable option that our stored data cannot evidence, we take the
conservative branch and record the gap below rather than assume the favorable path.

---

## Verified conforming

Checked against the 08-05-2026 text; code agrees. Re-verify on the next edition.

| Rule | Guide section | Where enforced | Value |
|---|---|---|---|
| Minimum representative credit score | B3-5.1-01 | `CONVENTIONAL_FICO_FLOOR` scalar | 620 |
| DU maximum DTI | B3-6-02 | `CONVENTIONAL_STRETCH_DTI` scalar | 50% |
| Manual max DTI (36% base, to 45%) | B3-6-02 | platform cap is stricter (43%) | conservative |
| MI coverage, 80.01–85% | B7-1-02 | `seedLendingGrids.ts` | 12% |
| MI coverage, 85.01–90% | B7-1-02 | `seedLendingGrids.ts` | 25% |
| MI coverage, 90.01–95% | B7-1-02 | `seedLendingGrids.ts` | 30% |
| MI coverage, 95.01–97% | B7-1-02 | `seedLendingGrids.ts` | 35% |
| Max LTV by units/occupancy | B2-1.2-01 | `CONVENTIONAL_MAX_LTV` matrix | 95/85/75; 90 second; 85/75 investment |
| Large deposit definition | B3-4.2-02 | `underwritingNuance.ts` | >50% of monthly qualifying income |
| Personal gifts | B3-4.3-04 | `underwritingNuance.ts` cite | cite verified |
| Allowable age of credit documents | B1-1-03 | reference only | four months on the note date |
| Lease payments always count | B3-6-05 | `assessLiabilities` | regardless of months remaining |
| Deferred student loan | B3-6-05 | `DEFERRED_STUDENT_LOAN_FACTOR` | 1% of balance |
| Rental income from lease / Form 1007 / 1025 | B3-3.8-01 | `income/paths/rental.ts` | 75% of gross rent, net of each property's own PITIA |
| Rental section renumbering | B3-3.8-01 (was B3-3.1-08) | cited in `rental.ts` | current cite, renumbering tracked |
| Reserves, second home | B3-4.1-01 | `requiredReserveMonths()` | 2 months |
| Reserves, 2–4 unit primary / investment | B3-4.1-01 | `requiredReserveMonths()` | 6 months |
| Qualifying rate, fixed-rate | B3-6-04 | `derivePricing` | note rate |
| Association dues inside PITIA | B3-6-03 | `qualifyingPitia` | included (C-6) |

Deliberate conservative overlays, already carried in
[`data/regulatory/regulatory-ledger.json`](../../data/regulatory/regulatory-ledger.json)
and unchanged by this pass: baseline DTI cap 43% (vs DU 50%), LTV cap 95% (97% programs not
offered), stock/retirement asset haircuts (the Guide requires none).

---

## Corrected 2026-08-20

### C-1 — Revolving lines reporting no minimum payment contributed $0 to the DTI

**B3-6-05, Revolving Charge/Lines of Credit.** "If the credit report does not show a
required minimum payment amount and there is no supplemental documentation to support a
payment of less than 5%, the lender must use 5% of the outstanding balance… For DU loan
casefiles… the greater of $10 or 5% of the outstanding balance."

Neither debt-summation path implemented this. A revolving line carrying a `0` minimum
payment — the normal shape of a pulled tradeline with no reported minimum — added **nothing**
to total monthly obligations. A $12,000 card understated the DTI by $600/month, which is the
one direction the standing rule forbids: it clears files DU would decline.

Fixed in `server/underwriting.ts` (`assessLiabilities`) and
`server/services/underwritingNuance.ts` (`adjustLiabilities`), both at the DU form (greater
of $10 or 5%). Pinned by `tests/sellingGuideMonthlyDebt.test.ts`.

### C-2 — Guideline branches were written against liability types the app cannot emit

`assessLiabilities` branched on `type === "installment"` and `type === "lease"`. The URLA
form writes `LIABILITY_TYPES` (`installment_loan`, `credit_card`, `auto_loan`, …), so
**neither branch could ever execute**. Two consequences:

- `toBePaidOff` was only tested *inside* the unreachable `installment` branch, so **B3-6-07
  (Debts Paid Off At or Prior to Closing) was entirely unimplemented** — a debt the borrower
  marked as being paid off at closing was still counted against them.
- The whole liability-type analysis was decorative while the suite stayed green.

Fixed by normalising the type before dispatch and hoisting the paid-off check ahead of every
type branch. This is the repo's standing silent-success class: an operation that does not
happen while the surface says it did.

### C-3 — Income seasoning cited the wrong topic

`underwritingNuance.ts` cited **B3-3.2** for the length-of-self-employment rule. B3-3.2-01 is
*Standards for Employment and Income Documentation* (verbal VOE, verifying business existence
within 120 days) and does not state that rule. The two-year history — and the under-two-year
allowance where returns show a full 12 months in the current business — is **B3-3.5-01**,
under the heading "Length of Self-Employment".

Corrected in the module and in the `complianceInvariants` assertion that had pinned the wrong
cite. The rule's behaviour was already correct; only the audit trail pointed at text that did
not contain it.

### C-4 — Reserve warnings used one flat threshold for every transaction type

**B3-4.1-01, Determining Required Minimum Reserves.** For DU casefiles: two months for a
second home; **six months** for a two- to four-unit principal residence, an investment
property, and a cash-out refinance with DTI over 45%.

Pre-underwriting warned at a flat two months for everything, which is wrong in both
directions at once:

- **Too lenient** where it matters. A borrower buying a three-unit primary or an investment
  property with three months of reserves cleared the bar silently while sitting four months
  short of what Fannie requires.
- **Over-attributed** where it does not. Fannie states no fixed DU minimum for a one-unit
  principal residence, yet the copy told those borrowers they were "below the 2-month reserve
  guideline" — presenting a platform preference as an agency rule.

`requiredReserveMonths()` now tiers by occupancy and unit count, and the borrower-facing copy
cites B3-4.1-01 only where the requirement is genuinely Fannie's, naming it "our own readiness
guideline" otherwise. `subjectProperty` already carried units and occupancy, so no schema
change was needed.

### C-5 — The revolving imputation was counted but not explained

Adding C-1 put the imputed revolving payment inside `adjustedMonthlyDebt`, and therefore
inside the DTI compared against the ceiling — but `hasHiddenDebt` still recognised only
deferred student loans and newly opened lines. A file pushed over the ceiling *purely* by the
imputation would have been held there with no flag and no explanation: the same silent-success
shape the fix was meant to remove. The cause list now includes it and the copy names it.

### C-6 — Association dues were absent from the qualifying housing expense

**B3-6-03, Monthly Housing Expense for the Subject Property.** PITIA is "the sum of the
following": P&I; property, flood, and mortgage insurance; real estate taxes; ground rent;
special assessments; **any owners' association dues**; any monthly co-op corporation fee; and
any subordinate financing payments on the subject property. It is explicitly "the monthly
housing expense used to calculate the debt-to-income (DTI) ratio."

The decision path computed PITIA as **P&I + MI + escrow**, and `estimateMonthlyEscrow` is
property tax plus homeowner's insurance only. Association dues were nowhere in it. Worse, they
were nowhere they *could* be: `urla_property_info` had no column for them. The figure existed
only on `loan_options.hoa_fees` — a display/offer row — and in the public calculators, which
collect it from visitors and then drop it.

So a condo borrower was decisioned with their dues omitted. At a routine **$300–800/month**
that is a larger DTI understatement than C-1, in the same forbidden direction.

Fixed across the capture path, not just the arithmetic:

- `migrations/0057_subject_property_association_dues.sql` — expand-only, nullable, **no
  DEFAULT**. Zero is a claim ("this property has no association"); defaulting every existing
  row to it would fabricate the exact figure the column exists to stop assuming.
- `computePaymentProjection` adds the dues to `estimatedMonthlyTotal` and reports them.
- **A null on an association-bearing type gaps the file.** `decisionEngine` returns
  `NEEDS_MORE_INFO` asking for the dues rather than qualifying on a housing expense it knows
  is incomplete. `isAssociationBearingPropertyType` covers condo / co-op / PUD / townhouse and
  the spelling variants intake actually produces — a detached SFR is left alone, where zero is
  a plausible default and gapping every file would be noise rather than rigor.
- The URLA property section captures it.

Still missing from PITIA and recorded below rather than faked: flood insurance, ground rent,
special assessments, and subordinate-financing payments (gap G-10).

### C-7 — The engine would decision on an undefined housing expense

Found by a fixture, not by design. Pointing `decisionEngine` at `qualifyingPitia` made an older
persona mock return a projection without that field — and **nothing failed**. The `undefined`
propagated through the DTI and reserve math and came out the far end as a decision reporting
**zero months of reserves on a file holding $2.05M in assets**. A decision computed on nothing,
rendered as a decision computed on something.

That is the dominant defect shape in this codebase, reached from a new direction: not an
operation that did not happen, but a number that was never there being spent anyway.

The engine now throws when the qualifying PITIA is not a finite number. It deliberately does
**not** fall back to `estimatedMonthlyTotal` — that is the figure which *excludes* association
dues, so a fallback would quietly resurrect C-6 the moment any caller went quiet. Pinned by
`tests/sellingGuideHousingExpense.test.ts`, which asserts the guard rather than the arithmetic,
because the arithmetic is precisely what failed to notice.

---

## Open gaps — recorded, not silently assumed

These are places where the Guide states a rule our stored data cannot evidence. Each is
currently resolved in the **conservative** direction. None is a violation; each is a reason a
borrower may be qualified more strictly than Fannie requires.

### G-1 — No remaining-term column on liabilities (B3-6-05, B3-6-07)

Installment debt counts only where **more than ten monthly payments remain**, and a loan paid
down to ten or fewer drops out of long-term debt. `urla_liabilities` has no remaining-term
column, so every installment debt is counted. Conservative, but it overstates DTI for
borrowers near the end of a car loan. Closing this needs a schema migration plus intake
capture — not undertaken here.

### G-2 — Documented $0 income-driven student loan payments (B3-6-05)

The Guide permits qualifying at **$0** where an income-driven plan is documented at $0, and
permits a fully amortizing payment from documented terms. Neither the plan type nor the
repayment terms are representable on `urla_liabilities`, so a $0-payment student loan is
imputed at 1% of balance. That is the conservative branch, and it denies borrowers a path the
Guide grants them.

### G-3 — Debt secured by virtual currency (B3-6-05, B3-4.1-04)

Loans secured by financial assets are excluded from recurring obligations, **except** that
"payment on any debt secured by virtual currency… must be included when calculating the
debt-to-income ratio." The codebase has no representation of virtual currency at all, as an
asset or as collateral, so the exception cannot currently be triggered — and equally cannot be
violated. Becomes live the moment crypto assets are accepted.

### G-4 — Open 30-day charge accounts (B3-6-05, B3-6-07)

Fannie does **not** require open 30-day charge accounts in the DTI, but where such an account
shows no monthly payment (or a payment identical to the balance) the lender must verify
borrower funds covering the balance, **in addition to** closing costs and reserves. The
liability vocabulary cannot express "open 30-day", so such an account is entered as
`credit_card` and now attracts the 5% revolving floor — stricter than Fannie on the DTI side,
while the reserves-verification requirement is unimplemented.

### G-5 — `half_percent_balance` is an FHA figure in a product-agnostic vocabulary

`STUDENT_LOAN_TREATMENTS` offers `half_percent_balance` (0.5%). That is **not** a conventional
option — B3-6-05 offers 1% or a documented fully amortizing payment. It is a legitimate FHA
treatment and the enum is shared across `PRODUCT_TYPES`, so it is deliberately **left in
place**; `product_rules` is not seeded or read today. Flagged so no future session wires 0.5%
into a conventional path.

### G-9 — The cash-out-refinance reserve leg is unimplemented (B3-4.1-01)

B3-4.1-01's six-month requirement also covers "a cash-out refinance transaction with a DTI
ratio greater than 45%". `derivePreUnderwritingFlags` runs on the purchase intake — it carries
a purchase price and a down payment and has no refinance shape — so that leg cannot fire. It
is not wrong today; it becomes a gap the moment refinance files enter pre-underwriting.

### G-11 — The disclosed Loan Estimate still omits association dues (Reg Z, not Selling Guide)

C-6 added association dues to the **qualifying** PITIA (`qualifyingPitia`) and deliberately left
`estimatedMonthlyTotal` — the figure that holds byte-parity with the Loan Estimate's
`projectedPayments.years1Through5` — unchanged. They are two figures under two regimes:
B3-6-03 governs what Fannie qualifies on and is verifiable against the committed Guide; what
belongs on the **disclosed** projected-payments table is Reg Z §1026.37(c), and
[`docs/reg-z/`](../../docs/reg-z/) still holds no captured source text.

Per CLAUDE.md's Reg Z rail a reading there is **flagged, never asserted**, and may never be
acted on unilaterally — changing a borrower disclosure on an unverifiable reading is precisely
what the rail exists to prevent. So the disclosure is left as-is and the question is recorded
here: whether §1026.37(c)(4)'s "Estimated Taxes, Insurance & Assessments" line should carry
association dues, and how the escrowed/not-escrowed split is presented, needs the captured
Reg Z text — i.e. the same procurement that unblocks the other eleven ledger entries.

### G-12 — ARM qualifying rate is unimplemented, and an ARM product is already seeded

**B3-6-04, Qualifying Payment Requirements.** The qualifying rate is the note rate only for
fixed-rate mortgages. An ARM with a five-year initial fixed period must be qualified at the
**greater of** the note rate plus the first rate-change cap, or the fully indexed rate; an ARM
with a three-year-or-shorter initial period, at the maximum rate that could apply during the
first five years.

None of that exists — there is no `qualifyingRate`, no first-rate-change cap, and no fully
indexed rate anywhere in the codebase. **Today this is not a live defect:** `derivePricing`
prices only `conventional` / `fha` / `va` at a fixed 360-month term, so the note rate *is* the
correct qualifying rate for everything it can produce.

🚨 **But the trap is already loaded.** `server/seedMarketPricing.ts` seeds a *5/6 ARM
(30-Year Term)* with `productType: "ARM"`, and the URLA offers `adjustable` as an amortization
type. The moment anything routes a file to that product, every ARM borrower is qualified at the
teaser rate — understating the payment and the DTI in the forbidden direction. Wiring ARM
pricing **requires** B3-6-04 in the same change; do not treat the qualifying rate as a
follow-up.

### G-13 — Temporary buydowns must not be qualified at the bought-down rate (B3-6-04)

"Loans subject to temporary interest rate buydowns must be qualified without consideration of
the bought-down rate." Buydowns are not modeled in pricing, so we qualify at the note rate by
default and conform by construction. The exposure is that Illinois DPA programs already in
`server/seedData/illinoisDpa.ts` explicitly allow their funds to go toward "a mortgage rate
buydown" — so the product can reach a bought-down borrower before the engine can represent one.
Same rule as G-12: whoever models the buydown owes the qualifying-rate carve-out with it.

### G-10 — Four PITIA components still absent (B3-6-03)

B3-6-03 lists eight components; C-6 closed the association-dues one. Four remain unmodeled:

- **flood insurance premiums** — nothing in the codebase models flood insurance as a payment
  component (`floodCertFee` is a closing fee, and a CoreLogic flood adapter is seeded but
  unused). Material in a SFHA, where premiums run into the thousands annually.
- **ground rent** — leasehold estates are governed by B2-3-03, revised in this very release.
- **special assessments** — common on condos with pending capital work, and the same B4-2.1-03
  review that flags "unaddressed critical repairs" is the context they arise in.
- **subordinate financing payments on the subject property** — `CLTV` exists on the
  underwriting schema and `subordinateFinancingExists` on the delivery record, so the concept
  is represented at delivery but not in the qualifying payment. A piggyback second's payment is
  therefore outside PITIA.

Each understates the housing expense where it applies. None is fabricated as zero today
because none is captured at all; the honest fix is capture, as C-6 did for dues.

### G-7 — Jumbo routing uses the one-unit limit for 2–4 unit properties (B2-1.5-01)

B2-1.5-01: the conforming limits "vary, depending upon the number of units in the property and
the property's location." `shared/lendingLimits.ts` carries a single figure — the 2026 one-unit
baseline, $806,500 — and `underwritingEngine.ts` compares **every** loan against it, while the
engine's own `CONVENTIONAL_MAX_LTV` matrix supports 2, 3 and 4 units. A conforming 3-unit
purchase is therefore routed to jumbo MANUAL_REVIEW well below Fannie's 3-unit limit.

Conservative — it is a review, not a decline — but it misroutes legitimately conforming
multi-unit files. **Not fixable from this document:** the Guide states only that the limits are
posted on Fannie Mae's website and set by the regulator; it publishes no dollar figures. The
2–4 unit and high-cost tables must come from FHFA and be entered like any other external
number, not inferred.

### G-8 — No high-cost / high-balance handling (B2-1.5-01, Chapter B5-1)

The same topic distinguishes baseline limits from **high-cost area** limits, and routes
high-balance loans to Chapter B5-1 with its own eligibility and delivery requirements. Neither
the high-cost limits nor the B5-1 overlay is modeled. With launch scoped to Illinois — where
the relevant counties sit at the baseline — this is latent rather than active, and it becomes
live the moment a high-cost state (CA is the named next market) is opened. Same procurement
dependency as G-7.

### G-6 — Sections revised in the 08-05-2026 release, not yet scrubbed

The PDF's highlights mark this release's revised sections. Those touching engines we have
built (B3-6-05, B3-5.3-09) are covered above. The remainder are **unreviewed against our
code** and are mostly property/project/insurance surfaces we have not built yet:

- B2-3-03 Leasehold Estates — co-op ground-lease renewal, UAD 3.6 Policy Supplement
- B4-2.1-01/-02/-03, B4-2.2-01/-02/-04, B4-2.3-01 — condo/PUD/co-op project standards,
  single-entity ownership caps (2 units / 2 units / 20%), PERS
- B5-3.2-05, B5-3.3-01 — HomeStyle completion certification and Refresh
- B5-5.2-02 — resale restrictions
- B7-3-02/-03/-04/-07, B7-4-01/-02 — property, master and unit insurance; general liability
  and fidelity/crime ($50,000 max per-unit deductible; fidelity waived at ≤20 units or
  ≤$5,000 coverage)
- C3-6-01 Fannie Majors pooling, E-2-04 inter vivos revocable trusts, A4-1-01 seller/servicer
  eligibility

**B3-5.3-09, DU Credit Report Analysis** (also revised) states that DU takes authorized-user
tradelines into account in its risk assessment with no additional lender investigation unless
DU instructs otherwise. We do not model authorized-user status on tradelines; nothing in our
code contradicts the section.

---

## Maintenance

When a new Selling Guide edition arrives:

1. Replace the PDF in `docs/fannie-mae/selling-guide/` and re-run
   `python3 scripts/extract-selling-guide.py`.
2. Diff `section-index.tsv` — sections whose parenthesised date changed are the release's
   change list, and the PDF's own highlights corroborate it.
3. Re-check every row in **Verified conforming** whose section appears in that diff.
4. Record the outcome here. A rule checked and found conforming is worth as much as a fix;
   the next session should not have to re-derive it.
