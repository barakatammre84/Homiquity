# Compliance Counsel Review Package — Adverse Action, APR & TRID

**Prepared for:** compliance counsel / Principal Compliance Officer
**Prepared by:** engineering (drafted, pending legal ratification)
**Subject:** the compliance-hardening changes on branch `claude/bold-jang-224c91` (PR #2)
**Status:** code complete and tested; **must not be relied on in production until the items below are ratified.**

This package exists because several items in the hardening work are legal
determinations or fixed regulatory text that engineering can draft but **cannot
sign off on**. Each section states what was built, what is assumed, and the
specific question for counsel.

---

## 0. Operational prerequisite (not a legal item)

The TRID trigger adds one nullable column, `loan_applications.trid_triggered_at`.
The project uses `drizzle-kit push` (no migration history; see [ROLLBACK.md](../ROLLBACK.md)).
It was applied and smoke-tested on the **dev** database only. **Production requires
`npm run db:push` against `PROD_DATABASE_URL` at deploy.** The change is additive
and nullable, so it is safe to leave in place across a code rollback.

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

Generated in `creditService.ts` (`generateAdverseActionNotice`). The notice now
contains **both** required blocks:

- **FCRA §615(a)** — statement that the decision used a consumer report; the
  reporting agency's name/address/phone/website; that the agency did not make
  the decision; the right to a free report within 60 days; the right to dispute;
  and the credit score used with its 300–850 range.
- **ECOA/Reg B §1002.9(b)(1)** *(newly added)* — the equal-credit-opportunity
  anti-discrimination statement; the creditor's identity (`COMPANY_CONFIG`); and
  the administering federal agency.

**For counsel — these were drafted by engineering and need ratification:**
1. **Administering agency.** Defaulted to the CFPB
   (`ECOA_ADMINISTERING_AGENCY` in `creditService.ts`). Confirm CFPB vs. FTC and
   the exact address per **Reg B Appendix A** for this entity.
2. **Creditor mailing address.** `COMPANY_CONFIG` has no postal address; the
   notice currently shows name + NMLS + email/phone only. ECOA requires the
   creditor's **name and address** — a mailing address must be added to
   `server/config/company.ts` before production.
3. **NMLS # is `"PENDING"`** in `COMPANY_CONFIG` — must be the real number before
   any notice is issued.
4. **FCRA §615(a) credit-score disclosure completeness.** The notice includes the
   score and range but **not** the date the score was created or the name of the
   score provider, both of which §615(a) requires. Confirm and, if required,
   engineering will add them (the data exists on the credit pull).
5. **Phone/email in `COMPANY_CONFIG` are placeholders** (`(555) 123-4567`) — must
   be real.

---

## 3. Notice delivery, timing & retention

**Built:** the notice **record** is now generated synchronously and atomically
with the denial — a denial cannot be applied unless the notice is created
(`ensureAdverseActionForDenial`, enforced on **both** denial routes). The
borrower-facing email is deliberately decision-neutral and points to the account.

**Gaps for counsel to confirm are handled operationally:**
1. **Delivery.** Generating the record is not delivery. `markAdverseActionDelivered`
   exists but confirm the notice is actually **delivered** to the applicant
   (in-app + mail/email) and that delivery is logged.
2. **Timing.** ECOA requires notice within **30 days** (§1002.9(a)(1)). Confirm the
   delivery step meets this; generation-at-denial supports it but does not
   guarantee delivery.
3. **Retention.** Reg B §1002.12(b) requires retention for **25 months**. Confirm
   the `adverse_actions` records meet the retention policy.

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

## Counsel checklist

- [ ] §1 — reason descriptions acceptable; "Other" specificity; incompleteness vs. denial
- [ ] §2.1 — administering agency (CFPB vs. FTC) + address
- [ ] §2.2 — creditor mailing address added to config
- [ ] §2.3 — real NMLS #
- [ ] §2.4 — score-disclosure completeness (provider + date)
- [ ] §2.5 — real creditor phone/email
- [ ] §3 — delivery, 30-day timing, 25-month retention confirmed
- [ ] §4 — representative fees match actual charges; assumption disclosures adequate
- [ ] §5 — six-piece definition and ESIGN consent confirmed
- [ ] §0 — `db:push` run against production at deploy
