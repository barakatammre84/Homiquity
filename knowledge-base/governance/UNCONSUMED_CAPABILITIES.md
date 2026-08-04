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

### The financial-reporting endpoints (added 2026-08-04) — **decide by 2026-09-04**

Built by the financial architecture audit. Every one is correct, tested, and **has no client
surface** — the precise shape that produced F-14.

| Capability | Route / module | Consumer today |
|---|---|---|
| Broker revenue + unit economics | `GET /api/reports/compensation` | none |
| Contingent-liability register | `GET /api/reports/contingent-liabilities` | none |
| TRID fee-tolerance review | `GET /api/loan-applications/:id/le-tolerance` | none |
| Per-file cost ledger | `GET`/`POST /api/loan-applications/:id/costs` | none |

The four report endpoints are the genuine judgement call. They answer questions the business could
not previously ask (what does a funded loan earn, what could we owe, which disclosed figures are
guesses) — but an answer nobody reads is not an answer.

**Decision owed:** a staff dashboard consuming the four reports, or a freeze ratchet on them.

---

## Closed entries

| Capability | Outcome | When | How |
|---|---|---|---|
| LO compensation election (`PATCH /api/loan-applications/:id/compensation`) | **Consumed** | 2026-08-04 | `CompensationCard` on the staff BorrowerFile overview tab. This was the register's flagged asymmetry — load-bearing without a UI (the Loan Estimate refused to generate without an election) — and was wired the same day, first, as the register demanded. |

---

## Provenance

Opened 2026-08-04 by the financial architecture audit
([log](../logs/2026-08-04-financial-architecture-capital-structure-audit.md)). Its own author put
the first entry here: the audit shipped five endpoints with no consumer while diagnosing a 1,482-line
stack with no consumer. Recording that was cheaper than repeating it.
