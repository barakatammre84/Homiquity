# Feature coverage ledger

**One row per built feature area. The rotation reads this file and nothing else.**

This exists because nothing tracked per-area coverage. `knowledge-base/feature-review/DOMAINS.md`
tracks 13 review *domains*, and five of those had never been run — which meant 23 of the 41 areas
below had never been looked at by anything, and no file said so. An area nobody has visited is not
low-risk; it is unmeasured, and the two read differently only if something writes them down.

## How the rotation picks

1. **`never` first.** Unmeasured outranks stale. Within `never`, prefer areas whose owner agent lists
   a §9 security trigger or a hand-back file — those carry the most risk per unit of ignorance.
2. **Then oldest `last walked`.** Straight oldest-first.
3. **Skip anything under a live claim** in `knowledge-base/routines/REGISTER.md` or in a peer's open
   PR. Record the skip in the run's notes; a silently skipped area reads identically to a covered one,
   which is the whole failure this ledger exists to prevent.

A row is only updated by a run that actually walked the area. **Never mark a row from a plan, a
report, or another routine's summary** — that turns the ledger into a claim about intent rather than
a record of work, and the fleet has already been burned once by a findings register that overstated
itself in one direction.

## Status vocabulary

| status | means |
|---|---|
| `never` | no run has walked this area. Seeded state for 23 of 41. |
| `walked` | visited, findings recorded, nothing blocking a client |
| `gaps` | visited, one or more buildable tickets filed — see the ids |
| `blocked` | could not be walked; the reason is in notes (no fixture, needs a vendor, founder-gated) |

## The ledger

| # | Area | Owner agent | Last walked (UTC) | Status | Findings | Notes |
|---|---|---|---|---|---|---|
| 1 | URLA / borrower application (Form 1003) | `hq-urla-owner` | — | `never` | — | domain last reviewed 2026-08-05 |
| 2 | pre-approval funnel and lead intake | `hq-intake-funnel-owner` | — | `never` | — | domain last reviewed 2026-08-05 |
| 3 | pricing and rate engine | `hq-pricing-owner` | — | `never` | — | domain last reviewed 2026-08-17 |
| 4 | rate locks | `hq-rate-locks-owner` | — | `never` | — | domain last reviewed 2026-08-17 |
| 5 | underwriting and decisioning | `hq-underwriting-owner` | — | `never` | — | domain last reviewed 2026-08-12 |
| 6 | income analysis across the five qualifying paths | `hq-income-owner` | — | `never` | — | domain last reviewed 2026-08-12 |
| 7 | credit pulls, FCRA consent and adverse action | `hq-credit-fcra-owner` | — | `never` | — | domain last reviewed 2026-08-05 |
| 8 | GSE delivery and MISMO export | `hq-gse-delivery-owner` | — | `never` | — | domain last reviewed 2026-08-17 |
| 9 | AUS submission and the autopilot orchestrator | `hq-aus-autopilot-owner` | — | `never` | — | domain last reviewed 2026-08-18 |
| 10 | TRID, disclosures and the Loan Estimate | `hq-trid-disclosures-owner` | — | `never` | — | domain last reviewed 2026-08-17 |
| 11 | documents, uploads and extraction | `hq-documents-owner` | — | `never` | — | domain last reviewed 2026-08-05 |
| 12 | tax document intelligence | `hq-tax-intel-owner` | — | `never` | — | domain last reviewed 2026-08-05 |
| 13 | rent reporting and the lease ledger | `hq-rent-reporting-owner` | — | `never` | — | review domain never run |
| 14 | verifications — Plaid, KYC/AML, KBA and identity | `hq-verifications-owner` | — | `never` | — | domain last reviewed 2026-08-05 |
| 15 | task engine and SLA operations | `hq-task-engine-owner` | — | `never` | — | review domain never run |
| 16 | loan pipeline and the staff LO cockpit | `hq-pipeline-owner` | — | `never` | — | review domain never run |
| 17 | pre-approval and pre-qualification letters | `hq-letters-owner` | — | `never` | — | review domain never run |
| 18 | offer comparison and anti-steering | `hq-offers-owner` | — | `never` | — | domain last reviewed 2026-08-17 |
| 19 | borrower dashboard and journey | `hq-borrower-journey-owner` | — | `never` | — | review domain never run |
| 20 | messaging and notifications | `hq-messaging-owner` | — | `never` | — | review domain never run |
| 21 | AI coach | `hq-ai-coach-owner` | — | `never` | — | domain last reviewed 2026-08-05 |
| 22 | homebuyer accelerator program | `hq-accelerator-owner` | — | `never` | — | review domain never run |
| 23 | property search, listings and valuation | `hq-property-owner` | — | `never` | — | review domain never run |
| 24 | multi-property applications | `hq-multi-property-owner` | — | `never` | — | domain last reviewed 2026-08-05 |
| 25 | public calculators and affordability tools | `hq-calculators-owner` | — | `never` | — | domain last reviewed 2026-08-08 |
| 26 | broker portal and wholesale channel | `hq-broker-portal-owner` | — | `never` | — | review domain never run |
| 27 | partner, referral and CPA network | `hq-partners-owner` | — | `never` | — | review domain never run |
| 28 | realtor engine | `hq-realtor-engine-owner` | — | `never` | — | review domain never run |
| 29 | homeowner and post-close retention surface | `hq-homeowner-owner` | — | `never` | — | review domain never run |
| 30 | admin console | `hq-admin-console-owner` | — | `never` | — | review domain never run |
| 31 | financial reporting and compensation | `hq-compensation-owner` | — | `never` | — | review domain never run |
| 32 | compliance analytics, HMDA and fair lending | `hq-hmda-fairlending-owner` | — | `never` | — | review domain never run |
| 33 | authentication, sessions and account security | `hq-auth-owner` | — | `never` | — | review domain never run |
| 34 | PII protection, encryption and the audit log | `hq-pii-vault-owner` | — | `never` | — | review domain never run |
| 35 | marketing, SEO and education content | `hq-seo-content-owner` | — | `never` | — | domain last reviewed 2026-08-08 |
| 36 | data intelligence and analytics | `hq-data-intel-owner` | — | `never` | — | review domain never run |
| 37 | market data and competitive intelligence | `hq-market-data-owner` | — | `never` | — | review domain never run |
| 38 | MCP server (the agent tool surface) | `hq-mcp-owner` | — | `never` | — | review domain never run |
| 39 | background jobs and scheduled sweeps | `hq-jobs-cron-owner` | — | `never` | — | review domain never run |
| 40 | observability, error monitoring and request-level operations | `hq-observability-owner` | — | `never` | — | review domain never run |
| 41 | CI, the guard fleet and repository tooling | `hq-ci-guards-owner` | — | `never` | — | review domain never run |

> **Every row is seeded `never` on purpose.** A domain review is not an area walk: the domains are a
> coarser partition, they were reviewed against a different charter, and the most recent was three days
> before this file existed. Inheriting those dates would have started the ledger with 18 rows claiming a
> coverage nobody performed. The `Notes` column keeps the domain date as context, which is what it is.

## Run log

| date (UTC) | areas walked | tickets filed | skipped, and why |
|---|---|---|---|
| — | no runs yet | — | the routine is defined but **not registered**; registration is a founder action (CHARTER §15) |
