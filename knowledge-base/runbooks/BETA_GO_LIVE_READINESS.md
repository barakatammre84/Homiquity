# Beta Go-Live Readiness

**Snapshot: 2026-07-12** — founder walkthrough of the gated live beta (invite-link).
Point-in-time state; update as PRs merge and decisions land. The binding launch-gate
checklist is [PROD_ACCEPTANCE_TEST.md](PROD_ACCEPTANCE_TEST.md) — this doc is the
readiness summary that feeds it.

**Bottom line:** the core beta journeys are verified and working end-to-end. Nothing in
the code blocks the demo path today. Go-live is gated on operational config (env, storage,
migrations) plus **one** regulatory decision — flipping the pre-license gate so real humans
can submit an application, which needs the issued NMLS id and counsel sign-off.

Verified live against the worktree dev server (`:5002`). All findings are now **merged to
`main` and deployed to prod (2026-07-12)** — PRs #135–#138 (this snapshot itself shipped as
#139). Current prod = `dpl_ApJzgcLUuf2mJZUTG2hoHBeBVC19` **READY**, `GET /api/health` → 200;
see the [CICD ledger](CICD.md) row for the per-PR deploy evidence.

---

## 1. Workflows verified live

Each was driven step-by-step against the running app, including the negative "must-refuse"
gates. Two required a code fix (shipped in §2).

| Workflow | Status | Notes |
|---|---|---|
| Applicant funnel — apply end to end | ✅ verified | 13 steps render + accept input; autosave; Reg-Z-safe disclosures throughout (soft-pull, broker role, "not a commitment to lend", FCRA authorization, Equal Housing / NMLS Consumer Access). Deferred-submit is localStorage-only — `A1` follow-up. |
| Borrower post-submission dashboard | ✅ verified | Status, 7-step journey tracker, next-step CTA, 30-day pre-approval validity. Homeowner Hub correctly gated to files with a funded loan. |
| Beta-LO cockpit — receive & work a file | ✅ verified + fixed | Intake inbox → **Claim** puts a self-serve file on the LO's desk with atomic access + queue visibility (fixed the handoff gap). |
| Wholesale-lender push — terminal step | ✅ verified + fixed | Submit to lender → run DU/LPA → `lender_submissions` row with a hashed, staff-only MISMO 3.4 package + confirmation id. Re-wired the "Submit to lender" action the LO-1 cockpit rewrite had dropped. |
| Document upload → extraction | ✅ verified | Presigned-only; magic-byte content check rejects spoofed files; cross-borrower download 403; extraction never auto-verifies and encrypts the raw model response; fails loud (503) in prod if storage is unconfigured. |
| Credit consent → denial → adverse action | ✅ verified | Pull refused without FCRA consent; intake **never auto-denies** (ECOA locus); a denial is **blocked unless a compliant adverse-action notice generates** (§1002.9 + FCRA §615); borrower reads the notice; staff mails the PDF; 30-day watchdog de-dups. Closes `F-004`. |

## 2. Ships merged & deployed — 2026-07-12 (each = prod deploy)

Merged in order **#135 → #136 → #138 → #137 → #139** (all squash commits); prod is healthy
(`/api/health` 200). #137/#138's individual deploys auto-CANCELED — superseded within seconds
by the next merge in the rapid-succession train — so their content reached prod via the #139
deploy, which is now current prod. No migration (HEAD stays `0023`).

| PR | Summary | Prod deploy |
|---|---|---|
| [#135](https://github.com/barakatammre84/MortgageStream/pull/135) | Money path — intake pool/claim + handoff, Run-DU/LPA button, XSD conformance recording, demo seed, re-wired Submit-to-lender action. §9-reviewed (net-positive — closes an IDOR). | `dpl_5CEDU…` READY |
| [#136](https://github.com/barakatammre84/MortgageStream/pull/136) | Project `passwordHash` out of `/admin/users` (F-007); wire the `loanOutcomes` writers so dashboards stop rendering off an empty table (F-002). | `dpl_HEjwh…` READY |
| [#138](https://github.com/barakatammre84/MortgageStream/pull/138) | Hard-block LO "approval guaranteed" messages (Reg N §1014.3(q)), clause-scoped negation guard, cite fix, + scrub of the one existing prohibited message. Compliance-auditor validated. | via #139 (own deploy superseded) |
| [#137](https://github.com/barakatammre84/MortgageStream/pull/137) | Borrower predictive insights — UDAAP-safe: drop the closing-odds % and single "days to funding" from the borrower surface (qualitative outlook + typical range + disclaimer). Compliance-auditor validated. | via #139 (own deploy superseded) |
| [#139](https://github.com/barakatammre84/MortgageStream/pull/139) | This readiness snapshot. | `dpl_ApJzg…` READY = current prod |

## 3. Go-live checklist (founder actions)

These are founder actions — prod env, credentials, counsel. `[GATE]` = regulatory;
`[DECISION]` = your call; `[ENV/OPS]` = configuration.

- [ ] `[GATE]` **Pre-license gate flip** — the only thing between an invited human and
  submitting an application. Set the issued `nmlsId` + `mersOrgId` in
  `shared/companyIdentity.ts`, then `PRELAUNCH_GATED=false` + `VITE_PRELAUNCH_GATED=false`,
  with counsel sign-off on the BUILD-1 deviation. Until this, LO surfaces + the lender demo
  work; only applicant-submit is gated. (Do **not** invent an NMLS number.)
- [ ] `[DECISION]` **Credit-vendor mode** — recommend leaving `CREDIT_VENDOR_MODE` **unset**:
  real credit pulls refuse (no bureau contract yet) rather than deciding on fabricated
  scores. `=simulation` fabricates bureau data — not appropriate for real applicants.
- [ ] `[DECISION]` **Document-extraction mode** — set an Anthropic key (`ANTHROPIC_API_KEY`) **or**
  `EXTRACTION_SIMULATE=true`. Without either, uploads still succeed and reach the LO, but
  AI extraction returns empty. `EXTRACTION_SIMULATE=true` is the clean demo choice.
- [ ] `[ENV]` **Invite gate** — set `BETA_ACCESS_CODE`; confirm the `/?beta=<code>` → cookie
  → lock-screen flow on the deployed env.
- [ ] `[ENV]` **Object storage** — `GCS_SERVICE_ACCOUNT_KEY` + `PRIVATE_OBJECT_DIR` +
  `PUBLIC_OBJECT_SEARCH_PATHS`, else uploads correctly 503.
- [ ] `[ENV]` **Boot-required + ops secrets** — `DATABASE_URL`, `CREDIT_ENCRYPTION_KEY`,
  `PII_HASH_SALT`, `SESSION_SECRET`, `NODE_ENV=production`; plus `SENDGRID_API_KEY`
  (+SPF/DKIM), `SENTRY_DSN`, `CRON_SECRET` for the daily jobs.
- [ ] `[OPS]` **Prod DB migrations reconciled** — run the CI `migrate-prod` workflow with
  `dry_run: true` (Actions → CI → Run workflow) and confirm "up to date — no pending
  migrations"; journal drift reconciles via `markMigrationsApplied.ts`, never a hand-apply
  ([DB_MIGRATIONS.md](./DB_MIGRATIONS.md) — the old raw-pg recipe is retired). These four
  PRs add no migration.
- [ ] `[OPS]` **Provision beta LO accounts** — admin-assign the staff role (never
  self-registered), then the LO can claim from the intake inbox.
- [ ] `[OPS]` **Adverse-action delivery discipline** — if the beta denies anyone, staff
  must deliver the notice within 30 days (ECOA §1002.9); the watchdog raises reminders.

## 4. Honest limitations

Deliberate simulated adapters — correct for a demo and for MVP (vendors stay simulated until
contracts exist), but material before real loans ride on this.

- **Wholesale-lender push is simulated** — generates a real, hashed, compliant MISMO package
  and a simulated confirmation, but transmits nothing. No broker agreements are signed (all 5
  lenders are "target"). A real loan doesn't reach a portal until agreements + the portal
  adapter exist.
- **AUS (DU/LPA) and credit pulls are simulated** — deterministic simulations behind clean
  adapter seams. Real findings need the live vendor contracts.
- **MISMO generator XSD-conformance gap** — the package records ~11 non-conformant elements
  (`L6 / F-025`). Non-blocking for a demo; before **real** lender delivery these need
  MISMO-data-dictionary-confirmed fixes (element names must not be guessed — compliance rule).

## 5. For counsel

- **Pre-license flip & the BUILD-1 deviation** — taking real applications pre-license, and
  the public priced calculators / apply CTAs on the pre-license surface, need counsel
  ratification before the gate flips.
- **Comms-lint citation confirmation** — confirm the collateral Reg N cites verbatim
  (`no-fees §1014.3(f)→(c)`; `government (m),(n)→(n)`); the auditor endorsed keeping
  government-affiliation as a warning (VA/FHA have truthful forms). Not changed in this pass.
