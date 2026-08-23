# CLAUDE.md — Homiquity

Guidance for Claude Code when working in this repository. The deep engineering map is
[DEVELOPER_PLAYBOOK.md](knowledge-base/handbook/DEVELOPER_PLAYBOOK.md); the per-subsystem handbook is [knowledge-base/handbook/app-guide/](knowledge-base/handbook/app-guide/);
session working practices (doc rules, branch lifecycle, definition of done, push policy)
are [knowledge-base/governance/TEAM_PRACTICES.md](knowledge-base/governance/TEAM_PRACTICES.md). This file covers what must be true in *every* session.
Onboarding, or building through a Claude loop? [knowledge-base/handoff/](knowledge-base/handoff/)
is the Feynman layer over the app-guide — every chapter proves its claims with a command you
can run — and `handoff/prompts/` carries the loop rails and templates.

## Domain skills (loaded on demand)

Four `.claude/skills/*/SKILL.md` router skills carry each domain's non-negotiable rules
and point to the authoritative app-guide chapter (they don't duplicate it — that chapter
wins). Claude Code auto-loads a skill when its work matches:

- **`api-routes`** — backend endpoints under `server/routes/` (auth gating, Zod, CSRF/webhooks, PII/audit, `inArray`).
- **`ui-components`** — client UI/theming ("Mint & Flare" token guard, the `--flare` fill-not-text rule, WCAG AA, Shadcn/TanStack Query).
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
| Lending / underwriting routes | `server/routes/lending/`, `server/routes/underwriting/` (two of the four sub-registrar directories — `borrower/` and `agent-broker/` are the others; `index.ts` order = Express matching order) |

## NMLS licensing: source of truth

For anything touching NMLS licensing — company/branch/MLO licensure (MU1/MU2/MU3/MU4),
sponsorship, Temporary Authority, Mortgage Call Reports, surety bonds, license statuses,
Consumer Access — consult the **NMLS Policy Guidebook** in [`docs/nmls/`](docs/nmls/)
(chapter/page map in its README). Do not answer NMLS policy questions from memory.
Hierarchy: state statutes/rules and direct regulator guidance control over the guidebook;
escalate discrepancies to the user instead of picking an interpretation.

## Regulation Z: source of truth

For anything touching loan-originator compensation, the QM points-and-fees cap, the
finance-charge definition, or TRID fee tolerances — consult [`docs/reg-z/`](docs/reg-z/).
Do not answer Reg Z questions from memory.

✅ **The source text is now local, as of 2026-08-20.**
[`docs/reg-z/12-cfr-1026-regulation-z.xml`](docs/reg-z/12-cfr-1026-regulation-z.xml) holds the whole
of **12 CFR Part 1026 plus Supplement I** (the Official Interpretations — frequently the only place
a composition question is actually answered), pinned to eCFR Title 12 `latest_amended_on`
**2026-08-06**. A **section → line map** and a grep recipe are in
[`docs/reg-z/README.md`](docs/reg-z/README.md). **Cite it by section and line**, e.g.
*§1026.36(d)(2)(i)(A), line 1704ff*.

A reading fetched live is unrepeatable and drifts silently — that is why the copy is captured and
pinned rather than fetched per session. **Re-capture, do not re-fetch ad hoc**, and record the new
amendment date in that README when you do.

🚨 **Probe before you claim a source is unreachable. Do not trust this paragraph's answer — or the
opposite one.** This file previously stated as a permanent fact that `ecfr.gov`,
`consumerfinance.gov`, `govinfo.gov` and `law.cornell.edu` were all blocked. **That was true when
written** — the ledger records `CONNECT 403` on 2026-08-04/05 — **and false by 2026-08-18**, when all
four answered `200` with genuine section text, verified by content and not by status code
(12/12 stable across three rounds; the govinfo PDF's streams were decompressed to confirm).
Reachability here is **environment- and tool-dependent and has already flipped once**, so it is a
thing to *test*, never a thing to assert. Thirty seconds of probing beats either stale claim:

```bash
curl -sL -m 30 -o /tmp/regz.html -w '%{http_code} %{size_download}\n' \
  "https://www.ecfr.gov/api/renderer/v1/content/enhanced/current/title-12?chapter=X&part=1026&section=1026.36"
grep -c "lowest total dollar amount of discount points" /tmp/regz.html   # 0 = you got a wall, not the rule
```

**Four ways a reachable source looks blocked** (each one cost a real session):

1. **The eCFR API 302s to canonicalise** (it appends `subpart=E`) and returns `200` when followed.
   A bare `curl` without `-L` reads as failure. *(The genuine bot wall is the eCFR **HTML** site,
   which 302s to `unblock.federalregister.gov` — a different thing.)*
2. **`WebFetch` truncates long pages.** Ask it for §1026.36(e) and it answers that the text is not
   present, because its extraction stopped inside (d). Ask for an early paragraph to prove the fetch
   worked, then use `curl` for late ones.
3. **`WebFetch` enforces a ~125-character-per-quote ceiling.** "Quote all of (e)(3) verbatim" returns
   a refusal that reads like a block. Ask subparagraph-by-subparagraph.
4. **`govinfo.gov` serves soft 404s** — its CFR *HTML granule* path returns `200` with 44 KB of
   `<title>Page Not Found</title>`. Use the `/pdf/` path. **A 200 is never evidence; grep the body.**

🚨 **The one source this file tells you to fetch is the one actually blocked:** the Fannie Loan
Delivery job aid (`singlefamily.fanniemae.com/job-aid/loan-delivery`) returns **403**, so the
compliance instruction above has no executable path in-session — `docs/fannie-mae/` is the only
Fannie authority that exists. Selling Guide **A2-2-04** and **B3-2-01/B3-2-02** are absent from it and
have blocked verdicts.

**The rail is unchanged, and its scope is wider than Reg Z.** A reading is **verified** only when
it has been checked against a captured source *this run*, citing the locating detail; everything
else stays **flagged in
[`data/regulatory/regulatory-ledger.json`](data/regulatory/regulatory-ledger.json), never
asserted**. The capture satisfies the rail's own exit condition for Part 1026 — it does not widen
it. Two things did **not** change:

- **Conservative in one direction only.** A reading may remove a borrower charge or tighten a gate;
  it may never create the violation it guards against. A verdict that *loosens* a consent,
  disclosure, adverse-action or FCRA gate is a founder decision even when the text supports it.
  (Worked example: `shared/compliance/feeTolerance.ts` puts every Section C shoppable service in
  the **zero** bucket rather than the ten-percent one. §1026.19(e)(3)(ii)(C) conditions the
  ten-percent tier on the creditor permitting the consumer to shop per (e)(1)(vi) — and with no
  written provider list, that condition cannot be met, so the strict bucket is both correct *and*
  conservative. Were the written-list feature ever built, moving those lines to ten-percent would
  **loosen** a disclosure gate, and that is a founder decision even though the text would support
  it.)
- **Outside Part 1026, nothing is captured.** Of the 11 ledger entries that cited the 2026-08-04/05
  blocked-network condition, **3 are now verified** (`regz-1026-36d2-dual-compensation`,
  `regz-1026-32b1-points-and-fees-floor`, `trid-1026-19e3-fee-tolerance`, all reset to a 180-day
  interval). The other 8 had that now-false claim corrected in their notes but their **status is
  untouched** — nobody has re-read them. FCRA, Reg V and CROA entries need *different* sources; the
  CDIA Metro 2 manual is licensed and still not obtainable.

**Relaxing this rail is a founder decision, not an agent's** — a rail the machine can relax for
itself is not a rail.

## Architecture ground rules

Full rules in [DEVELOPER_PLAYBOOK.md](knowledge-base/handbook/DEVELOPER_PLAYBOOK.md); the non-negotiables:

- `main` is production — every merge to `main` triggers a **Railway** build + deploy from GitHub
  (config as code in [`railway.json`](railway.json); one persistent Node process, `dist/index.js`,
  serving both the API and the static client). No long-lived branches; land work via PRs.
- **A green check is not a shipped deploy.** A failed Railway build leaves the *previous* container
  serving, so the site stays up and every check stays green while prod goes stale (2026-08-06: nine
  consecutive failed deploys, ~8 commits behind, undetected). The only proof is the `commit` field
  of `GET /api/health` — the CI `verify-deploy` job polls it after every push to `main`. A 200 from
  `/api/health` proves the process is alive, nothing more.
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

### Local is the default verification target

`http://localhost:5001` is where every check runs — probing an endpoint, driving a page,
reproducing a defect, confirming a fix. `pnpm dev` is already fully local: `.env` points
`DATABASE_URL` at native Postgres on `localhost:5432`, and the client calls **relative** URLs, so
whatever origin serves the page serves the API — there is no base-URL flag to set. A local
`GET /api/health` answers `commit: null`; that null **is** the local-dev signature, not a defect.

Reach for the deployed site in exactly one case: proving a merge actually shipped, via the `commit`
field of `GET https://homiquity-production.up.railway.app/api/health` (machine-to-machine uses the
Railway host, never `www`). **Never reproduce a bug or check a UI change against prod** — a failed
build leaves the *previous* container serving, so what you see there may not be the code you think
you are looking at.

## Source-of-truth notes

- [CTO_ROADMAP.md](CTO_ROADMAP.md) is the live roadmap. All other docs live in
  [`knowledge-base/`](knowledge-base/) (indexed in its README); the dated `knowledge-base/logs/`
  assessments go stale — verify any "X is missing" claim against the code before acting on it.
