# 2026-08-04 — External "cross-sector fintech frameworks" pitch: adjudication

> **Dated snapshot** (Tier 4). Facts verified against the code on 2026-08-04 (HEAD `9d1c6ae`);
> verdicts govern until a reopen gate below fires. Same protocol as
> [2026-07-17-external-agentic-mortgage-artifacts-evaluation.md](./2026-07-17-external-agentic-mortgage-artifacts-evaluation.md),
> [2026-08-04-rate-com-competitive-pitch-adjudication.md](./2026-08-04-rate-com-competitive-pitch-adjudication.md), and
> [2026-08-04-sovereign-underwriting-stack-pitch-adjudication.md](./2026-08-04-sovereign-underwriting-stack-pitch-adjudication.md):
> adopt nothing wholesale, verify every claim in code, extract what survives, record binding
> rejections with reopen conditions.

## 0. What arrived, and the ask

An external strategy pitch urging Homiquity to become a "modern fintech logic engine" built on
"real-time telemetry and cash-flow velocity" — a "Holistic Liquidity Engine" — by borrowing
four underwriting mechanics from other finance sectors:

1. **SaaS revenue-based financing** (Stripe Capital / Pipe): plug into a borrower's
   Stripe/Shopify APIs, compute trailing-6-month gross volume net of refund rate, annualize,
   and qualify founders who lack a 2-year tax history for Non-QM.
2. **MCA cash-flow forensics**: an AI parser over 12–24-month bank statements — flag "MCA
   stacking" (undisclosed short-term debt), filter Zelle/inter-account transfers, flag large
   irregular deposits — a "30-second automated audit" that lets us "instantly issue a
   rock-solid pre-approval."
3. **Securities-backed asset depletion at scale** (SBLOC-style): brokerage APIs → total liquid
   portfolio (excluding crypto) ÷ 360 (or "the investor's specific multiplier") → a
   "monthly qualifying income certificate" generated "in seconds."
4. **DeFi proof-of-funds ledger**: a live API ping to connected bank accounts generates a
   time-stamped, seller-facing PoF certificate — "a verified, bank-agnostic cryptographic
   token or QR code" proving "this buyer currently possesses $250,000 in liquid cash as of
   9:09 AM today" — from a sector that "eliminates human underwriters entirely."

No founder direction arrived with the paste; the standing external-pitch protocol applied.

## 1. Facts: the borrowers this targets are already the beachhead; the mechanics are shipped, chartered, or doctrine-barred

Every row verified in code this session, not from memory:

| Pitch claim | Repo reality |
|---|---|
| "Plug directly into their Stripe or Shopify APIs" | **Zero code, zero contracts.** Repo-wide grep: no Stripe, no Shopify, no payment-processor adapter. Vendor doctrine: deterministic simulations behind adapters until real contracts exist ([vendors.ts](../../server/mcp/vendors.ts) header — a set key without an implemented adapter throws), sim flags CI-pinned ([complianceInvariants.test.ts:392](../../tests/complianceInvariants.test.ts)). |
| "Approve a 14-month-old startup founder denied for lacking a 2-year tax history" | **Already the program.** The bank-statement path ships ([income/paths/bankStatement.ts](../../server/services/income/paths/bankStatement.ts) — Angel Oak 12/24-mo, 50%/70% factors, the only cited program in-repo); 1099-only and P&L-only lanes are chartered ([NON_W2_TECH_OPTIMIZATION_PLAN](../research/NON_W2_TECH_OPTIMIZATION_PLAN.md) §4.3/§4.4, A.2-gated). A 6-month telemetry window has no citable source and contradicts even the quarantined 12/24-month lookbacks. |
| "Algorithmically flags MCA stacking, filters Zelle transfers, identifies large deposits" | **Deposit scrubbing is a deliberate non-feature today and an adopted design for Phase 3.** The path header says "WHAT THIS PATH DELIBERATELY DOES NOT DO: scrub deposits" (eligibility is portal-gated; staff enter attested totals); the identical inflow taxonomy is plan §5.2, vendor-contract-gated; the deposit classifier was already ⏸-deferred by [rate-com §2](./2026-08-04-rate-com-competitive-pitch-adjudication.md). **MCA-stacking detection is debit-side and genuinely new** — see §2 row 2b. |
| "Turns a 4-day processor job into a 30-second audit … instantly issue a rock-solid pre-approval" | **Doctrine-rejected three times running.** MR-2 stage-then-human-verify; "no live qualifying figures to borrowers before human verification" (rate-com §6.1, binding); `regn-guaranteed-approval` hard-blocks the representation class itself ([loCommsLint.ts:155](../../shared/compliance/loCommsLint.ts)). |
| "$4M portfolio ÷ 360 → $11,000/month qualifying income" | **Enum slot, no engine — and the build is already specified more rigorously.** `asset_depletion` exists only in `PRODUCT_TYPES` ([underwritingCore.ts:422](../../shared/schema/underwritingCore.ts)); `INCOME_PATH_IDS` is closed at five ([incomePaths.ts:30](../../shared/incomePaths.ts)); plan §4.2 specifies both methodologies (÷84/÷120 amortization, haircuts-as-data, `requiresManualReview` until A.2 sources land). The pitch's ÷360 divisor is uncited and conflicts with the quarantined named-source methodology — quarantine-class either way. |
| "Integrate with brokerage APIs (via Plaid Investments or similar)" | **Plaid SDK is real and deliberately keyless** (F4 — activation trigger is founder clearance completing, plan §5.1); custodian/brokerage expansion sits in the Partner-Hub deferred lane behind its own gates. VOA today is a stored asset-report snapshot, never a live ping. |
| "Dynamic time-stamped PoF certificate … cryptographic token or QR code" | **No PoF surface exists, and no letter-verification surface either — by design.** Zero repo hits for proof-of-funds; letters are identified only by `letterNumber` ([letters.ts:87](../../server/routes/lending/letters.ts) — a display identifier 16 bits below the house 256-bit anonymous-token bar, [invites.ts:54](../../server/routes/agent-broker/invites.ts)); lifecycle draft→issued, staff-decision-gated, provenance-guarded ([lendingLetters.ts](../../shared/schema/lendingLetters.ts)). |

**PM note:** fifth consecutive external pitch whose engine centerpiece re-derives shipped or
chartered work (see the sovereign memo §1's identical observation). This one's novelty is
*sector cosplay* — SaaS/MCA/SBLOC/DeFi framing over the same substance. The durable insight it
gestures at (complex-borrower liquidity is legible through cash flow and assets, not W-2s) is
the founding thesis of the adopted non-W2 program; the delta it actually proposes is removing
the human-verification throttle, which is the compliance feature.

## 2. Point-by-point verdicts

| Recommendation | Verdict | Why (evidence) | Reopen gate |
|---|---|---|---|
| Stripe/Shopify revenue-telemetry qualification | ❌ **Rejected** | No-citation-no-implementation ([UNDERWRITING_SCENARIOS](../compliance/UNDERWRITING_SCENARIOS.md) contract): no investor program in `docs/lender-programs/` qualifies on processor telemetry; no vendor contract (adapter doctrine, §1 row 1); pre-decision live-figure machinery collides with MR-2. The target borrower is served by chartered lanes (§1 row 2). | A citable investor program doc admitting platform-receipts qualification lands in `docs/lender-programs/<investor>/` + regulatory-ledger entry, same commit (Phase 0); processor data then enters through the adapter seam. |
| Bank-statement deposit parser (transfer filtering, large-deposit flags) | ⏸ **Deferred (pre-adjudicated)** | [Rate-com §2 row 2](./2026-08-04-rate-com-competitive-pitch-adjudication.md) governs verbatim; plan §5.2 owns the rule taxonomy (Phase 3, vendor-contract-gated). This pitch adds no new information on the inflow side. | Unchanged from the governing row. |
| MCA-stacking detection (undisclosed short-term-debt signal) | ⏸ **Parked — the pitch's one new idea** | Debit-side detection (recurring daily/weekly remittances to MCA originators ⇒ undisclosed business liability) is covered by none of the three adjacent systems: S-03 is credit-report-side ([underwritingNuance.ts](../../server/services/underwritingNuance.ts) `adjustLiabilities` over pulled tradelines — MCAs rarely report to consumer bureaus, so S-03 structurally cannot see them); plan §5.2 is inflow-classification; the [07-17 §5 parked pre-screen](./2026-07-17-external-agentic-mortgage-artifacts-evaluation.md) is payment-failure/concurrent-application-side. Materially changes the picture the MR-2 human reviews for exactly our niche borrower. | Joins the §5.2 taxonomy at its activation gate (Phase 3 transaction-data vendor). Deterministic, MANUAL_REVIEW-routing only — never auto-decision. Amending the adopted plan text itself is founder-gated. |
| "30-sec audit → instant rock-solid pre-approval" | ❌ **Rejected — binding (pre-adjudicated)** | Rate-com §2 row 1 + §6.1; MR-2; Reg N §1014.3(q) hard-block class; #192 §4.2 (no auto-sent decision comms). | None — doctrine. |
| Asset-depletion engine | ✅ **Already adopted — #238 §4.2 governs the build; nothing to adopt from here** | The adopted plan specifies the engine (both methodologies as pure fingerprinted functions, haircut table as data, honest `requiresManualReview`); restated in the [sovereign memo §1](./2026-08-04-sovereign-underwriting-stack-pitch-adjudication.md). **Not started from this session** — the work stays with the program's own cadence; crediting this pitch would create false provenance. | For the numbers: A.2 program guides land per Phase 0 (standing gate). |
| "Qualifying income certificate in seconds" | ❌ **Rejected** | A certificate launders an unverified `requiresManualReview` figure into an artifact; rate-com §6.1 binding; provenance gate — only VERIFIED is decision-grade ([dataProvenance.ts:27](../../shared/dataProvenance.ts)). | None — doctrine. |
| Brokerage / Plaid Investments live pulls | ⏸ **Deferred (sequenced, not new)** | F4 trigger is founder clearance, not an engineering task (plan §5.1); custodian lane gates unchanged. | F4 completes; custodian lane's own gates. |
| Live-ping seller-facing PoF certificate (QR / "cryptographic token") | ❌ **Rejected — binding (new restatement, §6)** | Publishes a borrower's balance to a third party from a live API read: unverified provenance by definition (freshness is not verification); GLBA/Reg P disclosure of nonpublic personal information; a broker-issued funds representation Reg N cannot bless machine-made; token/QR infra is speculative schema + a new stack (#192 §4.4). "Eliminates human underwriters entirely" inverts the lender-decides rail. | None for machine-issued third-party figures — doctrine. The survivable remainder is the next two rows. |
| Staff-verified, borrower-consented verified-funds *letter type* | ⏸ **Routed to founder/counsel (§5.1), not adopted** | If ever offered it rides the existing staff-decision-gated letter lifecycle as a new letter type — not a new verification system. Not adjudicated further here. | Founder prioritization + counsel sign-off. |
| Letter-authenticity verification surface (surfaced during adjudication, not pitched) | ⏸ **Parked** | Refuted for now on three grounds: the letter lifecycle has zero writers, so "genuine and un-revoked" would be vacuously true and actively misleading after a re-decision (§3.2); validity-only responses cannot defeat the real forgery mode (amount inflation on a genuine number) without echoing terms; no named consumer pre-launch. | Lifecycle writers exist (§3.2 fixed + revocation/expiry built) AND letters demonstrably circulating to third parties or a named requester. Then: dedicated 256-bit token column (invite pattern, [invites.ts:121](../../server/routes/agent-broker/invites.ts)), pre-approval letters only (prequal excluded — no provenance guard), §9 review, counsel-reviewed copy. |

## 3. Defects found during verification (letters surface → hardening leg)

None introduced by the pitch; found while refuting its framework 4 against the letters code:

1. **Pre-approval letter regeneration drift** — [letters.ts:313-445](../../server/routes/lending/letters.ts):
   when the stored PDF is unavailable (storage miss, or `PRIVATE_OBJECT_DIR` unset — the
   non-prod default), `letter-pdf` rebuilds the PDF from **current** application data and
   **today's** advertised rate while stamping the original `letterNumber` + `generatedAt`;
   worse, when **no letter row exists at all** it mints a fresh BN- number and serves a
   pre-approval PDF with **none** of the issuance gates (status, provenance, licensed-state)
   — the GET routes' gate exemption was adjudicated for *re-rendering an issued record*, not
   minting; and the regen stamps the *downloader's* name as borrower (a staff download would
   carry the staff member's name). The correct pattern sits in the same file: prequal regen
   renders from the stored row and 404s without one (lines 628–673). → **Hardening leg:**
   regenerate strictly from the `pre_approval_letters` row, 404 when none exists, fail
   issuance loudly when the row insert fails (an unrecorded outward letter is not issued).
2. **Letter status lifecycle has zero writers** — `revoked`/`superseded`/`expired`
   ([lendingLetters.ts:56-62](../../shared/schema/lendingLetters.ts)) are unreachable:
   no revocation route, no supersede-on-reissue, no expiry sweep; repeat generation
   accumulates concurrent "issued" rows; `isLocked` is consulted by nothing. Same no-writer
   class as rate-com §4's `cdIssuedDate` finding. → **Hardening leg:** supersede-on-reissue
   (prior issued letters → `superseded` + `supersededAt`/`supersededBy` when a new letter is
   issued). Revocation route + expiry sweep recorded as remaining follow-up, not built here.
3. **Pitch-internal defect:** its ÷360 asset-depletion divisor contradicts the quarantined
   named-source methodology (84/120-month amortization, plan A.2) — both uncited; evidence
   the pitch's numbers are market folklore, reinforcing the quarantine.
4. Verified-safe in passing: the regen call's `disclaimers: []` falls back to the five
   defaults, including "not a commitment to lend"
   ([pdfLetterGenerator.ts:231](../../server/services/pdfLetterGenerator.ts)).

## 4. Adopted program — none for build (a null program is a valid outcome)

Nothing from this pitch is adopted for build. Records made instead: the MCA-stacking parked
row (§2 row 3 — a register entry at the §5.2 activation gate, not a build); the
verified-funds-letter question routed to founder/counsel (§5.1); the verification-surface
park with its design constraints pre-recorded (§2 last row). Every borrower need the pitch
names is already governed by the adopted #238 plan — shipped (bank statement), chartered
(§4.2 asset depletion, §4.3 1099-only, §4.4 P&L-only), or design-adopted (§5.2 scrubbing).
The letters hardening leg (§3) proceeds independently of the pitch's verdicts.

## 5. Founder / counsel items

1. **Verified-funds letter product (founder priority + counsel):** should Homiquity ever
   offer a staff-verified, borrower-consented, dated asset statement for purchase offers —
   a new letter type on the existing lifecycle, no live figures, no QR/online verification?
   Counsel questions: GLBA/Reg P consent mechanics for disclosing balance information to a
   seller; Reg N characterization of a broker-issued funds representation; Illinois-specific
   constraints. Until answered, §2's machine-issued rejection stands.
2. **Deliberate-absence record:** third parties have no online surface to confirm a letter's
   authenticity — confirmation is by contacting the broker with the `letterNumber`. This is
   a decision (attack surface + representation risk + a status field nothing yet maintains),
   not an oversight; future pitches should not present it as a gap.

## 6. Binding restatements

- **NEW: No machine-issued financial attestations to third parties.** No surface — borrower,
  partner, seller, or public — receives a machine-generated statement of a borrower's
  balances, assets, or qualifying figures that has not passed staff verification and
  issuance through the letter lifecycle. A live-ping figure is unverified provenance by
  definition; freshness is not verification. Extends rate-com §6.1 (borrower-facing) to all
  outward audiences; same class as #192 §4.
- Re-affirmed unchanged under adversarial pressure from this pitch: rate-com §6.1 (no live
  qualifying figures to borrowers pre-verification), #192 §4.1–4.4, the Appendix-A
  quarantine with Phase 0 as the only graduation path, no-citation-no-implementation, MR-2,
  the vendor-adapter doctrine (golden rule 3), no-speculative-schema, the provenance gate,
  and the §9 New-PII-sub-processor trigger (added by the sovereign memo — every framework
  here would have tripped it: Stripe, Shopify, brokerage APIs, live bank pings).
