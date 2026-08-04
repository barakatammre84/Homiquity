# Unconsumed Capabilities

> **Freshness:** last verified 2026-08-04 · review every 30 days — enforced by `scripts/doc-freshness-guard.cjs`.

**What this tracks:** capability built ahead of a consumer — endpoints, services and tables that
work correctly and that nothing in the product actually calls yet.

**Why it needs a page.** This is not a hypothetical failure mode here; it already happened. The
Fannie Mae loan-delivery stack is 1,482 lines reachable through one staff route with **zero client
callers**, and it took a financial architecture audit to notice that a broker never performs the
function it implements ([F-14](./CHANNEL_DECISION.md)). Nobody decided to build overhead. It
accreted, one reasonable-looking PR at a time, because nothing ever asked *"who calls this?"*

So this register asks, on a clock. Every entry carries a **decide-by date**. When it passes, the
freshness guard goes red and someone must pick: **wire a consumer, or freeze it.** Not deciding is
the failure — it is how the delivery stack happened.

---

## The rule

An entry leaves this register in exactly one of three ways:

| Outcome | Meaning |
|---|---|
| **Consumed** | A real surface calls it. Delete the row; it is now product. |
| **Frozen** | Kept, but a ratchet stops it growing (the `guard:channel` pattern). Move the row to a freeze note. |
| **Removed** | Deleted from the codebase. Delete the row. |

"Leave it and look again next month" is not an outcome. If a capability has survived two review
cycles unconsumed, that is evidence it was built too early — freeze or remove it.

---

## Open entries

*(none — every entry from the register's opening day was consumed the same day. The next PR that
ships capability ahead of a consumer adds the next row, with a decide-by date.)*

---

## Closed entries

| Capability | Outcome | When | How |
|---|---|---|---|
| TRID fee-tolerance review (`GET /api/loan-applications/:id/le-tolerance`) | **Consumed** | 2026-08-04 | `FinancialsTab` on the staff BorrowerFile — verdict badge, cure exposure, per-line increases, with the read-only / not-a-legal-cure caveats rendered. |
| Per-file cost ledger (`GET`/`POST /api/loan-applications/:id/costs`) | **Consumed** | 2026-08-04 | Same tab — entries with Metered/Staff/Simulated provenance, simulated spend labelled and excluded from totals, staff cost entry (negative = reversal on the append-only ledger). |
| Broker revenue + unit economics (`GET /api/reports/compensation`) | **Consumed** | 2026-08-04 | `FinancialReports` admin page (`/admin/financial-reports`) — revenue, pull-through, unit economics, clawback exposure and remittance discrepancies, rendered under the audit's honesty rules (upper-bound margins, null ≠ zero). |
| Contingent-liability register (`GET /api/reports/contingent-liabilities`) | **Consumed** | 2026-08-04 | Same page — `quantifiedFloor` labelled a floor with `unquantifiedCount` beside it; unpriceable exposures render "—", never $0. |
| LO compensation election (`PATCH /api/loan-applications/:id/compensation`) | **Consumed** | 2026-08-04 | `CompensationCard` on the staff BorrowerFile overview tab. This was the register's flagged asymmetry — load-bearing without a UI (the Loan Estimate refused to generate without an election) — and was wired the same day, first, as the register demanded. |

---

## Provenance

Opened 2026-08-04 by the financial architecture audit
([log](../logs/2026-08-04-financial-architecture-capital-structure-audit.md)). Its own author put
the first entry here: the audit shipped five endpoints with no consumer while diagnosing a 1,482-line
stack with no consumer. Recording that was cheaper than repeating it.
