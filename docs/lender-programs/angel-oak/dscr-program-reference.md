# Angel Oak — Investor Cash Flow (DSCR) program reference

**Sources:** Angel Oak Mortgage Solutions public pages
- Program page: <https://angeloakms.com/programs/investor-cash-flow-mortgage-program/>
- DSCR calculator page (the operative formula): <https://angeloakms.com/dscr-loan-calculator/>

**Fetched & double-verified (verbatim-quote pass):** 2026-07-11.
**Hierarchy:** the TPO Connect broker-portal matrix / AE guidance controls over
these pages (see README). Scripted HTML snapshots Cloudflare-blocked at fetch time.

Every figure below is a verbatim transcription. Do not extend it from memory.

## Ratio formula (drives `paths/dscr.ts`)

The program page carries a generic educational definition:

> "Debt service coverage ratio or DSCR is a measurement of a property's
> expected cash flow to determine ability to repay a mortgage loan. It is
> calculated by dividing the borrower's net operating income by their debt
> obligations, including the debt payment."

The **calculator page states Angel Oak's operative program formula explicitly**
(and its input fields are Monthly Rental Income, loan P&I inputs, Monthly
Taxes, Monthly Insurance, Monthly HOA):

> "Angel Oak includes principal, interest, taxes, insurance and HOA fees in
> the mortgage debt. The ratio is calculated by taking the expected rental
> payment and dividing it by the annual mortgage debt RDP (Rent Divided
> PITIA = DSCR)."

Transcribed rule: **DSCR = expected rent ÷ PITIA** (principal + interest +
taxes + insurance + association dues), computed on matching periods (monthly
rent ÷ monthly PITIA). The generic NOI sentence is educational; the RDP
formula is the one Angel Oak states as its own calculation. If the AE matrix
ever contradicts this, stop and escalate (README rule 3).

## Qualifying threshold — NOT PUBLIC (open gap)

> "DSCR < 1.0 and No DSCR options available"

The standard qualifying minimum(s) by LTV/FICO tier are **portal-gated**. The
DSCR path therefore computes and reports the ratio but never declares
pass/fail against a threshold, and always sets `requiresManualReview` with an
AE-matrix note. Adding a threshold to code requires the AE matrix transcribed
into this file first.

## Program envelope (context for the LO; not income math)

> "Loans up to $3 million with a minimum of $100,000"
> "680 Min Fico (Up to 75% LTV)"
> "85% Max LTV (Minimum 720 FICO)"
> "Warrantable, non-warrantable, and condo hotels allowed"
> "No income or employment required; qualifications based on property cash flow"

## Code + ledger anchors

- Calculator: `server/services/income/paths/dscr.ts` (`computeDscrRatio` —
  monthly rent ÷ monthly PITIA).
- Ledger: `data/regulatory/regulatory-ledger.json` id
  `aoms-dscr-rent-divided-pitia`.
