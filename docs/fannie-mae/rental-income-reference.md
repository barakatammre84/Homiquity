# Rental income — Fannie Mae Selling Guide reference

Authoritative reference for the deterministic rental-income treatment
(`server/services/underwritingNuance.ts` calculators, `server/services/income/paths/rental.ts`,
and the DTI application in `server/services/income/orchestrator.ts` /
`server/services/decisionEngine.ts`). Per [CLAUDE.md](../../CLAUDE.md) and the
`mortgage-calculations` skill (**no-citation-no-implementation**): every rule applied in code
must cite a section below. **Never invent** a rule or threshold — if it is not verified here
or in the primary source, stop and flag it.

## ⚠️ Section renumbering (verified live 2026-07-17)

Rental income moved in Fannie Mae's Income Assessment reorganization: the historical citation
**B3-3.1-08** (used across this codebase and the scenario registry before 2026-07-17) is now
**B3-3.8-01, Rental Income (10/08/2025)**. The content verified below was fetched live from
<https://selling-guide.fanniemae.com/sel/b3-3.1-08/rental-income> on 2026-07-17, whose page
header displays "B3-3.8-01, Rental Income (10/08/2025)". Code and registry citations should
read "B3-3.8-01 (formerly B3-3.1-08)". The Selling Guide controls over this file; escalate
discrepancies rather than picking a side.

## Core DTI treatment (verified against B3-3.8-01, 10/08/2025)

### Non-subject investment/rental properties the borrower owns

After computing monthly qualifying rental income (75% of gross rent where the lease/market-rent
method applies) and subtracting the property's **full PITIA**:

- **Positive:** *"If the monthly qualifying rental income minus the full PITIA is positive, it
  must be added to the borrower's total monthly income."*
- **Negative:** *"If the monthly qualifying rental income minus PITIA is negative, the monthly
  net rental loss must be added to the borrower's total monthly obligations."*
- **No double-count:** the PITIA is inside the net calculation and *must not* also be counted
  separately as a monthly obligation. (This is why the engine flags manual review when applied
  rental offsets coexist with mortgage-type URLA liability rows that may duplicate the same
  payment — see the platform-policy ledger entry.)

### Subject property — 2–4 unit principal residence

Qualifying rental income from the non-occupied unit(s) is **added to total monthly income**,
while *"the full amount of the mortgage payment (PITIA) must be included in the borrower's
total monthly obligations."* The two are **not netted**. (The advisory display in
`calculateSubjectPropertyRentalOffset` may show a net figure for borrower context, but the
applied DTI math must be income-side only — netting would double-count the PITIA that already
sits in the housing expense.)

### Departing residence (converting the current principal residence to a rental)

The current text imposes **no equity requirement and no prior-rental-history requirement** for
using rental income from a departing residence. For properties recently converted or newly
placed in service, obtain Schedule E of the most recently filed return to confirm no prior
rental income/expenses for the property; B3-6-06 carries additional conversion guidance.
*(Two claims circulating in older/secondary sources — a ≤70% LTV / 30% equity requirement and
a one-year property-management-history restriction — are NOT in the current section text as
fetched; do not implement them. See the non-W2 plan's Appendix A.3 adjudication.)*

## Documentation (to use rental income)

- Most recent signed federal return including **Schedule E** (Form 8825 for business entities).
- **Form 1007** (single-family) / **Form 1025** (2–4 unit) appraisal rent schedules for subject
  properties.
- Current fully executed **lease agreements**, supported by a minimum of two months of
  consecutive bank statements or electronic transfers of rental payments for existing leases.

## Platform application gates (PLATFORM POLICY, ledgered)

The Selling Guide states the arithmetic; *when* the platform auto-applies it is a
platform-conservative overlay (`platform-rental-preliminary-asymmetry` in
`data/regulatory/regulatory-ledger.json`):

- **Positive net rental income** is applied to qualifying income only when the application's
  `financialDataProvenance` is decision-grade (verified income/assets/credit) — declared,
  unverified rent never inflates a PRELIMINARY decision.
- **Negative net rental (a loss)** is applied to monthly obligations **always**, including on
  PRELIMINARY decisions — counting a declared loss can only under-state qualification, never
  over-state it.

This asymmetry can never approve a file the guide would deny; it can only under-state a
preliminary result until verification completes.
