# Homiquity — the launch queue

**What this is:** every piece of work still open, one line each, in the order it should be done.
It is not a history. On 2026-08-06 this file was **96 KB** and ~71% of its bytes were narratives
about finished work, which made the 32 open items unfindable. The whole prior file — all 79 closed
items with their closure reasoning — moved verbatim to
[archive/roadmap/CTO_ROADMAP_2026-08-06.md](knowledge-base/archive/roadmap/CTO_ROADMAP_2026-08-06.md).

**Where things actually stand:** the commercial machine is **built and verified end to end behind
the pre-launch gate, against simulated vendors**. What stands between here and live is §0 and §1 —
almost entirely founder actions, not code. §2 is short because it is honest, not because it is
incomplete.

**Maintenance rules — binding. They are why this file is small.**

1. **One line per open item.** No closure narratives, no "slice 2 of 3" essays, no progress logs.
2. **Done = deleted here and appended to the archive ledger, in the same PR.** *How* it shipped
   belongs in the change ledger ([CICD.md](knowledge-base/runbooks/CICD.md)) and the PR — not here.
3. **No frozen status boxes.** A correction **edits the item**; it is never appended underneath one.
   The two boxes deleted on 2026-08-06 had been superseded three times and still labelled LS-2
   "Vercel env/ops" — with the correction eleven lines below, where a skimmer never reads it.
4. **Deploy, ops and compliance facts live in the runbooks.** Link; never restate.
5. **Verify before you check a box.** Six items in the old file were `[ ]` with bodies saying the
   work had landed, and two more asserted things the code contradicted.

**Detail lives elsewhere:** [ASSUMPTIONS.md](knowledge-base/governance/ASSUMPTIONS.md) (real vs
simulated vs pending) · [feature-review/FINDINGS.md](knowledge-base/feature-review/FINDINGS.md)
(verified defect register) · [CICD.md](knowledge-base/runbooks/CICD.md) (what shipped, when) ·
[BETA_GO_LIVE_READINESS.md](knowledge-base/runbooks/BETA_GO_LIVE_READINESS.md) (beta scope).

---

## §0 Keep-the-lights-on — time-bound; prod stops if these lapse

These outrank every engineering item below. They are not features; they are the condition for
anything else in this file being true.

- [ ] **KTLO-1. Railway trial expiry — roughly 30 days / ~$4.97 of credit left.** When it runs out
  **production stops serving.** Add a payment method / move off trial: Railway → project
  `Homiquity` → Settings → Billing. Coupled consequence: image retention is **72 h on Hobby**, so
  past that window [ROLLBACK.md](knowledge-base/runbooks/ROLLBACK.md) §1 has no one-step path.
  **Founder-held.**
- [ ] **KTLO-2. GitHub Actions capacity — the gate is queueing.** Observed 2026-08-06 21:2xZ: the CI
  run for `fix/railway-health-and-cron-host` sat `queued` 30+ minutes (normal is ~4 min), two open
  PRs have **zero check-runs and no run at all** (a dropped event, which needs an empty commit or
  close+reopen — `gh run rerun` reuses the original id and won't help), and five scheduled
  `cron-jobs` runs failed or were cancelled. The repo is **private**, so Actions minutes are
  metered. `gate (typecheck · tests · schema guard)` is the required status on `main` — **if it
  cannot run, nothing merges and `migrate-prod` never applies a migration.** Check Settings →
  Billing → Actions. **Founder-held.**
- [ ] **KTLO-3. Neon production compute is unpinned — cold starts measured at 5.5–7.4 s.** The first
  request after autosuspend pays that, on the borrower funnel. Decide alongside KTLO-1 (same billing
  conversation): pin the compute / disable autosuspend on the production branch, or accept it and
  record the number in [ASSUMPTIONS.md](knowledge-base/governance/ASSUMPTIONS.md). **Founder-held.**

---

## §1 Founder-held — blocks go-live

- [ ] **1.1 The go-live flip.** Set `PRELAUNCH_GATED=false` **and** `VITE_PRELAUNCH_GATED=false` in
  Railway → service `Homiquity` → Variables (environment `production`). `VITE_*` is compiled into
  the client bundle, so this needs a **redeploy, not a restart** — and it has not shipped until
  `GET /api/health` reports the new `commit`. `BETA_ACCESS_CODE` is a separate front-door switch.
- [ ] **1.2 Railway service variables — ~48 of the 65 names in `.env.example` are unset.**
  Launch-critical subset, in order: `GCS_SERVICE_ACCOUNT_KEY` + `PRIVATE_OBJECT_DIR` (durable
  uploads — the code half is done; `request-url` 503s `UPLOADS_UNCONFIGURED` until this lands);
  `SENDGRID_API_KEY` + `FROM_EMAIL` + SPF/DKIM DNS (real email — note DKIM is currently unaligned,
  see the DNS notes); `SENTRY_DSN` + an uptime monitor on `/api/health` (a prod crash is invisible
  today); `CRON_SECRET` **matching** the GitHub repository secret used by `cron-jobs.yml`. While in
  that panel, confirm `DATABASE_URL` points at the **production** Neon branch — on 2026-08-06 it
  pointed at a stale one and `/api/articles` + `/sitemap.xml` 500'd while `/api/health` stayed 200.
  Then walk the remaining names and decide set-or-omit for each. ~1 hour.
- [ ] **1.3 Wholesale-lender outreach — UNBLOCKED since 2026-07-13; nobody acted on it for three
  weeks.** F1 cleared with NMLS #427468, but the shortlist still gated five actions on "once F1
  clears". Live now: the UWM AE / Director-hotline call (sandbox process + whether BOLT exposes a
  PPE-consumable feed); the Newrez Brigade contact for the sandbox path; Angel Oak / Newrez
  approval-checklist requests; a manual read of Plaza's wholesale-broker guide PDF for
  net-worth/bond minimums; and **re-verifying all five are still broker-friendly and NMLS-active**
  (the file is a 2026-07-04 snapshot). Detail:
  [wholesale-lender-shortlist](knowledge-base/research/my-research/wholesale-lender-shortlist-2026-07-04.md).
- [ ] **1.4 Start the F3 (credit vendor) and F6 (DU/LPA) applications now** — vendor paperwork lead
  time runs *in parallel* with everything else, not after it. Starting the paperwork is not the same
  as building against it.
- [ ] **1.5 Production reseed for #24** — grids rerun + BRC-J30 jumbo min `806500.01`.
  `seedMarketPricing` is skip-if-exists, so this is a **destructive wipe-and-reseed**.
  Founder-supervised.
- [ ] **1.6 Status-vocabulary data migration on prod.** Dry-run
  `npx tsx scripts/migrate-status-vocabulary.ts`, confirm whether it already ran, apply with
  `--apply` if not. Founder-supervised (production data write).
- [ ] **1.7 Counsel gates, aggregated** (detail:
  [BETA_GO_LIVE_READINESS.md](knowledge-base/runbooks/BETA_GO_LIVE_READINESS.md) §5): BUILD-1
  pre-license calculator deviation · PH-2 consent copy · the Reg N cite confirmations from #138 ·
  the UAL §5 halal-lane review · **an ad-imagery / Fair Housing marketing policy — none exists**
  (flagged by `attached_assets/lifestyle/CREDITS.md`) · ratification of
  [MODEL_RISK_GOVERNANCE.md](knowledge-base/governance/MODEL_RISK_GOVERNANCE.md), which both READMEs
  cite as an authority while it is still marked DRAFT.
- [ ] **1.8 Regulatory subscriptions + Fannie Developer Portal** (~30 min): Fannie Selling Guide
  notifications (**email is the only Fannie channel** — their page is bot-protected), Freddie Guide
  bulletins, FHA INFO, VA lender news; register for the Developer Portal (public APIs free,
  business-partner APIs unlock with F6). See
  [REGULATORY_MONITORING.md](knowledge-base/compliance/REGULATORY_MONITORING.md).
- [ ] **1.9 Delete the dead `GEMINI_API_KEY`** — all AI is Anthropic; the key is verified unused.

---

## §2 Engineering — launch-blocking, ordered

- [ ] **2.1 Land or close [#446](https://github.com/barakatammre84/Homiquity/pull/446)** — a real
  `GET /health` liveness probe, and stop routing the three scheduled sweeps through a third-party
  DNS zone. Three cron sweeps died 2026-08-06 with `curl` exit 6 (could not resolve host) because
  they call `www.homiquity.com`, a CNAME in a Squarespace-hosted zone; machine-to-machine traffic
  must use `*.up.railway.app`. Currently **blocked on KTLO-2** (zero check-runs).
- [ ] **2.2 Fix uploads end-to-end**, then run the acceptance test. The code half is done
  (memory storage, honest failure copy in #444); it is `GCS_SERVICE_ACCOUNT_KEY` +
  `PRIVATE_OBJECT_DIR` from §1.2 that makes it real. Uploads silently vanishing is the single
  worst borrower-facing failure available to us.
- [ ] **2.3 Run [PROD_ACCEPTANCE_TEST.md](knowledge-base/runbooks/PROD_ACCEPTANCE_TEST.md) end to
  end** once §1.1 and §1.2 land. See §5.

---

## §3 Engineering — post-flip, ordered

- [ ] **3.1 ULAD field-mapping audit + escalations E-1…E-4.** The MISMO **structural** work is
  finished — #430 closed the last defect classes and the XSD gate now validates through a wrapper
  importing both `MISMO_3_0.xsd` and `ULDD_Phase_5_Extension.xsd` with a negative control. What
  remains is L6's untouched second half: audit `shared/mismo.ts` against
  `docs/fannie-mae/schemas/ulad-mapping-document.xlsx`, and resolve **E-1…E-4** (registered
  **U-14…U-17** in [FINDINGS.md](knowledge-base/feature-review/FINDINGS.md)) — the MISMO 3.0-vs-3.4
  authority conflict, the URLA 5b-J/5b-L foreclosure-family ambiguity, whether the eight orphan
  concepts belong in a ULDD delivery at all, and the unproven `OTHER` wrapper convention. **F-023/U-4
  stays open on the ULAD leg** — #430 pinned base-model names, not ULAD v1.8 ones.
- [ ] **3.2 The last N+1 loop.** `validateMISMOCompleteness` runs once per active application in
  `server/routes/underwriting/compliance.ts` and makes 5+ storage reads internally. Batching it means
  restructuring the URLA validator's data loading — a compliance-sensitive refactor, which is why it
  did not ride the mechanical batching PR. Pattern to follow: `/api/dashboard`'s `inArray`.
- [ ] **3.3 Internal data-lineage view for masked lender identity.** Borrower surfaces mask the
  wholesale lender by doctrine (`shared/borrowerOfferView.ts`); compliance and staff need the
  unmasked lineage somewhere.
- [ ] **3.4 Bind `/api/leads` to something — or delete it.** It has no caller anywhere in
  `client/src`. Needs a product decision first (headless partner-embed vs. a Homiquity-hosted form);
  PartnerHub prompt **PH-6** is chartered to resolve exactly this.
- [ ] **3.5 NMLS state-routing gate** — the assignment engine must refuse to route an application in
  a regulated state to an unlicensed LO. Buildable now that F1 has cleared.
- [ ] **3.6 Close the advisory-vs-binding gap.** S-05/S-06/S-07 rental offsets now reach
  `UnderwritingInput`, but `preUwFlags` is still read by neither `decisionEngine.ts` nor
  `underwritingEngine.ts` — so **S-01 income seasoning, S-03 sleeper debt and S-04 large deposits
  remain advisory-only**, and a `"blocking"` flag can fire on income the decision counts at full
  face value. `scenarioCatalog.ts` marking them `implemented` overstates it. Founder call between:
  (a) fold adjusted figures into `aggregateBorrowerFinancials` with explicit PRELIMINARY provenance,
  or (b) keep the engine on raw figures and make every `"blocking"` flag a real CTC-gating condition
  — verifying `checkPipelineProgress` actually enforces it.
- [ ] **3.7 Optimization-engine dispositions:** wire `matchAndPriceBorrower` / `getCoachPreFillData`
  to a surface **or delete them**; fire `calculateAgentCommission` from the funded-loan transition
  (near `graduateClosedLoan`) rather than a schedule.
- [ ] **3.8 Tag agent-sourced inbound leads.** `leads.source` has no value for an agent-referred
  borrower, so the playbook's 30%-agent-sourced gate is **structurally unmeasurable**. Needs a
  business decision on the intake mechanism (referral link / agent portal / manual code) before any
  engineering.
- [ ] **3.9 VA funnel.** The engine already routes `isVeteran` → VA products (580 FICO / 100% LTV
  seeded). Missing: COE check, funding-fee calculation incl. exemptions, residual-income table,
  IRRRL flow.
- [ ] **3.10 Real-time messaging transport** — presence dots are decorative (no WebSocket). Wire it
  to something real or remove it. Low priority; removing it is a legitimate answer.
- [ ] **3.11 LO/staff assignment engine** — respects 3.5. Build when there are humans to route to.
- [ ] **3.12 Program next-prompts** (charters in [`specs/`](knowledge-base/specs/)): **UAL P7**
  halal-lane channel gates (two founder calls + the spec-§5 counsel review; funder-agnostic math only
  until then) · **LO-3** client-facing Advisor Report (its LO-2 dependency merged) · **PH-3**
  partner-asset compliance guard + co-branded education engine.

---

## §4 Blocked on a contract or a document — do NOT start

One line, one unblocking trigger. Every adapter already exists as a deterministic simulation, so
each of these is a small, well-defined ticket the day its trigger fires.

- [ ] **F3 — credit vendor** (CRS One / iSoftpull). *Trigger: signed contract.* Then the real adapter
  in `server/mcp/vendors.ts` (it throws today if a key is set). **The medical-collections work ships
  with it**: FHA 4000.1's 5%-of-balance rule above $2,000 aggregate with medical excluded, plus the
  Fannie B3-5.3-09 payoff carve-out. No collections→DTI path exists today so nothing computes wrongly
  yet; the day real reports arrive, FHA files compute DTI wrong in both directions without it. *(The
  "2026 federal Medical Debt DTI exclusion" **does not exist** — verified 2026-07-04; the CFPB Reg V
  rule was vacated 2025-07-11.)*
- [ ] **F4 — Plaid production keys.** *Trigger: keys issued.* Real Link + asset reports through the
  existing webhook.
- [ ] **F5 — Truv contract.** *Trigger: signed contract.* Real VOIE into `verification_reports`.
- [ ] **F6 — GSE AUS access (Fannie DU + Freddie LPA).** *Trigger: credentials.* Submit to both
  engines at once (decided 2026-07-04) for best fit and rep-and-warranty relief.
- [ ] **F7 — AVM contract** (HouseCanary or other). *Trigger: signed contract.* Real valuations via
  `retrieve_property_valuation`.
- [ ] **F11 — Pricing engine (Lender Price and/or Mortech).** *Trigger: signed contract.* Build the
  MISMO transfer middleware; the internal rate-sheet + LLPA engine becomes the clearly-marked
  simulation behind the same interface. Optimal Blue / LoanSifter evaluated and passed on.
- [ ] **F12 — IRS IVES transcript access (4506-C → A2A).** *Trigger: founder IRS e-Services + IVES
  enrolment **and** counsel sign-off on the consent flow and FTI handling.* No schema, code, or env
  var before both.
- [ ] **F13 — Down Payment Resource feed.** *Trigger: a founder decision to pursue it at all*, then
  SOC 2 + a signed DPA + permissible-purpose review. Table-fed import only, scoped to
  `LICENSED_STATES`; borrower income/ZIP must never egress.
- [ ] **F14 — Fannie authority corpus for rent-history underwriting.** *Trigger: the Selling Guide
  section on positive rent history, the DU Release Notes, and the asset-verification-report spec land
  in `docs/fannie-mae/`.* Until then rent-history-to-DU cannot even be adjudicated.
- [ ] **F15 — Freddie Mac corpus.** *Trigger: founder decision + Form 91 lands in a new
  `docs/freddie-mac/`.* No such directory exists, so every "Freddie program" claim is locally
  unverifiable and LPA stays a simulation leg.
- [ ] **LS-10 slice 3 — real per-lender portal hand-off.** *Trigger: a signed broker–lender
  agreement.* Slices 1 and 2 shipped (status machine; MISMO package assembly + immutable snapshot +
  sha256). `submitToLenderPortal` stays a deterministic simulation.
- [ ] **OPT-2 — stale-application re-engagement email.** *Trigger: an email consent + unsubscribe
  path, plus a §9 security review.* Note the original blockers **have cleared** — quiet hours (#24)
  and the SMS STOP/opt-out ledger (#25) both shipped. What `sendReEngagementEmails` still lacks is
  consent and unsubscribe on the **email** leg. Do not schedule it until both exist.

---

## §5 Flip day

Do not improvise it. The checklist is
**[runbooks/PROD_ACCEPTANCE_TEST.md](knowledge-base/runbooks/PROD_ACCEPTANCE_TEST.md)** — run it top
to bottom against `https://www.homiquity.com` (the `www` is load-bearing; the apex is a Squarespace
forward), check every ⛔ BLOCKER, and paste the result into the change ledger.

Its §0 preconditions are the ones people skip, and both have burned us: prove the deploy is current
**by `commit`, not by a green check** — a failed Railway build leaves the previous container serving
— and prove the app is talking to the **right database** by hitting a data-backed route, because
`/api/health` returns 200 from the wrong one.
