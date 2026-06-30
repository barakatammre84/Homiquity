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
  bulk reseed, not an incremental migration.
- Staff admin lifecycle routes live at `/api/lookup-matrices` (server/routes/lookup-matrix.ts):
  list/get + POST (publish DRAFT, auto version++), /activate (DRAFT→ACTIVE, auto-retires
  prior active), /retire (ACTIVE→RETIRED), PATCH /schedule (future dates). Enum is
  DRAFT/ACTIVE/RETIRED — "EXPIRED" in product talk == RETIRED. Audit via audit_logs.
- `LookupResolverService.invalidate(matrixCode?)` MUST be called after any matrix
  lifecycle mutation. **Why:** resolver caches results (day-bucketed key); without it an
  activate/retire keeps quoting stale/expired pricing. The admin routes already call it.
  Note: static `invalidate` only clears the SHARED singleton instance (this process).
- Cross-process coherence (autoscale = multiple instances) does NOT rely on `invalidate`.
  Each cached value is tagged with a DB-derived stamp = `MAX(updated_at)` per matrix_code;
  `updateLookupMatrix` always bumps `updated_at` via DB `now()`. On a cache hit the stamp
  is re-checked on every read by default (strict: a sibling reflects activate/retire/reschedule
  immediately). `LOOKUP_MATRIX_STAMP_WINDOW_MS` > 0 is an opt-in perf mode that coalesces stamp
  reads, trading up to that many ms of cross-process staleness for fewer stamp queries. **How to apply:** any new matrix-row mutation path must bump
  `updated_at`, or sibling instances will serve stale values. `lookup_matrices.updated_at`
  is the stamp source — don't drop it.
- Cached values are also capped to never outlive the matrix's `expirationDate`, so a matrix
  that expires mid-cache is not served past expiry even with no mutation.
- All decisioning code shares ONE resolver instance: import the `lookupResolver` singleton;
  do NOT `new LookupResolverService()` in app code (a private instance has its own cache the
  admin routes' static `invalidate` can't reach). Custom instances are for tests only.
- Isolated/dev DBs may be MISSING `lookup_matrices` / `lookup_matrix_cells` entirely
  (schema declared but never migrated there) — every loud decisioning lookup then throws.
  Create them idempotently from shared/schema/lookup.ts rather than relying on db:push.
