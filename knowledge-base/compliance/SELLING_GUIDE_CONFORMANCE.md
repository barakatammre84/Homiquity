# Selling Guide conformance ledger

**Source of truth:** Fannie Mae *Selling Guide*, edition **08-05-2026**.

The Guide itself is **not committed** — this repository is public and the Guide is Fannie
Mae's copyrighted work. One command materializes the whole corpus on your machine — in a
fresh clone it recovers the PDF from this repo's own git history, SHA-256-verified, with
no network (front door: [docs/fannie-mae/selling-guide/README.md](../../docs/fannie-mae/selling-guide/README.md)):

```bash
python3 scripts/extract-selling-guide.py
```

If it can find no PDF by any path it prints where it looked and **stops**. That is the
correct outcome, and it matches CLAUDE.md: a missing source is an honest gap, never a
licence to answer a Fannie policy question from memory.

Per [CLAUDE.md](../../CLAUDE.md) the *Selling Guide* is the top of the Fannie document
hierarchy — it **controls over every job aid** in `docs/fannie-mae/`, and over anything in
this repo. Until 2026-08-20 that hierarchy was unenforceable in practice: the Guide was not available
at all, the online job aid returns `403`, and several sections carried blocked verdicts
because there was nothing to check them against. It is now one command away, and the
sections that carried those verdicts (A2-2-04 p38, B3-2-01 p288, B3-2-02 p292) are present.

## How to check a rule

`section-index.tsv` is **tracked**, so finding the governing section needs nothing at all:

```bash
grep -n "B3-6-05" docs/fannie-mae/selling-guide/section-index.tsv
```

That gives the PDF page. Then read the section itself — the extraction writes one file
per section (gitignored — run the script above once if they are absent):

```bash
python3 scripts/extract-selling-guide.py --section B3-6-05
# …or open docs/fannie-mae/selling-guide/extracted/sections/B3-6-05.txt directly
```

For a page-bounded read of the whole-book stream, the older recipe still works:

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

`revised-sections.tsv` is **tracked** and lists the **25 sections revised in the
08-05-2026 release**, derived from the source PDF's 175 highlight annotations. Titles and
page numbers only — the annotated body text is quoted Guide content and is deliberately not
reproduced. Diff it against the next edition to scope a re-scrub.

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

**Amended 2026-08-22 (C-11):** the vocabulary named above is the *staff* `liabilities` table's
enum (`shared/schema/underwritingFinancials.ts`). The URLA picker that feeds
`urla_liabilities` — the rows `assessLiabilities` actually receives — writes its own labels
(`"Revolving (Credit Card)"`), which the normaliser turned into `revolving_(credit_card)`. So
the revolving branch C-1 added was still unreachable for every real row. See C-11.

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

- `migrations/0058_subject_property_association_dues.sql` — expand-only, nullable, **no
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

### C-8 — The engine never read the loan purpose, so cash-out files met purchase ceilings

**B2-1.3-02 (Limited Cash-Out Refinance)** and **B2-1.3-03 (Cash-Out Refinance)**. Both route
the maximum LTV, CLTV and HCLTV ratios to the **Eligibility Matrix** — a companion document
this repo does not hold (see G-14).

The funnel collects `loanPurpose`; it is driven by the `?type=` entry point
(`client/src/pages/lending/preApproval/entryType.ts`, whose own comment says "`loanPurpose`
drives program eligibility and pricing from there"), and the funnel branches its copy on
`cash_out`. But `underwritingEngine.ts`, `decisionEngine.ts` and `loanEstimate.ts` contained
**zero references to it**, and `CONVENTIONAL_MAX_LTV` is keyed on units × occupancy with no
purpose dimension. A cash-out file was therefore measured against the *purchase* ceiling —
95% for a one-unit primary — and approved well above the cash-out limit.

Fixed by routing any non-purchase purpose to **human review**, citing both topics and naming
the Matrix as the missing authority. Deliberately **no ratio is hardcoded**: we do not hold the
Matrix, and a fabricated ceiling would be exactly the failure this whole pass exists to
prevent. Tightening a gate is the only direction a reading may move without its source in hand.
Omitted purpose still defaults to `purchase`, so genuine purchase files are byte-identical.

### C-9 — An ARM could be declared, qualified at its teaser rate, and never delivered

Found by the capture-vs-consumption audit below, not by reading a section.

**B3-6-04, Qualifying Payment Requirements.** The note rate is the qualifying rate for
**fixed-rate mortgages only**. An ARM with a five-year initial fixed period qualifies at the
**greater of** the note rate plus its first rate-change cap or the fully indexed rate; three
years or less, at the maximum rate reachable in the first five years.

The chain that made this live rather than theoretical:

1. URLA Section 4a offers **"Adjustable Rate (ARM)"** (`AMORTIZATION_TYPE_OPTIONS`);
2. `loan_applications.amortization_type` stores it, written by the URLA save path;
3. `derivePricing` prices a 30-year fixed regardless, and the engine never read the column;
4. `mismoValidation` then **demands** `arm_index_type`, `arm_margin` and `arm_initial_cap` at
   delivery — columns nothing in the product writes.

So an ARM borrower was qualified at the teaser rate *and* could not be delivered. Both halves
were invisible: the first because the engine ignored a column, the second because the validator
only fires much later.

The engine now routes an adjustable file to human review, citing B3-6-04 and naming the missing
capture. Deliberately no rate or cap is invented — the terms needed to compute the real figure
are not captured, so this is uncomputable rather than merely unimplemented. Fixed-rate files are
byte-identical.

### C-10 — 🚨 The entire URLA Section 5 declarations table never reached the decision

**The largest finding of this pass.** Found by extending the capture-versus-consumption audit to
the URLA tables — the blind spot the first audit named.

`borrower_declarations` carries **33 columns** and reaches exactly two consumers: document
generation (`routes/lending/documents.ts`) and MISMO completeness scoring
(`mismoValidation.scoreDeclarations`). **Zero of it reached the decision path**, and no engine
file contained the words bankruptcy, foreclosure, short sale, judgment or federal debt at all.

So a borrower could declare a **foreclosure**, a **Chapter 7 bankruptcy**, a **deed-in-lieu**, a
**short sale**, **outstanding judgments**, or **delinquency on federal debt** — and be
decisioned exactly as though they had not. These are among the most basic conventional
eligibility rules there are.

**B3-5.3-07, Significant Derogatory Credit Events — Waiting Periods:**

| Derogatory event | Waiting period | With extenuating circumstances |
|---|---|---|
| Bankruptcy — Chapter 7 or 11 | **4 years** | 2 years |
| Bankruptcy — Chapter 13 | 2 years from discharge; **4 from dismissal** | 2 / 2 |
| Multiple filings in the past 7 years | **5 years** | 3 years |
| Foreclosure | **7 years** | 3 years (≤90% LTV, purchase primary or limited cash-out) |
| Deed-in-lieu, preforeclosure sale, charge-off of a mortgage | **4 years** | 2 years |

**And the schema cannot clear them either.** Every period runs from a discharge, dismissal or
completion **date**, and the columns are **booleans** (`has_been_foreclosed`,
`has_declared_bankruptcy`, with `bankruptcy_types` as free text). No dates are captured, so the
waiting period is uncomputable — the same shape as the ARM terms in C-9.

But being unable to **clear** an event is not a reason to **ignore** it. Declared events now
route to human review, citing B3-5.3-07 and naming the missing dates. No waiting period is
hardcoded, and the test asserts no "N years" literal appears in the block — a period applied to
data that cannot support it would be worse than none.

Read across **all borrowers** via `getAllBorrowerDeclarations`. Scoping to the primary would
have repeated G-15 exactly: counting a co-borrower's income while ignoring their risk. Pinned by
a test that fails if a co-borrower's foreclosure is invisible.

**Still not captured, and needed before any of this can be decided rather than reviewed:** the
event dates, whether extenuating circumstances are documented, and the number of prior filings
(the 5-year multiple-filing rule).

---

## The capture-versus-consumption audit (2026-08-22)

Five of the most serious findings on this page share one shape: **a value that exists in the
capture or marketing surface and is invisible to the engine** — HOA dues (C-6), loan purpose
(C-8), co-borrower credit (G-15), real estate owned (G-16), DPA seconds (G-21). That is a class,
not a coincidence, so it was worth measuring rather than continuing to find instances by
reading.

**Method** (repeatable): enumerate the columns on `loan_applications`, enumerate every
`app.<field>` / `application.<field>` reference across the decision and pricing path
(`decisionEngine`, `underwritingEngine`, `loanEstimate`, `preUnderwriting`, `scenarioSimulator`,
`income/orchestrator`, `underwriting`), and take the difference — excluding infrastructure
columns (ids, timestamps, AUS/HMDA/TRID bookkeeping, derived ratios).

**Result: 67 captured columns, 27 read by the decision path, 21 unread.** Triaged:

| Unread columns | Verdict |
|---|---|
| `amortizationType` + the 8 `arm_*` terms | 🚨 **Defect — C-9.** The form offers ARM; the engine ignored it; delivery demands terms nothing writes. |
| `totalPointsAndFees` | ✅ Sound. `mismoValidation` computes a lower bound from platform charges when it is absent and reports a **warning, never a pass** — a prior session already fixed the "missing ⇒ compliant" trap. |
| `incomeVerified`, `assetsVerified`, `creditVerified` | ✅ Read by `services/verification.ts`; they feed the provenance system the engine *does* consume. |
| `d1cAssetsRelief`, `d1cIncomeRelief`, `d1cEmploymentRelief` | ✅ Day 1 Certainty relief belongs to the AUS/autopilot lane, not the deterministic engine. |
| `employmentYears`, `employerName` | ✅ Read elsewhere; the engine deliberately prefers the authoritative `urla_employment` rows. |
| `propertyAddress`, `propertyCity`, `propertyZip` | ✅ `propertyState` is what pricing needs; the rest are not decision inputs. |
| `avoidsInterestFinancing` | ⚠️ Expected — the Islamic-finance lane is founder-gated. Note it is also one of the three funnel answers the autosave path drops (see the capture-path findings). |

One defect in twenty-one, and the rest explained. That is the useful outcome: the class is real
but it is now **enumerated**, and this table is the thing to re-run after any schema change
rather than rediscovering the shape a sixth time.

### Round 2 — the URLA tables (same method, the blind spot the first round named)

| Table | Cols | Reachable | Verdict |
|---|---|---|---|
| `borrower_declarations` | 33 | **0** | 🚨 **C-10** — the whole table stopped at document generation and MISMO scoring |
| `real_estate_owned` | 25 | 5 | Already G-16/G-17 — no borrower-facing capture path |
| `urla_property_info` | 21 | 6 | ✅ The 11 unread are address, county, legal description, mixed-use and manufactured-width — not decision inputs |
| `urla_liabilities` | 13 | 4 | ✅ The 5 unread are creditor name and the encrypted account-number quartet — correctly not decisioned on |
| `urla_assets` | 11 | 2 | ✅ Same: institution name and the encrypted quartet |
| `other_income_sources` | 5 | 5 | ✅ Fully consumed |

Two rounds, one method, two real defects (C-9, C-10) out of ~120 columns — and every other
unread column now carries a written verdict rather than an open question.

**What neither round could see:** values that exist only in a marketing surface with **no column
at all**, which is how G-21 (the DPA second liens) hid. That needs a different technique —
starting from what the product *promises* rather than from what it *stores*.

---

## Corrected 2026-08-22

> **Renumbered 2026-08-23.** These two entries were first recorded as C-9 and C-10, colliding
> with the pair of the same numbers above: two different findings answering to one id, in the
> file whose ids other files cite. They are **C-11** and **C-12** from here on, and every
> reference to them on this page moved with them. `pnpm guard:conformance` now fails on a
> duplicate id, so this particular drift cannot recur silently.
>
> (The colliding pair above — C-9, ARM and C-10, declarations — also landed 2026-08-22, in
> commits `809517b` and `e29a99a`, although they sit under the 08-20 heading. They keep their
> ids because four other passages on this page cite them.)

### C-11 — The revolving imputation still could not fire for the picker's own labels

**B3-6-05, Revolving Charge/Lines of Credit** (same quote as C-1). C-1's branch dispatched on
a snake_case normaliser (`credit_card`), and C-2's test fed it `"credit_card"`, `"Credit Card"`
and `"revolving"` — none of which the URLA picker emits. The picker stores
`"Revolving (Credit Card)"` verbatim, and the normaliser produced `revolving_(credit_card)`, so
`isRevolvingType` was false for every row the form writes. A second dead branch under a
green test, found while stacking C-12 on this page.

Fixed by moving the picker's list to `shared/liabilityTypes.ts` (`URLA_LIABILITY_TYPES`) —
the same move `INCOME_SOURCES` made — with one classifier, `liabilityKind`, that reads the
picker's labels *and* the staff enum, shared by the picker, both engines, the pre-underwriting
flags and the MISMO export. `tests/sellingGuideMonthlyDebt.test.ts` now feeds the engine the
picker's own list and asserts every label reaches a real branch.

### C-12 — Debts paid by others were always counted against the borrower

**B3-6-05, Debts Paid by Others** (revised in the 08/05/2026 edition). "When a borrower is
obligated on a non-mortgage debt - but is not the party who is actually repaying the debt - the
lender may exclude the monthly payment from the borrower's recurring monthly obligations. This
policy applies whether or not the other party is obligated on the debt, but is not applicable if
the other party is an interested party to the subject transaction (such as the seller or real
estate agent)." For mortgage debt, the full PITIA "if the party making the payments is obligated
on the mortgage debt, there are no delinquencies in the most recent 12 months, and the borrower
is not using rental income from the applicable property to qualify." Either way, "the lender
must obtain the most recent 12 months' canceled checks (or bank statements) from the other party
making the payments that document a 12-month payment history with no delinquent payments."

Nothing on `urla_liabilities` could carry the declaration, so every such payment sat in the
DTI — a borrower whose parent pays their student loan was qualified on a ratio the Guide says
they need not carry. Implemented end to end:

- **Declaration** — five columns (migration 0058): the claim, the payer's relationship (never a
  name), and the three facts the rule turns on. The URLA form asks exactly those questions and
  shows, from the same predicate the engines read, whether the payment left the ratio and why
  not if it did not.
- **One rule** — `shared/liabilityExclusions.ts` (`assessPaidByOtherParty`), read by the instant
  decision (`sumOpenMonthlyLiabilities`), the staff calculations engine (`assessLiabilities`),
  the pre-underwriting flags and the MISMO export (`LiabilityExclusionIndicator`, verified in
  `MISMO_3_0.xsd` line 9748). An unanswered question is a condition not yet met: the debt stays
  in until the borrower answers. Guarded by `tests/complianceInvariants.test.ts`.
- **Documentation** — the exclusion applies the moment the answers qualify, and the 12-month
  history follows it as an auto-generated, per-liability `loan_condition`
  (`PRE_UW_THIRD_PARTY_PAID_DEBT:<liabilityId>`, document type `third_party_payment_history`),
  reconciled on every liability write: created when claimed, retired (`not_applicable`) when
  withdrawn, re-opened if the claim returns, never duplicated, a cleared one left as history.
  Staff verification of the history **is** that condition's clearing workflow — there is
  deliberately no staff-only column on the liability row, because the liability routes
  whitelist by table column and a borrower could set one on their own row.

The product decision recorded with it: the borrower is qualified on the ratio the Guide entitles
them to with the paperwork named, not held to a ratio it says they need not carry. The
12-month no-delinquency fact is what the documentation proves, not a self-reported field.

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

### G-14 — 🚨 The Eligibility Matrix is absent, and the Guide defers to it **39 times**

This bounds the whole exercise and is the most important thing on this page. The Selling Guide
is the top of the hierarchy, but it is not self-contained: it routes numeric limits to the
**Eligibility Matrix** in 39 places — maximum LTV/CLTV/HCLTV by transaction and occupancy,
minimum credit scores for manual underwriting, minimum reserve requirements for manually
underwritten loans (B3-4.1-01 says so explicitly), and the cash-out ceilings behind C-8.

We do not hold it. It is not in `docs/fannie-mae/` and not in the founder's reference-documents
folder. **A conformance verdict on any of those numbers is therefore unavailable, not merely
unchecked** — and the honest response is a review route (as C-8 takes) rather than a plausible
figure.

Procurement item, same shape as `docs/reg-z/`: the fix is obtaining the document, not more
analysis.

### G-15 — Representative credit score ignores co-borrowers, while their income counts

**B3-5.1-02, Representative Credit Score.** Step 2: one score per borrower — the **lower** of
two, the **middle** of three. Step 3: with multiple borrowers, take the **lowest** applicable
score across the group; a borrower with no score is excluded, not treated as zero.

Step 2 is satisfied where scores are produced (the credit adapter sorts three and takes the
middle, which also gets the Guide's tie examples right: 700/680/680 → 680, 700/700/680 → 700).

**Step 3 cannot be satisfied at all.** `credit_score` is a single integer on
`loan_applications`; no per-borrower score exists anywhere in the schema. Meanwhile
`decisionEngine` aggregates **income across every `borrowerSequenceNumber`**, and sums
liabilities across them too.

So a co-borrower's income helps the DTI and their debts hurt it, but **their credit is
invisible**. A 760 primary with a 600 co-borrower is priced and gated at 760 where Fannie
requires 600 — clearing the 620 floor it should fail, and pricing several LLPA and PMI bands
too cheaply. The asymmetry runs in the forbidden direction: we take the co-borrower's benefit
without their risk.

Closing it needs a per-borrower score column plus capture, and then `min()` across borrowers —
the same shape as C-6. Not undertaken unilaterally; it is a schema and intake change, and the
founder should choose when.

*(Checked and sound while here: `CREDIT_SCORE_UNKNOWN_DEFAULT = 680` for a borrower who selects
"not sure" is explicitly named, documented as a midpoint rather than a silent clamp, and stays
`self_reported` provenance until a real pull replaces it — the decision carries `isVerified`
off that provenance. That is a placeholder the system knows is a placeholder, not a fabricated
score.)*

### G-16 — 🚨 Real Estate Owned cannot be captured, yet is scored as "reviewed"

The URLA form has **no Real Estate Owned section**. `SectionsPayload` / `UrlaSavePayload`
(`client/src/pages/borrower/urla/types.ts`) carry personal info, employment, assets,
liabilities, declarations, demographics, other income, subject property and loan details — and
nothing for the borrower's *other* properties. The `real_estate_owned` table exists, is fully
shaped for the job (`mortgage_balance` = UPB, `occupancy_type`, `will_be_sold`, `status`), is
read by storage and batch loaders — and is written **only** by an internal API route
(`server/routes/intelligence.ts:96`). No borrower-facing path populates it.

Worse than merely absent: `scoreRealEstateOwned` (`server/services/mismoValidation.ts`) scores
section 2c by asserting a single hardcoded field — **"Real estate ownership reviewed" = "yes"**
— whenever `reo.length === 0`. A borrower who owns three rentals has no way to say so, and the
completeness scorer then affirms the section was reviewed. **That is an unknown rendered as a
pass**, the identical shape as the TRID `null → true` defect this codebase already fixed and
documents at length in `services/loanEstimate.ts` (finding ux-30). An absence of data is not a
clean review.

### G-17 — Multiple-financed-property rules are unimplemented (B2-2-03, B3-4.1-01)

Downstream of G-16, and fully specified in the Guide — no Eligibility Matrix needed:

- **B2-2-03, Limits on the Number of Financed Properties.** Principal residence: no limit
  (HomeReady: 2). Second home or investment: **DU maximum 10**. The count includes every
  one-to-four-unit property the borrower is personally obligated on — *even where the housing
  expense is excluded from DTI under B3-6-05* — counting a multi-unit property as one.
- **B3-4.1-01, Calculation of Reserves for Multiple Financed Properties.** Additional reserves
  on second home / investment subjects, as a percentage of the aggregate UPB of mortgages and
  HELOCs on the borrower's *other* financed properties: **2%** for 1–4 financed properties,
  **4%** for 5–6, **6%** for 7–10 (DU only). The aggregate excludes the subject property, the
  principal residence, properties sold or pending sale, and accounts paid by closing. Not
  cumulative across simultaneous applications, and not applicable to HomeReady.

Neither is implemented: `decisionEngine`, `underwritingEngine` and `preUnderwriting` contain
**zero references to `realEstateOwned`**. The reserve tiering added in C-4 is months-based and
covers only occupancy and unit count; this is a separate dollar requirement stacked on top.

Both are computable from columns that already exist — the blocker is capture (G-16), not
authority. That makes this the **highest-readiness gap on this page**: unlike G-7/G-8/G-14 it
needs no document we do not hold, and unlike G-15 it needs no new schema.

Also blocked behind G-16: **B3-6-06, Qualifying Impact of Other Real Estate Owned** (how an
existing property's PITIA counts) and the B3-6-05 rule that a mortgage the borrower is
obligated on must enter the financed-property count regardless of who pays it.

### G-18 — Non-taxable gross-up is now *authorised* but deliberately not applied (B3-3.1-01)

**B3-3.1-01, Nontaxable Income:** where income is verified non-taxable and its tax-exempt
status is likely to continue, the lender "should develop an 'adjusted gross income' … by adding
an amount equivalent to **25%** of the nontaxable income" — or the actual tax a wage earner in
a similar bracket would pay, if that exceeds 25%.

`shared/incomeTypes.ts` carries `qualifyingAuthority: null` for all twenty Section 1e types, and
its docstring gave the reason as "there is no Selling Guide income chapter in-repo". **That
reason expired on 2026-08-20.** The rule is in hand.

It is still not applied, for a different and better reason: **gross-up raises qualifying
income, which loosens the DTI gate.** The standing rail lets a reading tighten a gate or remove
a borrower charge — never loosen one. Applying it is a founder decision, not an agent's. The
module docstring and the agency-wage note now say exactly that, so the next session does not
re-derive the citation and quietly wire it in.

### G-19 — Three-year continuance is unimplementable: no expiration date is captured (B3-3.1-01)

**B3-3.1-01, Continuance of Income:** income with a defined expiration date, or dependent on
depletion of an asset account or other limited benefit, must be documented to continue **at
least three years from the note date**. Where an asset account is the sole or majority source
of qualifying income, the lender must additionally assess repayment ability once it depletes.
And where the lender is told the borrower is moving to a lower pay structure — pending
retirement, a new job — **the lower amount must be used**.

This one moves in the permitted direction (it removes income), but `other_income_sources`
carries only `income_source` and `monthly_amount`. There is no expiration date, no benefit
term, and no pending-change flag to test against, so every Section 1e source is counted at face
value for an unbounded horizon. Alimony ending in eighteen months and a lifetime pension are
indistinguishable to the engine.

Capture gap, same shape as C-6 before it was fixed.

### G-20 — Income paid in virtual currency is ineligible, and unrepresentable (B3-3.1-01)

"Any income paid to or earned by the borrower in the form of virtual currency, such as
cryptocurrencies, **is not eligible to be used to qualify for the loan**." Unlike the gross-up
and continuance rules this is absolute, and it pairs with G-3 (debt *secured by* virtual
currency must be *included* in the DTI). Neither is representable: the Section 1e catalog has no
crypto type and the codebase models virtual currency nowhere. Not currently violable — and not
currently enforceable either.

🚨 **A trap the public-repo decision created, recorded here because it will bite whoever closes
G-18 or G-19.** `tests/incomeTypes.test.ts` enforces citations with `fs.existsSync`. The Guide
text is now gitignored, so citing
`docs/fannie-mae/selling-guide/selling-guide-text.txt` passes locally and **fails in CI**, where
the fresh clone lacks it. Cite the tracked `section-index.tsv` (or this ledger) and name the
section.

### G-21 — 🚨 CLTV and HCLTV are never computed, and we actively market the thing that creates them

**B2-1.2-02 (CLTV)** and **B2-1.2-03 (HCLTV)**. CLTV is the first mortgage plus the drawn
portion of any HELOC plus the unpaid balance of all closed-end subordinate financing, over the
**lesser of sales price or appraised value**. **B2-1.2-04, Subordinate Financing** governs when
a subordinate lien is permitted at all.

The engine gets the *basis* right — `Math.min(contractSalesPrice, appraisalValue)` — and then
computes **only LTV**. `grep -i cltv` across `server/` and `shared/` returns nothing but the
comments this pass added; there is no CLTV grid in `seedLendingGrids.ts` and no HCLTV anywhere.
A file at 95% LTV and 105% CLTV clears the LTV ceiling and is never measured against a CLTV one.

**What makes this live rather than theoretical: we promote the subordinate financing ourselves.**
`server/seedData/illinoisDpa.ts` seeds four IHDA programs, surfaced to borrowers through
articles and the assistant's `getDpaPrograms` tool, in the launch state:

| Program | Assistance | Form |
|---|---|---|
| IHDAccess Home | 6% of price, to $15,000 | no-interest **second loan** |
| IHDAccess Forgivable | 4% of price, to $6,000 | forgivable loan |
| IHDAccess Deferred | 5% of price, to $7,500 | no-interest deferred loan |
| IHDAccess Repayable | 10% of price, to $10,000 | zero-interest, **repaid monthly over 10 years** |

Each is a subordinate lien on the subject property. `IHDAccess Repayable` additionally carries a
**monthly payment**, which B3-6-03 puts inside PITIA (see G-10) and which no field records.

`dpa_programs` is a marketing catalog: there is no link from an application to a program, no
subordinate-lien amount, and no payment. So this is a **capture** gap rather than a
miscalculation — we are not computing a known figure wrongly, we are blind to it. But we are
blind to something we recommend, in the first state we are launching in.

Note the sequencing trap: closing this needs the CLTV *ceiling*, and B2-1.3/B2-1.2 route
maximum CLTV/HCLTV ratios to the **Eligibility Matrix** (G-14), which we do not hold. So the
capture half is buildable now; the enforcement half is blocked on procurement, exactly like C-8.

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
