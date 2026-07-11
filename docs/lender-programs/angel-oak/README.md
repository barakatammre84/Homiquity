# Angel Oak Mortgage Solutions — program references

Authority documents for the non-QM income paths (UAL program P4), mirroring
the `docs/fannie-mae/` and `docs/irs-forms/` pattern: **no threshold, factor,
or formula that drives a qualification figure may exist in code unless it is
verifiable here.** The fs-existence test in `tests/nonQmProgramGate.test.ts`
enforces that every `enabled: true` non-QM path's citation files exist and
contain the load-bearing figures.

## Source and hierarchy (binding)

1. **These references transcribe Angel Oak Mortgage Solutions' PUBLIC program
   pages** (verbatim quotes, source URLs, fetch dates inside each file).
   Scripted HTML snapshots were Cloudflare-blocked at fetch time; the
   transcriptions were double-extracted (independent verbatim-quote passes)
   before being recorded.
2. **The broker-portal program matrices control over these pages.** The full
   qualification matrices (e.g. minimum DSCR by LTV/FICO tier, deposit-
   eligibility scrubbing rules, prepay structures) live behind Angel Oak's
   TPO Connect portal (<https://connect.angeloakms.com/>) and reach us via
   the Account Executive. When the AE matrix arrives, add it here (with its
   version/date), reconcile, and update the references in the same commit as
   any code change.
3. **Discrepancies escalate.** If a portal matrix, rate sheet, or AE statement
   conflicts with these pages, stop and escalate — do not pick.

## Inventory

| File | Program | Enables |
|---|---|---|
| `bank-statement-program-reference.md` | Bank Statement (12/24-month, personal or business) | `server/services/income/paths/bankStatement.ts` |
| `dscr-program-reference.md` | Investor Cash Flow (DSCR) | `server/services/income/paths/dscr.ts` |

## Known gaps (founder / AE actions)

- **Minimum qualifying DSCR by tier** — the public pages confirm "DSCR < 1.0
  and No DSCR options available" but not the standard qualifying minimums per
  LTV/FICO tier. The DSCR path therefore computes and reports the ratio
  (formula is public and cited) and always flags manual review; it never
  declares pass/fail against a threshold.
- **Deposit-eligibility rules** for bank-statement analysis (which deposits
  count, transfer exclusions) are portal-gated. The calculator takes
  *eligible* deposit totals as input and flags that eligibility screening
  follows the AE guidelines.
- **Prepayment-penalty structures and state overlays** — not public; needed
  before rate quoting, not for income math.
