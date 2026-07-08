# Free Data Moat — HMDA competitor pricing + Fannie Mae loan performance

Zero-cost market intelligence from public datasets. Two ingestion pipelines
feed three Postgres tables; the app reads them through indexed point lookups
(milliseconds) — never through the raw data.

| Dataset | What we extract | Cost |
|---|---|---|
| CFPB HMDA data-browser API | Competitor originations: rate, loan amount, property value, DTI bucket, geography | Free, no key |
| Fannie Mae Single-Family Loan Performance | Default / serious-delinquency / prepay rates by credit × LTV × DTI band | Free (Data Dynamics registration) |

## Tables (`shared/schema/marketData.ts`)

- `hmda_competitor_loans` — raw filtered LAR rows per competitor-year (replaced on re-ingest).
- `competitor_rate_benchmarks` — pre-aggregated median/quartile rates per
  county → state → national × loan type × loan purpose × year. This is what
  the app queries. Cells with < 5 loans are never materialized (noise + privacy).
- `loan_performance_profiles` — per-band historical risk aggregates. A few
  hundred rows regardless of source size.

Create tables by applying the hand-authored migration: `npm run db:migrate` (**never `db:push`** — see [kb/app-guide/03-database.md](app-guide/03-database.md)).

## Ingest: HMDA competitors

```bash
# Resolve a lender's LEI from the public filers list
npm run data:hmda -- --year 2024 --lender "Better Mortgage" --list-only

# Ingest + rebuild benchmarks (nationwide, or limit with --states)
npm run data:hmda -- --year 2024 --lender "Better Mortgage"
npm run data:hmda -- --year 2024 --lei 549300XY701IELCE5Q08 --lender-name "BETTER MORTGAGE CORPORATION" --states AZ,TX
```

Notes:
- HMDA is published **annually** — "last 12 months" means the latest activity year.
- Only originated loans (`action_taken=1`) are kept: we benchmark closed loans, not offers.
- Public HMDA has **no credit scores** and only bucketed DTI, so benchmarks are
  keyed by geography + product, not borrower credit. Credit-based risk comes
  from the Fannie Mae pipeline instead.
- Re-running for the same (LEI, year) replaces the prior batch; benchmarks are
  rebuilt wholesale after every ingest. Ingest multiple competitors back to
  back — the benchmark pool is the union of everything ingested.

## Ingest: Fannie Mae loan performance

Download quarterly files from Fannie Mae Data Dynamics → Single-Family Loan
Performance Data (multi-GB, pipe-delimited, one row per loan per month).

```bash
npm run data:fannie -- /path/to/2023Q4.csv --dataset sf_2023q4    # .gz also fine
npm run data:fannie -- /path/to/2023Q4.csv --inspect              # verify column layout
```

Streaming is O(1) memory: rows are folded loan-by-loan (files are grouped by
loan id), and only the band aggregates are held. If Fannie revises the file
layout, run `--inspect` and adjust `FANNIE_COLUMNS` in
`server/services/marketDataParsers.ts`.

Definitions: default = terminal zero-balance codes 02/03/09/15;
serious delinquency = ever 90+ days; prepaid = code 01.

## Query surface (staff-only routes, `server/routes/market-data.ts`)

- `GET /api/market-data/competitor-benchmark?state=AZ&countyFips=04013&loanType=1&loanPurpose=1`
  — median/quartile competitor rate, county → state → national fallback.
- `GET /api/market-data/undercut-quote?creditScore=760&loanAmount=320000&propertyValue=400000&state=AZ&countyFips=04013`
  — prices the profile through the deterministic engine (`computeOffers`) and
  reports where our best executable rate sits vs. the competitor median, in bps.
- `GET /api/market-data/risk-profile?creditScore=645&ltv=85&dti=38`
  — historical default/prepay rates for the borrower's band.

Service layer: `server/services/competitorRateService.ts`.

## Compliance invariant

The undercut quote is **advisory**. It never mutates rate sheets or advertised
rates: the deterministic pricing engine (rate sheets + LLPA matrices) is the
only source of a quotable rate, and advertised rates must be executable
(Reg Z — same invariant as `rateService.syncBestExecutionRates`). Use the
benchmark to inform rate-sheet negotiations and marketing copy, not to
auto-reprice borrowers.
