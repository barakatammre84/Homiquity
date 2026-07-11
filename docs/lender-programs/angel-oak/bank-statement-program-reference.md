# Angel Oak — Bank Statement program reference

**Source:** Angel Oak Mortgage Solutions public program page
<https://angeloakms.com/programs/bank-statement-mortgage-program/>
**Fetched & double-verified (verbatim-quote pass):** 2026-07-11.
**Hierarchy:** the TPO Connect broker-portal matrix / AE guidance controls over
this page (see README). Scripted HTML snapshot Cloudflare-blocked at fetch time.

Every figure below is a verbatim transcription. Do not extend it from memory.

## Income methodology (drives `paths/bankStatement.ts`)

> "12 or 24 months' business or personal bank statements"

> "Loans will be qualified using a default expense factor of 50%. Companies
> with a lower expense factor will require a statement from a third party CPA,
> tax preparer, or bookkeeping company (some industries with traditionally
> higher expense factors will be underwritten with a 70% expense factor)."

Transcribed rules:
- Statement periods: **12 or 24 months**, business or personal statements.
- Qualifying income derives from deposits with an **expense factor**:
  - **default 50%**;
  - **70%** for industries with traditionally higher expense factors;
  - a factor **below 50% only with a third-party CPA / tax preparer /
    bookkeeping company statement**.
- Deposit *eligibility* rules (which deposits count; transfer exclusions) are
  **not public** — portal/AE-gated. The calculator therefore takes eligible
  deposit totals as input and flags that screening follows AE guidelines.

## Program envelope (context for the LO; not income math)

> "Loans up to $4 million with a minimum of $150,000"
> "640 Min Fico (Up to 75% LTV)"
> "90% Max LTV (Minimum 720 FICO)"
> "Borrowers can own as little as 25% of the business"
> "Two years' seasoning for foreclosure, short sale, bankruptcy or deed-in-lieu"

## Code + ledger anchors

- Calculator: `server/services/income/paths/bankStatement.ts`
  (`BANK_STATEMENT_DEFAULT_EXPENSE_FACTOR = 0.50`,
  `BANK_STATEMENT_HIGH_EXPENSE_FACTOR = 0.70`).
- Ledger: `data/regulatory/regulatory-ledger.json` ids
  `aoms-bank-statement-expense-factor-default`,
  `aoms-bank-statement-expense-factor-high`.
