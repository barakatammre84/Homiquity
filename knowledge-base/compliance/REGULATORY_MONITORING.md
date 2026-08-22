# Regulatory Monitoring — the Source-of-Truth System

**Purpose:** keep every statutory constant and guideline-derived rule in the platform verifiably aligned with its official source — and make *going stale* or *upstream changes* loud, automatic signals instead of silent drift.

Three tiers, two automated today:

## Tier 1 — The regulatory ledger (automated, live)

[`data/regulatory/regulatory-ledger.json`](../../data/regulatory/regulatory-ledger.json) holds one entry per statutory constant in the codebase: the rule, its value, the exact citation, the **official source URL**, the code location, `lastVerified` date, and a review interval. `scripts/regulatory-freshness.cjs` runs inside `pnpm checkup` (and therefore the daily guardian) and **fails** when any entry is overdue for re-verification or its code reference no longer exists.

**The human loop:** when a check fails, open the entry's `sourceUrl`, confirm the value against the official text, then update `lastVerified` (and the value + a `Correction to S-XX` in the [scenarios registry](./UNDERWRITING_SCENARIOS.md) if the guideline changed). Values never change without a citation.

The ledger already surfaces two genuine review items it exists to catch:
- `platform-dti-ceiling-43`: the 43% flag threshold references the repealed Appendix Q QM standard; DU approves up to 50% — decide whether to align.
- `fnma-b3-6-05-deferred-student-loan`: the 1% vs 0.5% (FHA) question, tracked as NC-01.

## Tier 2 — The official-sources change watcher (automated, live)

`pnpm reg:watch` (state-saving variant: `reg:watch:save`) polls:
- **Federal Register API** (structured, free): CFPB + HUD + VA mortgage rules and proposed rules — new document numbers are reported with title, agency, date, and link.
- **Agency update pages** (content-hash diff): Freddie Mac Guide bulletins, FHA Mortgagee Letters, VA circulars. Any content change → "review this page" signal.

Last-seen state lives in `data/regulatory/regulatory-watch-state.json` — committed, so the observation history is itself auditable. The daily guardian runs the watcher and reports new signals; if a change touches a guideline our engine implements, it files a `Correction to S-XX` in the scenarios registry (with the citation) rather than changing math directly.

**Known limitation:** Fannie Mae's announcements page is bot-protected (HTTP 403) — the watcher reports this honestly on every run rather than skipping it. Fannie coverage therefore depends on the email subscription below until API access exists.

## Tier 3 — Accounts, subscriptions, and licensed content (your actions — roadmap F10)

- **Subscribe (free, ~15 minutes total):** Fannie Mae Selling Guide notifications, Freddie Mac Guide bulletin emails, FHA INFO announcements, VA lender news. These are the belt to the watcher's suspenders — and the only reliable Fannie channel today.
- **Fannie Mae Developer Portal:** register; public APIs are open, business-partner APIs (Loan Lookup, pricing, DU) unlock with seller/servicer or TSP approval — pairs with F6 (DU access).
- **Licensed compliance content (evaluate later):** AllRegs (ICE) for the licensed guideline corpus; Mavent/ComplianceEase-class engines for loan-level compliance checks. Wholesale lenders recognize these; budget items, not prerequisites.

## The end-state architecture (when scale justifies it)

Statutory constants migrate from code into the **versioned, effective-dated lookup-matrix system** (`lookupResolver`) that pricing already uses — so a guideline update creates a new effective-dated row instead of editing history, and any past decision can be reproduced for an auditor with the rule that governed it *on that date*. Until then, the ledger + invariant tests + git history provide the audit trail.
