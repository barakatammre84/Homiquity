# CLAUDE.md — Homiquity (MortgageStream)

Guidance for Claude Code when working in this repository. The deep engineering map is
[DEVELOPER_PLAYBOOK.md](DEVELOPER_PLAYBOOK.md); the per-subsystem handbook is [kb/app-guide/](kb/app-guide/);
session working practices (doc rules, branch lifecycle, definition of done, push policy)
are [kb/TEAM_PRACTICES.md](kb/TEAM_PRACTICES.md). This file covers what must be true in *every* session.

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
| Lending / underwriting routes | `server/routes/lending.ts`, `server/routes/underwriting.ts` |

## NMLS licensing: source of truth

For anything touching NMLS licensing — company/branch/MLO licensure (MU1/MU2/MU3/MU4),
sponsorship, Temporary Authority, Mortgage Call Reports, surety bonds, license statuses,
Consumer Access — consult the **NMLS Policy Guidebook** in [`docs/nmls/`](docs/nmls/)
(chapter/page map in its README). Do not answer NMLS policy questions from memory.
Hierarchy: state statutes/rules and direct regulator guidance control over the guidebook;
escalate discrepancies to the user instead of picking an interpretation.

## Architecture ground rules

Full rules in [DEVELOPER_PLAYBOOK.md](DEVELOPER_PLAYBOOK.md); the non-negotiables:

- `main` is production — every push deploys to Vercel. No long-lived branches; land work via PRs.
- `client/` never imports from `server/`; `server/` never imports from `client/`; both import
  from `shared/`.
- All vendor integrations (credit, AVM, GSE) are **deterministic simulations** behind adapter
  functions until real contracts exist. Never call a vendor outside its adapter.
- Anything touching borrower PII goes through `server/services/encryptionService.ts`
  (SSNs via `server/services/ssnVault.ts`) and gets an audit-log entry (`server/auditLog.ts`).
- Security-sensitive changes (PII vault/encryption, auth/sessions, role gates, uploads,
  outbound messaging) require a security review before merge — binding trigger list in
  [kb/TEAM_PRACTICES.md](kb/TEAM_PRACTICES.md) §9.
- File uploads go through the object-storage layer at `server/integrations/object_storage/`;
  the shared size cap lives in `shared/uploads.ts`.
- The underwriting engine (`server/underwritingEngine.ts` + `server/services/decisionEngine.ts`,
  `server/services/ruleEngine.ts`) is deterministic — same inputs, same outcome, with typed
  error classification. Keep it that way; no nondeterminism or vendor calls inside it.

## Database (Drizzle ORM + Postgres)

- Schema is in `shared/schema/`; migrations are versioned SQL in `migrations/`.
- **Hand-author migration SQL files** — `drizzle-kit generate` has snapshot drift and produces
  wrong output in this repo.
- **Never run `npm run db:push` from a worktree** against the shared dev database: it drops
  columns belonging to other branches. Use targeted `ALTER TABLE` statements instead.
- Apply migrations with `npm run db:migrate`.

## Commands

- `npm run dev` — dev server (local convention: port 5001; worktree test servers on 5002)
- `npm run check` — TypeScript
- `npm test` / `npm run test:integration` — unit / integration tests
- Local setup details: [LOCAL_DEV.md](LOCAL_DEV.md)

## Source-of-truth notes

- [CTO_ROADMAP.md](CTO_ROADMAP.md) is the live roadmap. Other `kb/` assessment documents go
  stale — verify any "X is missing" claim against the code before acting on it.
