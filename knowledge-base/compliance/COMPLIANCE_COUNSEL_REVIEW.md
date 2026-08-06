# Compliance Counsel Review Package — Adverse Action, APR & TRID

**Prepared for:** compliance counsel / Principal Compliance Officer
**Prepared by:** engineering (drafted, pending legal ratification)
**Subject:** the compliance-hardening changes on branch `claude/bold-jang-224c91` (PR #2)
**Status:** code complete and tested; **must not be relied on in production until the items below are ratified.**

> **Freshness (2026-07-08):** a dated counsel-review package from the PR #2 hardening era. The
> engineering it describes (adverse-action mapping, the Reg Z APR solver, the TRID clock) has
> since **shipped and evolved on `main`** — for implementation state trust the current code plus
> [CTO_ROADMAP.md](../../CTO_ROADMAP.md) (#26, #34) and [ASSUMPTIONS.md](../governance/ASSUMPTIONS.md).
> What remains genuinely open is the **legal ratification** of the questions below (a
> counsel/founder action), not the code.
>
> **2026-08-06 re-check:** two of the open questions below — the creditor mailing address (§2)
> and the NMLS number (§3) — are **closed in code** and struck through. What remains genuinely
> open for counsel: the **ECOA administering agency** (§1), and **FCRA §615(a) score-disclosure
> completeness** (§4, blocked on the live bureau integration — roadmap F3).

This package exists because several items in the hardening work are legal
determinations or fixed regulatory text that engineering can draft but **cannot
sign off on**. Each section states what was built, what is assumed, and the
specific question for counsel.

---

## 0. Operational prerequisite (not a legal item)

The TRID trigger adds one nullable column, `loan_applications.trid_triggered_at`.
The project uses **versioned, hand-authored SQL migrations** (`migrations/`, applied with
`pnpm db:migrate` locally — **never `db:push`**; see [kb/app-guide/03-database.md](../handbook/app-guide/03-database.md)).
✅ **Resolved 2026-07-19:** the column ships in `migrations/0027_reconcile_dbpush_drift.sql`
and is applied to production — prod's migration HEAD has since advanced well past it (0037 as
of 2026-07-17). Prod migrations now **auto-apply on merge** via the `migrate-prod` CI job
([DB_MIGRATIONS.md](../runbooks/DB_MIGRATIONS.md)); the founder-supervised manual-apply lane
this section used to prescribe is retired. The change is additive and nullable, so it is safe
to leave in place across a code rollback.

---

## 1. Adverse-action reason mapping (ECOA/Reg B §1002.9)

Denials now auto-generate an adverse-action notice. The staff UI collects HMDA
LAR denial-reason labels; these are mapped to Reg B reason descriptions in
`server/services/creditService.ts` (`HMDA_TO_ADVERSE_ACTION_REASON` +
`ADVERSE_ACTION_REASONS`).

| HMDA label (staff UI) | Reg B reason key | Notice text (verbatim) |
|---|---|---|
| Debt-to-income ratio | `dti_high` | "Debt-to-income ratio exceeds maximum threshold" |
| Employment history | `employment_history` | "Employment history does not meet requirements (length, stability, or type of employment)" |
| Credit history | `insufficient_credit_history` | "Insufficient credit history to evaluate" |
| Collateral | `collateral_insufficient` | "Value or type of collateral is not sufficient for the requested loan" |
| Insufficient cash (downpayment, closing costs) | `insufficient_funds_to_close` | "Insufficient funds for down payment and/or closing costs" |
| Unverifiable information | `unverifiable_information` | "Unable to verify information provided on the application (income, employment, residence, or credit references)" |
| Credit application incomplete | `application_incomplete` | "Credit application is incomplete" |
| Mortgage insurance denied | `mortgage_insurance_denied` | "Mortgage insurance could not be obtained for the requested loan" |
| Other | `other_credit_decision_factors` | "Other factors related to the credit decision (details available on request)" |

**For counsel:**
1. Confirm each reason description is acceptable Reg B language and adequately
   specific (§1002.9(b)(2) requires the *specific* principal reasons — "Other …
   details available on request" is the weakest; confirm it is acceptable or
   should be replaced with enumerated sub-reasons).
2. Confirm that "Credit application incomplete" should, in some cases, be handled
   as a **notice of incompleteness** (§1002.9(c)) rather than a denial.

---

## 2. Adverse-action notice content

Generated in `creditService.ts` (`generateAdverseActionNotice`). The notice is
now **conditional on whether the action was based on a consumer report**:

- **ECOA/Reg B §1002.9(b)(1)** — **always** included: the equal-credit-opportunity
  anti-discrimination statement; the creditor's identity (`COMPANY_CONFIG`); and
  the administering federal agency.
- **FCRA §615(a)** — included **only when a bureau score source was used**
  (`basedOnConsumerReport`): the consumer-report basis statement, the reporting
  agency's name/address/phone/website, the free-report and dispute rights, and
  the score with its 300–850 range. On a denial made from self-reported data
  (the current auto-generated path passes no bureau source), these blocks are
  correctly omitted and the notice does **not** claim a consumer report was used.
  *(This fixed a prior defect where the notice unconditionally asserted a
  consumer report and defaulted the bureau to Experian.)*

**For counsel — these were drafted by engineering and need ratification:**
1. **Administering agency.** Defaulted to the CFPB
   (`ECOA_ADMINISTERING_AGENCY` in `creditService.ts`). Confirm CFPB vs. FTC and
   the exact address per **Reg B Appendix A** for this entity.
2. ~~**Creditor mailing address.**~~ ✅ **CLOSED 2026-08-06.** `shared/companyIdentity.ts`
   carries a structured `mailingAddress` (7372 W. 87th St, Bridgeview, IL 60455), rendered
   into the Reg B §1002.9(b)(1) creditor block. **No counsel action required.**
3. ~~**NMLS # is `"PENDING"`**~~ ✅ **CLOSED 2026-07-13.** `shared/companyIdentity.ts`
   carries **NMLS #427468** (PR #154), rendered site-wide by `companyNmlsDisplay()`, which
   deliberately returns null (and renders nothing) rather than a placeholder. Illinois license
   **#3423789** is in `LICENSED_STATE_DETAILS`. **No counsel action required.**
4. **FCRA §615(a) score-disclosure completeness — BLOCKED on the live bureau
   integration.** When a report *is* used, §615(a) also requires the **date the
   score was created**, the **name of the score provider**, and the model-derived
   **key factors**. These are **not captured** in `credit_pulls` (no score-date,
   score-model, or key-factors columns) because the bureau vendors are currently
   **simulated** (no live response to populate them). This cannot be completed as
   a text change — it requires the live credit-bureau integration plus new
   schema/ingestion. Tracked as a dependency, not a drafting item.
5. **Phone/email in `COMPANY_CONFIG` are placeholders** (`(555) 123-4567`) — must
   be real.
6. **Conditionality policy.** Confirm that treating denials without a bureau
   source as "not based on a consumer report" is correct for this business — i.e.
   that a hard credit pull is not always part of the decision. If a report is in
   fact always pulled, the flow should pass `creditScoreSource` so the FCRA
   content is included.

---

## 3. Notice delivery, timing & retention

**Built:** the notice **record** is now generated synchronously and atomically
with the denial — a denial cannot be applied unless the notice is created
(`ensureAdverseActionForDenial`, enforced on **both** denial routes). The
borrower-facing email is deliberately decision-neutral and points to the account.

**Precise current state (so the gap is unambiguous):**
- Delivery is **manual and staff-triggered** only — `markAdverseActionDelivered`
  is called solely by `POST /api/credit/adverse-action/:actionId/deliver`. Nothing
  marks a notice delivered automatically when it is generated.
- The borrower **can** retrieve their own notice via
  `GET /api/loan-applications/:id/credit/adverse-actions` (owner access), but there
  is **no borrower UI** surfacing it today.
- Borrower notification of the denial differs by path: the **status** route sends
  a neutral notification + email; the **advance-stage** pipeline route currently
  sends **neither**. (The adverse-action *record* is generated on both.)

**Decisions required — these are legal/ops calls, not clean code fixes:**
1. **Delivery method & auto-marking.** What constitutes valid ECOA delivery here
   (mail vs. electronic), and whether in-app availability + ESIGN consent suffices.
   Engineering deliberately did **not** auto-mark notices "delivered" — doing so
   without a ratified delivery method would create a false compliance record.
   Once the method is decided, engineering will wire automatic delivery + a
   consistent borrower notification on **both** denial paths.
2. **Timing.** ECOA requires notice within **30 days** (§1002.9(a)(1)).
3. **Retention.** Reg B §1002.12(b) requires **25 months**; confirm the
   `adverse_actions` retention policy.

---

## 4. Advertised-rate & APR representations (TILA / Reg Z §1026.22, §1026.24)

**Built:** all displayed APRs (rate pages, landing page, Loan Estimate) now come
from an actuarial APR solver (`server/services/apr.ts`), validated against
analytic cases, the Appendix J present-value identity, and an independent
Newton-Raphson solver (`tests/aprValidation.test.ts`). The engine reports APR to
3 decimals — tighter than the §1026.22 ⅛-point tolerance.

Advertised APRs use a **representative fee model** (`estimatePrepaidFinanceCharges`):
1% origination, $500 application, $1,500 underwriting, $100 tax service, ~15 days
prepaid interest, plus FHA up-front MIP where applicable.

**For counsel:**
1. Confirm the representative fee assumptions are ones the company **actually
   charges** — an advertised APR built on fees a borrower would not incur is a
   §1026.24 problem.
2. Confirm the on-page assumption disclosures (loan amount, down payment, credit
   score, "not a commitment to lend") on the rate cards satisfy §1026.24(c)/(d).
3. Confirm the ARM "rate and payment can increase" disclosure is sufficient.

---

## 5. TRID application trigger & Loan Estimate timing (Reg Z §1026.2(a)(3), §1026.19)

**Built:** the LE clock now starts when all six pieces of information are on file
(`server/services/trid.ts`), computed in business days, with a hard stop that
blocks forward movement of a file whose LE is overdue.

**For counsel:**
1. Confirm the six-piece definition as implemented (name, income, SSN, property
   address, estimated value, loan amount). **Note:** "name" is treated as
   satisfied once the account exists (supplied at signup); this deliberately
   errs toward starting the clock *earlier*, never later — confirm acceptable.
2. **ESIGN.** First borrower retrieval of the LE (behind the `e_disclosure`
   consent) is treated as electronic delivery and stamps `leIssuedDate`. Confirm
   the existing `e_disclosure` consent captures the ESIGN requirements (right to
   withdraw, hardware/software requirements, etc.).

---

## 6. Change of circumstance → revised Loan Estimate (Reg Z §1026.19(e)(3)(iv), §1026.19(e)(4)) — added 2026-07-12

**Built:** staff record a changed circumstance from the six-reason catalog
(`shared/compliance/changeOfCircumstance.ts`, §1026.19(e)(3)(iv)(A)–(F)); the server computes the
revised-LE due date as 3 business days from receipt of the establishing information
(§1026.19(e)(4)(i), `server/services/changeOfCircumstance.ts`); an open record past its deadline
blocks wholesale submission (broker readiness stage 1); the borrower's next retrieval of the
regenerated LE stamps delivery (same ESIGN mechanism as §5.2).

**Deliberately not built:** fee-tolerance / good-faith cure math. Every recorded change carries a
manual-review posture — no automated tolerance-baseline reset or charge comparison.

**For counsel:**
1. Confirm the manual-review posture for tolerance analysis is acceptable pre-launch, and what
   tooling (if any) counsel wants before volume.
2. Confirm treating the borrower's retrieval of the *regenerated* LE as the §1026.19(e)(4)
   "provision" of the revised estimate (electronic delivery under the existing `e_disclosure`
   consent), given the LE is always generated from current file data.
3. §1026.19(e)(4)(ii) (revised LE no later than 4 business days before consummation; CD interplay)
   is treated as the wholesale lender's closing-side obligation and is not enforced pre-submission —
   confirm for the broker model.

---

## Counsel checklist

- [ ] §1 — reason descriptions acceptable; "Other" specificity; incompleteness vs. denial
- [ ] §2.1 — administering agency (CFPB vs. FTC) + address
- [ ] §2.2 — creditor mailing address added to config
- [ ] §2.3 — real NMLS #
- [ ] §2.4 — score-disclosure completeness (provider/date/factors) — **blocked on live bureau integration**
- [ ] §2.5 — real creditor phone/email
- [ ] §2.6 — conditionality policy: is a hard credit pull always part of the decision?
- [ ] §3 — delivery, 30-day timing, 25-month retention confirmed
- [ ] §4 — representative fees match actual charges; assumption disclosures adequate
- [ ] §5 — six-piece definition and ESIGN consent confirmed
- [x] §0 — the `trid_triggered_at` migration applied to production *(resolved 2026-07-19: ships in `0027_reconcile_dbpush_drift.sql`, auto-applied by the `migrate-prod` pipeline — see §0)*
- [ ] §6 — COC manual-tolerance posture, regenerated-LE delivery treatment, and the (e)(4)(ii) closing-side boundary confirmed (added 2026-07-12)
