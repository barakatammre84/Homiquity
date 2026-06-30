---
name: Lookup matrix decision engine
description: Conventions for the data-driven underwriting/pricing lookup engine (lookup_matrices + lookup_matrix_cells).
---

# Lookup matrix decision engine

The underwriting/pricing engine resolves all policy numbers from Postgres lookup
matrices, not hardcoded constants. Two resolution paths exist and the choice
between them is a deliberate policy decision:

- `resolveMatrixValue` / `getPolicyScalar` **throw loudly** when a matrix or cell
  is missing/expired/out-of-range. Decisioning code (DTI caps, LTV caps, LLPA, VA
  residual, asset haircuts) MUST use these — a missing rule must fail, never
  silently default.
  **Why:** regulatory compliance / Fair Lending — a wrong-but-quiet number is worse
  than a hard failure.
- `tryResolveMatrixValue` returns `null` (callers coalesce to 0) and is ONLY for
  display/presentation helpers where "no applicable band" is legitimate.

Other durable decisions:
- Conventional PMI trigger is **LTV > 80%**, and this MUST be consistent across the
  engine, the PMI rate card, property-eligibility, and pricing. **Why:** mismatched
  triggers (e.g. some path gating at >90) silently zero-out PMI for 80.01-90 loans,
  understating payment/DTI — a real underwriting bug. **How to apply:** if you change
  the trigger or the structural MI coverage gate (35/30/25/12 by band), the seeded
  CONVENTIONAL_PMI cells must span the full 80.01-97 range or loud lookups will throw
  out-of-range for the uncovered bands. Keep the trigger and the seed in lockstep.
- `verifyAssets` applies the stock-investment haircut (not a literal 0.5) to
  unknown/"other" asset types; cash-equivalents count at 1.0. **Why:** conservative
  default that stays in sync with the haircut matrix instead of a frozen constant.
- Resolver filters cells by `lifecycleStatus = ACTIVE` AND `effectiveDate <= now`,
  cached per matrixCode + all dims + reference date bucketed to the **day** (not ms),
  so same-day lookups share cache entries.
- `dim1`/`dim2` are `numeric(14,2)` (NOT 8,2): the VA loan-amount upper bound
  overflows numeric(8,2). Don't narrow these.
- `seedLendingGrids.ts` wipes and replaces ALL matrix data on each run — it is a
  bulk reseed, not an incremental migration. There is no admin lifecycle UI yet.
