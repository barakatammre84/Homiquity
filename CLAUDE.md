# CLAUDE.md — Homiquity

Guidance for Claude Code when working in this repository. The deep engineering map is
[DEVELOPER_PLAYBOOK.md](knowledge-base/handbook/DEVELOPER_PLAYBOOK.md); the per-subsystem handbook is [knowledge-base/handbook/app-guide/](knowledge-base/handbook/app-guide/);
session working practices (doc rules, branch lifecycle, definition of done, push policy)
are [knowledge-base/governance/TEAM_PRACTICES.md](knowledge-base/governance/TEAM_PRACTICES.md). This file covers what must be true in *every* session.

## Domain skills (loaded on demand)

Four `.claude/skills/*/SKILL.md` router skills carry each domain's non-negotiable rules
and point to the authoritative app-guide chapter (they don't duplicate it — that chapter
wins). Claude Code auto-loads a skill when its work matches:

- **`api-routes`** — backend endpoints under `server/routes/` (auth gating, Zod, CSRF/webhooks, PII/audit, `inArray`).
- **`ui-components`** — client UI/theming (Royal Blue Emerald token guard, WCAG AA, Shadcn/TanStack Query).
- **`mortgage-calculations`** — affordability/pricing/underwriting math (determinism + no-citation-no-implementation).
- **`seo-content`** — public marketing/SEO surfaces (Reg Z trigger terms, Reg N no-approval, TCPA, pre-license gate).

The rules below still bind every session regardless of which skill is active.

## Compliance first: Fannie Mae loan delivery (ULDD / UCD / URLA / MISMO)

Before building or modifying **anything** that touches Fannie Mae loan delivery, ULDD, UCD,
URLA, MISMO export, AUS/DU submission, edit codes, or Special Feature Codes:

1. **Consult the reference documents in [`docs/fannie-mae/`](docs/fannie-mae/)** (ULDD Phase 5
   spec, UCD job aids, URLA documents, Special Feature Codes). See the README there for the
   expected inventory. If a document you need is missing, say so — do not proceed from memory.
2. **Verify current terminology against the official Loan Delivery job aid**:
   <https://singlefamily.fanniemae.com/job-aid/loan-delivery>. Fetch and search it whenever you
   need current MISMO data point names, valid enumerations, conditionality, edit codes, or SFCs.
3. **Never invent MISMO field names, enumerations, XML container paths, edit codes, or Special
   Feature Codes.** If a name or value cannot be verified in the local references or the job
   aid, stop and flag it rather than guessing.
4. **Document hierarchy:** the Fannie Mae *Selling Guide* and *Servicing Guide* are the official
   policy statements and control over job aids in any discrepancy. When sources disagree or a
   requirement is ambiguous, escalate to the user instead of picking an interpretation.

Where this code lives:

| Concern | File |
|---|---|
| MISMO 3.4 reference-model types (ULDD Phase 5, eff. 2025-07-28) | `shared/mismo.ts` |
| MISMO 3.4 XML generation for GSE delivery | `server/mismo.ts` |
| URLA section completeness scoring + GSE gating (sections 1a, 4, 5) | `server/services/mismoValidation.ts` |
| QM points-and-fees / APR-APOR spread thresholds (note-date tables) | `shared/fannieMae/qmThresholds.ts` |
| Special Feature Codes catalog + derivation + set validation | `shared/fannieMae/specialFeatureCodes.ts` |
| Loan Delivery / UCD / EarlyCheck pre-delivery edit mirror | `shared/fannieMae/loanDeliveryEdits.ts` |
| UCD fee/prepaid/escrow enumerations by CD section | `shared/fannieMae/ucdFeeEnumerations.ts` |
| Delivery-readiness workflow + `loan_delivery_data` capture | `server/services/loanDeliveryReadiness.ts`, `shared/schema/delivery.ts` |
| Broker submission workflow (intake → DU → lender package) | `server/services/brokerSubmissionReadiness.ts` |
| AUS submission (dual: DU + simulated LPA leg) | `server/services/ausSubmission.ts`, `server/routes/aus.ts` |
| Wholesale lender submissions (Target-5 catalog + status machine) | `server/services/lenderSubmission.ts`, `shared/wholesaleLenders.ts` |
| Lending / underwriting routes | `server/routes/lending/`, `server/routes/underwriting/` (sub-registrar directories; `index.ts` order = Express matching order) |

## NMLS licensing: source of truth

For anything touching NMLS licensing — company/branch/MLO licensure (MU1/MU2/MU3/MU4),
sponsorship, Temporary Authority, Mortgage Call Reports, surety bonds, license statuses,
Consumer Access — consult the **NMLS Policy Guidebook** in [`docs/nmls/`](docs/nmls/)
(chapter/page map in its README). Do not answer NMLS policy questions from memory.
Hierarchy: state statutes/rules and direct regulator guidance control over the guidebook;
escalate discrepancies to the user instead of picking an interpretation.

## Architecture ground rules

Full rules in [DEVELOPER_PLAYBOOK.md](knowledge-base/handbook/DEVELOPER_PLAYBOOK.md); the non-negotiables:

- `main` is production — every push deploys to Vercel. No long-lived branches; land work via PRs.
- `client/` never imports from `server/`; `server/` never imports from `client/`; both import
  from `shared/`.
- All vendor integrations (credit, AVM, GSE) are **deterministic simulations** behind adapter
  functions until real contracts exist. Never call a vendor outside its adapter.
- Anything touching borrower PII goes through `server/services/encryptionService.ts`
  (SSNs via `server/services/ssnVault.ts`) and gets an audit-log entry (`server/auditLog.ts`).
- Security-sensitive changes (PII vault/encryption, auth/sessions, role gates, uploads,
  outbound messaging) require a security review before merge — binding trigger list in
  [knowledge-base/governance/TEAM_PRACTICES.md](knowledge-base/governance/TEAM_PRACTICES.md) §9.
- File uploads go through the object-storage layer at `server/integrations/object_storage/`;
  the shared size cap lives in `shared/uploads.ts`.
- The underwriting engine (`server/underwritingEngine.ts` + `server/services/decisionEngine.ts`,
  `server/services/ruleEngine.ts`) is deterministic — same inputs, same outcome, with typed
  error classification. Keep it that way; no nondeterminism or vendor calls inside it.

## Database (Drizzle ORM + Postgres)

- Schema is in `shared/schema/`; migrations are versioned SQL in `migrations/`.
- **Hand-author migration SQL files** — `drizzle-kit generate` has snapshot drift and produces
  wrong output in this repo.
- **Never run `pnpm db:push` from a worktree** against the shared dev database: it drops
  columns belonging to other branches. Use targeted `ALTER TABLE` statements instead.
- Apply migrations locally with `pnpm db:migrate`.

### Schema changes are migration-gated and auto-applied to prod (non-negotiable)

Prod is migrate-only. A schema change that reaches `main` without a migration — or with a
migration that is never applied — takes prod down (this is exactly the 2026-07-13 outage:
migrations 0026/0027). So:

1. **Same-PR migration.** Any PR that touches `shared/schema/**` MUST include a hand-authored
   `migrations/NNNN_*.sql` + `migrations/meta/_journal.json` entry in the **same PR**.
2. **Expand/contract, idempotent.** New columns use `ADD COLUMN IF NOT EXISTS` so the change is
   backward-compatible — the currently-deployed app tolerates the new DB and vice-versa. Never
   ship a destructive migration in the same PR as the code that depends on the new shape.
3. **The gate enforces #1.** `pnpm guard:schema` ([`scripts/schema-migration-guard.cjs`](scripts/schema-migration-guard.cjs))
   runs in the `gate` job of [`.github/workflows/ci.yml`](.github/workflows/ci.yml); a
   schema-without-migration PR goes RED and cannot merge.
4. **Auto-apply on merge.** The `migrate-prod` job applies pending migrations to prod on merge
   to `main` via [`scripts/migrate-prod.cjs`](scripts/migrate-prod.cjs) (plain `pg` over the Neon
   DIRECT URL — sidesteps the pooler gotcha). The URL is minted at run time from `NEON_API_KEY`
   by [`scripts/neon-connection-uri.cjs`](scripts/neon-connection-uri.cjs) — **no prod DB
   password is stored in GitHub**. Never hand-apply, never `db:push` to prod. To pre-flight,
   run the CI workflow manually with `dry_run: true` — but know what that proves: it reconciles
   the **journal** ("is prod's ledger in sync; is the pending list what I expect?") and **never
   executes a migration's SQL** (`--dry-run` prints `pending <tag>` and moves on). A green
   dry-run is not evidence the DDL will succeed.
5. **Contract migrations need a real data check.** `SET NOT NULL`, `CHECK`, `FK`, type
   narrowing — anything that can fail on existing rows — is not covered by #4's dry-run, and a
   contract migration that aborts on data fails the post-merge `migrate-prod` job: the
   2026-07-13 outage class. Before authoring one, verify the assumption against prod with a
   read-only probe (`NEON_API_KEY` is write-only in GitHub, so this runs *through CI*, not from
   a laptop) and record the counts in the migration's header comment. Recipe:
   [DB_MIGRATIONS.md §Contract migrations](knowledge-base/runbooks/DB_MIGRATIONS.md#contract-migrations-set-not-null-check-fk-type-narrowing).
   **Never backfill a guessed value to make a constraint pass** on a provenance/audit column —
   a NULL is an honest gap, a wrong value is a falsified record. Escalate instead.

Full flow and the one-time secret/branch-protection setup: [DB_MIGRATIONS.md](knowledge-base/runbooks/DB_MIGRATIONS.md).

## Commands

- `pnpm dev` — dev server (local convention: port 5001; worktree test servers on 5002)
- `pnpm check` — TypeScript
- `pnpm test` / `pnpm test:integration` — unit / integration tests
- Local setup details: [LOCAL_DEV.md](knowledge-base/runbooks/LOCAL_DEV.md)

## Source-of-truth notes

- [CTO_ROADMAP.md](CTO_ROADMAP.md) is the live roadmap. All other docs live in
  [`knowledge-base/`](knowledge-base/) (indexed in its README); the dated `knowledge-base/logs/`
  assessments go stale — verify any "X is missing" claim against the code before acting on it.
