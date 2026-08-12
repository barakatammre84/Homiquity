# 2026-08-08 — External "Rent Reporting / Renters-to-Homebuyers" pitch: adjudication

> **Dated snapshot** (Tier 4). Facts verified against the code on 2026-08-08 (worktree off
> `f1c6b7e`); verdicts govern until a reopen gate below fires. Same protocol as
> [2026-08-04-renter-incubation-pitch-adjudication.md](./2026-08-04-renter-incubation-pitch-adjudication.md),
> [2026-08-04-sovereign-underwriting-stack-pitch-adjudication.md](./2026-08-04-sovereign-underwriting-stack-pitch-adjudication.md),
> and [2026-08-04-cross-sector-fintech-frameworks-pitch-adjudication.md](./2026-08-04-cross-sector-fintech-frameworks-pitch-adjudication.md):
> adopt nothing wholesale, verify every claim in code, extract what survives, record binding
> rejections with reopen conditions.

## 0. What arrived, and the ask

An external pitch for a rent-reporting module framed as a self-funding acquisition loop:
renters pay a low monthly subscription to have rent furnished to the credit bureaus, and
"the exact moment their FICO score crosses the threshold (e.g. 620 or 680), our Deterministic
Underwriting Engine instantly intercepts them for a mortgage pre-approval." Four components:

1. **`Metro2Compiler.ts`** — a hand-rolled fixed-width Metro 2® generator ("no external
   libraries"), including a `generateRentTradeline(user, lease, paymentStatus)` mapping to
   "Account Type 3A (Unsecured rent)".
2. **`RentVerificationService.ts`** — scan Plaid Transactions for an outflow "within 5% of the
   `leaseAmount`" matching keywords for the landlord name, 'Rent', 'Venmo', or 'Zelle'; mark
   `VERIFIED`, else flag `MISSED` after the 5th.
3. **`RentReportingOnboarding.jsx`** — a Stripe-aesthetic React flow (indigo focus rings,
   `rounded-2xl`), with pricing cards "$5/mo — Monthly Reporting" and "$49 One-Time — Report
   Past 24 Months".
4. **The "moat" / 100-record strategy** — bureaus won't accept a furnisher under 100 active
   lines, so "build the platform, queue the users in a `Pending Bureau Submission` database
   state, **collect the subscription revenue**, and batch-release the Metro 2 file the day you
   hit 100 users."

**Founder direction arrived with the paste**, unlike the 2026-08-04 series: rent should flow
*through the platform* to the landlord ("I would love to keep users in my ecosystem"), and,
when asked, the founder chose **direct furnisher** (not white-label), **licensed-partner
payment rails with zero Homiquity custody**, and **adjudication plus a Phase 0 build**.

The founder's payment instinct is the strongest idea in the thread, and for a reason the pitch
does not give — see §2's first row.

## 1. Facts: the stack described is not this stack

Every row verified in code this session, not from memory:

| Pitch claim | Repo reality |
|---|---|
| "your current Replit, Neon (Postgres), and Node/React stack" | **Railway + Neon**, deployed from GitHub, one persistent Node process serving API and static client ([`railway.json`](../../railway.json)). Replit is not the platform, and the deploy failure mode the pitch is unaware of is that a failed Railway build leaves the *previous* container serving — only `/api/health`'s `commit` proves a ship. |
| "We will use Plaid Transactions API… run a webhook/cron job that scans for a recurring outflow" | **`plaid@45` is installed and keyless by founder decision**, wired to Identity/Income/Assets only (`server/plaid.ts`: `Products.Income`, `Products.IdentityVerification`, `Products.Assets`). **No `Products.Transactions`, no Auth, no Transfer.** It fail-closes — every function throws without creds and routes return 503; it does not fabricate. Enabling Transactions is a new PII egress ⇒ §9 sub-processor review, which is the standing gate from the 2026-08-04 renter-incubation adjudication and has not moved. |
| "update the user's `rent_payments` table in Drizzle ORM" | **No such table existed.** Before this program there was no lease, landlord, rent-payment, or rent-reporting table anywhere; `landlord` appeared nowhere in `shared/schema/`. Borrower-paid rent existed exactly once — `homeownership_goals.current_rent`, a self-entered decimal consumed as a tier-3 DTI **liability** at `server/services/borrowerGraph.ts:552`. Rent was modelled as a debt, never a credit positive. |
| "Build a strict fixed-length string generator that complies with the CDIA Metro 2® Format guidelines" | **The manual is not in the repo, and unlike every other blocked source it cannot be fetched at all** — CDIA licenses it to members and vetted furnishers. Repo-wide, `metro2`, `Metro 2`, `CDIA`, `furnisher`, `1681s-2`, `eOSCAR`, and `ACDV` had **zero occurrences**. CLAUDE.md's compliance-first rule ("if a name or value cannot be verified, stop and flag it rather than guessing") is not a stylistic preference here: a wrong offset in a fixed-width format does not fail loudly, it produces a well-formed record whose fields land in the wrong columns. |
| "Account Type 3A (Unsecured rent)" | **Unverifiable — quarantined as an uncited external claim**, the same treatment the Appendix A.2 non-QM program numbers get (`tests/nonQmProgramGate.test.ts`). Recorded in `docs/cdia-metro2/README.md` as a claim, never coded against; `tests/metro2Gate.test.ts` fails if `'3A'` appears in either Metro 2 module. |
| "Equifax, Experian, and TransUnion generally will not accept you… until you have 100+ active reporting lines" | **Uncited claim about three private companies' onboarding policies.** No in-repo document states it. Hardcoding 100 would give an invented number the appearance of policy and every downstream surface would then quote it to users. Modelled as a state (`pending_minimum_lines`) with `BUREAU_MINIMUM_ACTIVE_LINES = null` — the same no-threshold-constant treatment the portal-gated DSCR minimum gets in `server/services/income/paths/dscr.ts`. |
| "queue the users… **collect the subscription revenue**… batch-release the day you hit 100" | **The repo processes no payments at all** — zero processor dependencies, no ledger, no receivable, no trust/operating account separation (confirmed by the 2026-08-04 financial-architecture audit). And charging monthly for credit reporting that is *not occurring* is a deceptive-practice exposure on its own, plus the open CROA §1679b(b) advance-payment question. **Rejected — see §2.** |
| "$49 One-Time — Report Past 24 Months" | **Rejected.** Furnishing 24 months of history we never observed is a direct accuracy problem under §1681s-2(a) / Reg V Appendix E, and it is precisely the data we have the least basis for. |
| Prompt C: `.jsx`, indigo focus rings, "premium, Stripe-like aesthetic" | The repo is TSX with **Royal Blue Emerald** semantic tokens, ratcheted by `scripts/design-token-guard.cjs` (raw palette utilities target 0). The pitch's *interaction* instinct — clickable cards rather than radio buttons — is **already house style**: `PartnerWaitlist.tsx` does exactly that with `aria-pressed`. |
| "the exact moment their FICO crosses… instantly intercepts them for a pre-approval" | **No `permissiblePurpose` concept exists anywhere in the code** — FCRA permissible purpose is currently conflated with consent. Using monitored report data to trigger a mortgage solicitation is prescreen/firm-offer territory (§604(c), §615(d)). Also `LICENSED_STATES = ["IL"]`. The socket the pitch wants, however, genuinely existed and was **dead**: `emitCreditEvent` with `CREDIT_SCORE_DROPPED`/`NEW_TRADELINE_DETECTED` and seeded SLAs had **zero callers**. |
| "Go to the CDIA website today and request the Metro 2® Format Manual" | **Correct, and it is the critical path.** This is the one piece of the pitch adopted unchanged. |

**PM note:** tenth external pitch in this series, and the first to arrive *with* founder
direction rather than as a cold paste. The pattern from the 2026-08-04 trio holds — the
strategic observation is real, the mechanics are unverifiable or barred — but with an
inversion worth recording: the founder's own addition (rent flowing through the platform) is
the single change that makes the rest defensible, and the pitch's own verification design is
the single most dangerous line in the document.

## 2. Point-by-point verdicts

| Recommendation | Verdict | Why (evidence) | Reopen gate |
|---|---|---|---|
| **Rent paid through the platform to the landlord** (founder addition) | ✅ **Adopted as the evidentiary basis** | This is the load-bearing idea, and not for the retention reason given. A first-party payment record is the only basis that can survive an FCRA §1681s-2(a) accuracy duty. `rent_payments.provenance` encodes it, and `platform_processed` is the sole furnishable value (`FURNISHABLE_PROVENANCE`). | — (the *rails* are gated below) |
| Plaid Transactions keyword/5%-tolerance rent matcher | ❌ **Rejected — binding** | Consider the false negative: it furnishes a **MISSED** payment for a consumer who paid, from a fuzzy string comparison against 'Rent'/'Venmo'/'Zelle'. A heuristic is an acceptable basis for a suggestion and an unacceptable basis for a derogatory statement to a credit bureau. `bank_observed` exists as a provenance value precisely so it can be *excluded*. | None for furnishing off inference — doctrine. Plaid Transactions may still land for payment-failure *detection* (never furnishing) under the standing 2026-08-04 gate: keys + product decision + §9 sub-processor review. |
| Hand-write `Metro2Compiler.ts` now | ⏸ **Deferred — missing document, not missing feature** | The CDIA manual is absent and unfetchable. `shared/lib/metro2/compiler.ts` ships as a seam: `FIELD_LAYOUT` is empty, `BASE_SEGMENT_LENGTH` is `null` (summing an empty layout would yield a confident `0`), and `compileBaseSegment` throws — the established pattern from live DU (`ausSubmission.ts:155`) and a set credit-vendor key (`mcp/vendors.ts`). | The manual lands in `docs/cdia-metro2/`. `tests/metro2Gate.test.ts` is **self-releasing**: it asserts the implication (populated layout ⇒ local citation exists), so nothing has to be remembered at the moment attention is scarcest. |
| Fixed-width formatting primitives | ✅ **Adopted** | Justification and fill are properties of fixed-width encoding, not of Metro 2, so they are writable and testable without the manual. `padNumeric` (right/zero), `padAlpha` (left/blank), `assertRecordLength`. **Every overflow throws** rather than truncating: truncating a numeric field changes an amount and truncating a name field changes who the record is about, and which one the manual prescribes is itself a manual question. | — |
| "Account Type 3A" | ❌ **Rejected as a fact; recorded as a claim** | Uncited. Test-pinned against reintroduction. | The manual confirms it. |
| "100+ active lines" as a coded threshold | ❌ **Rejected as pitched** | Uncited claim about private onboarding policies. `BUREAU_MINIMUM_ACTIVE_LINES = null`; the readiness evaluator names the unknown as a blocker instead of assuming a number. | Per-bureau furnisher specifications land in `docs/cdia-metro2/`. |
| **Collect subscription revenue while queued** | ❌ **Rejected — binding** | Charging for credit reporting that is not happening is a deceptive-practice exposure independent of CROA's scope, and whether a subscription positioned as credit improvement falls inside CROA §1679b(b) is the counsel question already opened on 2026-08-04 §5.6 and still unanswered. `RENT_REPORTING_BILLING_ENABLED = false`, and the real guard is the **absence** of a processor — `tests/rentFurnishing.test.ts` asserts the absence directly, so flipping the constant is not sufficient to charge anyone. | Counsel opinion on CROA scope **+** a furnished tradeline actually existing. Not before both. |
| "$49 — report past 24 months" retroactively | ❌ **Rejected — binding** | Furnishing history we never observed is the weakest possible position under an accuracy duty we have not read. | Counsel **+** Reg V Appendix E text in `docs/fcra/`. |
| Pricing cards on the onboarding surface | ❌ **Rejected** | Nothing may be sold before a tradeline exists. `tests/rentReportingSurface.test.ts` pins that no price, `/mo`, or checkout language appears on the page. | Same gate as the billing row. |
| Stripe/indigo aesthetic, `.jsx` | ❌ **Rejected as pitched; the interaction kernel already ships** | Royal Blue Emerald tokens + TSX are the house system; clickable cards over radios is already the `PartnerWaitlist.tsx` pattern. | — doctrine. |
| Score-threshold "instant intercept" of the borrower | ❌ **Rejected as pitched; the socket adopted staff-side** | No permissible-purpose model exists; prescreen/firm-offer rules apply; IL-only footprint. The dead socket **is** wired — `server/services/creditMonitoring.ts` fires `emitCreditEvent` on a representative-score drop, producing a **staff task**, not outreach. `tests/creditMonitoring.test.ts` pins that no notification/SMS/email path is reachable from it. | A permissible-purpose model **+** counsel on prescreen/firm-offer **+** footprint decision. |
| Rent history → mortgage underwriting | ⏸ **Deferred — unchanged from 2026-08-04** | Still gated on CTO_ROADMAP **F14**: the Fannie Selling Guide section governing positive rent-payment history, DU Release Notes, and the asset-verification-report spec must land in `docs/fannie-mae/`. This program builds the *data*; it asserts nothing about what DU will do with it. | F14 fires. |

## 3. Defects and gaps found during verification

Found while verifying, independent of the pitch's verdicts:

1. **§9 had no money-movement trigger and no furnishing/CRA trigger.** A genuine gap this
   program walks straight into, and the money-movement half is independent of rent: the repo
   has no ledger and no trust/operating separation, so the first funds-touching PR would have
   arrived with none of the invariants that make it reviewable after the fact. Both added
   (§4 Leg F), with the money one as a **content** trigger — the file that will carry it does
   not exist yet, and a speculative path is a trigger that can never fire.
2. **`emitCreditEvent` had zero callers.** `CREDIT_SCORE_DROPPED`, `NEW_TRADELINE_DETECTED`,
   and `CREDIT_EXPIRED` were unreachable event types with seeded SLAs — a socket that read as
   working. Now fired for score drops (§4 Leg E).
3. **`emitCreditEvent` is not idempotent.** Its key is
   `credit_${type}_${applicationId}_${Date.now()}` — a fresh value per call — so a daily sweep
   would re-emit the same delta between the same two pulls forever, one new staff task per
   run. The sweep's lookback window is the guard, and it is test-pinned as such.
4. **A new sweep with no cron entry never runs.** `.github/workflows/cron-jobs.yml` is *the*
   scheduler (the platform cron twin was deleted at the Railway cutover). The new endpoint is
   registered in all three places the workflow needs and added to `tests/cronSchedules.test.ts`
   — the file that exists because removing a trigger produces no error anywhere.
5. **`tryResolveMatrixValue` still has zero production call sites** — the non-throwing
   display-surface variant of the lookup resolver is defined and unused. Noted, not actioned.
6. **Cross-checkout dependency leak (tooling, not code).** A git worktree with no install
   resolves modules *upward* to the primary checkout's `node_modules`. The primary checkout
   currently has a modified `package.json`/`pnpm-lock.yaml` (an in-flight `react-hook-form`
   7.84 bump against main's `^7.83.0`), so `tsc` in a fresh worktree reported **17 errors in
   four files nobody had touched**. `pnpm install --frozen-lockfile` in the worktree cleared
   all 17. Worth knowing before someone diagnoses a phantom breakage.

## 4. Adopted program — "Rent Ledger, Phase 0" (six legs)

Constraint up front: nothing furnishes, nothing charges, and nothing moves money.

- **Leg A — authority corpora (`docs(compliance)`)**: `docs/cdia-metro2/README.md` and
  `docs/fcra/README.md` on the `docs/reg-z/README.md` pattern (shopping list, hierarchy,
  blocked-decision table, "once it lands" checklist), plus **four flagged ledger entries** at
  14-day review intervals so `pnpm checkup` goes loud:
  `fcra-1681s2-furnisher-accuracy`, `regv-1022-43-dispute-response`,
  `cdia-metro2-base-segment-layout`, `croa-1679b-advance-payment`.
- **Leg B — rent ledger (`feat(rent)`)**: `leases`, `rent_payments`, `rent_furnishing_queue`
  in `shared/schema/rent.ts` + hand-authored `migrations/0054_rent_ledger.sql` and journal
  entry in the same PR. Two-axis status throughout; `provenance` NOT NULL with **no default**
  (there is no safe value to assume for the column that decides furnishability); landlord
  email and property address encrypted on the three-column `encryptionService` pattern.
- **Leg C — Metro 2 seam (`feat(rent)`)**: `shared/lib/metro2/format.ts` (primitives) and
  `compiler.ts` (empty layout, throws), gated by `tests/metro2Gate.test.ts`.
- **Leg D — renter surface (`feat(rent)`)**: `/rent-reporting`, ungated, Royal Blue Emerald,
  email-only waitlist through `POST /api/email-capture`. The page states **"We are not
  reporting to the credit bureaus yet"** in an alert, not a footnote.
- **Leg E — credit monitoring (`feat(credit)`)**: `server/services/creditMonitoring.ts` with a
  pure planner + `GET /api/jobs/credit-monitoring` on the existing dual-trigger cron pattern.
  **Any** decrease fires — no invented materiality threshold, because a cutoff would be a
  policy number and policy numbers come from the seeded, cited lookup matrices.
- **Leg F — §9 triggers (`chore(governance)`)**: money movement + consumer-data furnishing,
  in `TEAM_PRACTICES.md` §9, `scripts/security-review-guard.cjs`, and
  `tests/securityReviewGuard.test.ts`.

Explicitly **not** built: the Metro 2 field layout, the Plaid rent matcher, any consumer
charge or price surface, retroactive history furnishing, borrower-facing score-threshold
solicitation, and any payment rail.

**Known incomplete:** the authenticated lease-capture flow. The PII columns on `leases`
(landlord email, property address) therefore have no *writer* yet — their reader is the
furnishing gate. This is a live tension with the standing **no speculative schema** rule and
is called out rather than papered over; the capture flow is the next PR and closes it.

## 5. Founder / counsel items

1. **CDIA membership + the Metro 2® Format Manual (founder).** The critical path for Leg C,
   and the one piece of the pitch adopted unchanged. Not a download — a procurement action.
2. **FCRA §1681s-2 / Reg V (incl. Appendix E) / CROA text into `docs/fcra/` (founder).**
   Blocked hosts mean a human must place these.
3. **Counsel — furnisher status and dispute operations.** Registering as a furnisher creates
   standing §1681s-2 duties and an ACDV/e-OSCAR obligation that is a **staffed process, not
   code**. The queue models the obligation; nothing models the operation. Who answers disputes?
4. **Counsel — billing timing.** May a subscription be charged before any tradeline is
   furnished? Extends the CROA-adjacency question from 2026-08-04 §5.6. Current posture: no.
5. **Payments partner selection (founder).** Must be the money transmitter of record with
   **zero Homiquity custody** — BSA/AML diligence, signed data-processing agreement, §9
   sub-processor review. Note the repo has no trust/operating separation, which is survivable
   only while custody is genuinely zero.
6. **Landlord onboarding (founder).** Delivery requires a landlord willing to accept funds.
   This is a second GTM motion the pitch does not account for.
7. **Footprint (founder).** Rent reporting and rent payments are not gated by mortgage
   licensure, but the marketing surface is (`LICENSED_STATES = ["IL"]`). Does the renter
   product run nationwide while the mortgage funnel stays IL-only?
8. **Plaid Transactions product decision (founder).** Still needed for payment-failure
   detection even on partner rails. Standing gate from 2026-08-04.

## 6. Binding restatements

- **New: nothing is furnished on inferred evidence.** Only a first-party
  (`platform_processed`) payment record may be furnished. A heuristic may drive a suggestion;
  it may never drive a derogatory statement to a credit bureau.
- **New: no consumer is charged before a tradeline exists.** The guard is the absence of a
  payment processor, not a boolean.
- **"No machine-issued financial attestations to third parties"** (2026-08-04 cross-sector
  memo) — a furnished tradeline *is* one. This program is the first sanctioned exception, and
  the exception is conditioned on the `docs/fcra/` + `docs/cdia-metro2/` corpora existing.
- **No underwriting or format policy from memory** (CLAUDE.md compliance-first) — exercised
  hardest here: a fixed-width layout invented from memory fails silently, downstream, on a
  real person's credit file.
- **Uncited external figures are quarantined, never coded against** — held against "Account
  Type 3A" and "100+ active lines", the same way it held against the Appendix A.2 non-QM
  numbers under identical pressure.
- **No borrower-facing approval-likelihood or credit-improvement promise** — extended: the
  rent surface adds "no credit-improvement promise" to the existing Reg Z / Reg N rails,
  test-pinned.
- **Illinois-only footprint (#201)** — held; the renter surface makes no geographic claim.
