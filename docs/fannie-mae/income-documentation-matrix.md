# Income documentation matrix — Fannie Mae Selling Guide reference

**What this is.** One row per value of `INCOME_TYPES` (`shared/schema/underwritingTasks.ts`),
giving the documents the Selling Guide requires for that income source, the minimum history, and
the continuance rule. It is the authority behind `INCOME_SOURCE_RULES` in
`server/pipelineEngine.ts`, and `tests/incomeSourceRequirements.test.ts` asserts that every
requirement the engine emits carries a `guidelineRef` that appears verbatim in this file.

**Source.** The *Selling Guide* published **August 5, 2026**, read as page-marked text. Every
citation below is `section (effective date), p.N` where N is the PDF page in that corpus, so any
claim here is re-checkable with `grep` rather than a live fetch that drifts silently.

⚠️ **The corpus is not on `main` yet.** `docs/fannie-mae/selling-guide/`
(`Selling-Guide_08-05-2026.pdf`, `selling-guide-text.txt`, `section-index.tsv`) lands with
**PR #650, "Seat the Selling Guide as source of truth"**, which is open at the time of writing.
Every page number here was read against that corpus on its branch. Until #650 merges, the page
cites resolve only there; the **section numbers and effective dates stand on their own** and were
independently corroborated against the live Guide the same day. If #650 is abandoned rather than
merged, this file needs a different anchor — say so here rather than leaving a citation that
points at nothing.

Reproduction here is under the Guide's own grant of limited permission to reproduce parts of the
publication to "mortgage finance professionals, strictly for their own use in originating
mortgages" (copyright notice, p.2). Same practice as
[`self-employment-income-reference.md`](./self-employment-income-reference.md).

## Document hierarchy

The **Selling Guide** controls. Where a job aid, an announcement summary, or anything in this
directory disagrees with the Guide, the Guide wins. Where a wholesale lender's overlay is stricter,
the overlay wins **for that lender only** and never loosens what is below. Discrepancies escalate;
they are not resolved by picking a side.

## ⚠️ Section-numbering trap

Fannie's **URL slugs carry old section numbers while the page bodies carry new ones**.
`…/b3-3.2-01/…` serves *B3-3.5-01*; `…/b3-3.1-09/…` serves *Section B3-3.4*; `…/b3-3.1-08/…`
serves *Section B3-3.8*. **Cite the section number printed in the body, never the one in the URL.**
The corpus in `selling-guide/` is the safe way to read this — its `section-index.tsv` carries the
body's own numbering. See also the narrower correction already recorded in
`self-employment-income-reference.md`.

## 🚨 Alimony and child support are opt-in — Reg B

> "The lender may include alimony, child support, equalization payments, or separate maintenance as
> income **only if the borrower discloses it on the Uniform Residential Loan Application and
> requests that it be considered** in qualifying for the loan."
> — B3-3.4-02 (03/04/2026), p.353

This is a hard branch in the derivation, not a preference. ECOA/Reg B bars requiring disclosure of
alimony or child support unless the applicant wants it counted, so a document requirement for these
types may fire **only** from the borrower's own URLA election — **never** from an inferred signal
(a document-derived flag, a bank-statement pattern, a liability that looks like support). Generating
a decree request off inference would be a compliance problem, not merely an unwelcome ask.

`INCOME_SOURCE_RULES` marks these types opt-in via `OPT_IN_INCOME_TYPES`, and
`tests/incomeSourceRequirements.test.ts` pins both directions: inferred ⇒ nothing emitted;
elected ⇒ the full set.

## Cross-cutting rules

- **DU may supersede.** Nearly every section below carries: if the income is validated by the DU
  validation service, DU issues a message stating the required documentation, and *that* documentation
  may differ from the table. See B3-2-02, DU Validation Service. Day-1-Certainty relief flags are
  already ingested in `server/services/autopilot/ausFollowUps.ts` — the static set is a floor DU can
  replace, not a ceiling.
- **Verbal VOE** is required for employment-related income — B3-3.1-04 (03/04/2026), p.325.
- **Age of documents** — B1-1-03, Allowable Age of Credit Documents and Federal Income Tax Returns.
- **Tax returns and transcripts** — B3-3.1-02 (06/03/2026), p.321.

## The matrix

| `INCOME_TYPES` | Section (eff. date), page | Documents required | Minimum history | Continuance |
|---|---|---|---|---|
| `w2` | **B3-3.2-01** (03/04/2026) p.328 · **B3-3.3-01** (03/04/2026) p.334 | A completed *Request for Verification of Employment* (**Form 1005**), **or** the most recent paystub **and** most recent W-2. Plus a verbal VOE.<br>Paystub: most recent, **dated no earlier than 30 days prior to the initial loan application date**, including **all year-to-date earnings**.<br>W-2: covering the most recent **one- or two-year** period; "most recent" = the W-2 for the calendar year prior to the current calendar year.<br>Acceptable alternatives: IRS Wage and Income (W-2) Transcript, Form 1005, or the final year-to-date paystub. | Fixed base: **none required**. Variable base: **12 months**. | Not verified unless there is reason to believe the income may not continue. |
| `bonus`, `commission`, `overtime` | **B3-3.3-02** (03/04/2026) p.336 | Form 1005, **or** the most recent paystub **and two years' W-2s**. Plus a verbal VOE.<br>Tip income **not reported by the employer**: two years' personal tax returns with **IRS Form 4137** may be provided in lieu of a W-2. | **2 years recommended**; not less than **12 months** acceptable with positive factors reasonably offsetting the shorter history. | Not verified unless there is reason to believe the income may not continue. |
| `self_employed` | **B3-3.5** series · VVOE at **B3-3.2-01** p.330 | See [`self-employment-income-reference.md`](./self-employment-income-reference.md) — returns, K-1s, business returns by entity type.<br>Business existence must be verified **within 120 calendar days prior to the note date**, from a third party (CPA, regulatory agency, licensing bureau) or by verifying a phone listing and address; the source and the name and title of the lender employee who obtained it must be documented. | See reference. | See reference. |
| `rental` | **B3-3.8-01** (10/08/2025) p.407 | See [`rental-income-reference.md`](./rental-income-reference.md) — Schedule E, lease agreements, Form 1007 / Form 1025. | See reference. | See reference. |
| `social_security` | **B3-3.4-15** (03/04/2026) p.372 | Evidence of regular receipt, varying by benefit type and whose record it is.<br>**Own account/work record** (retirement or disability): SSA Award letter · SSA-1099 · most recent signed federal returns (or tax transcripts) · **or** proof of current receipt.<br>**Another person's record**, or own record for another's benefit: SSA Award letter **and** proof of current receipt **and** three-year continuance.<br>**Supplemental Social Security Income**: SSA Award letter **and** proof of current receipt.<br>An SSA Award letter may document the income where payments have begun or will begin on or before the first payment date.<br>Where joint returns or transcripts include income not associated with a borrower on the transaction, additional documentation supporting the SSA amount used — such as the **SSA-1099** — is required. | **None.** | Retirement / long-term disability on own record: not verified absent reason to believe otherwise. **All other scenarios: 3 years from the note date.** |
| `pension` | **B3-3.4-03** (03/04/2026) p.354 | **At least one of**: a statement from the organization providing the income · a retirement award letter or benefit statement · a financial or bank account statement · a signed federal income tax return · an IRS W-2 · an IRS 1099.<br>Where payments begin on or before the first payment date of the subject mortgage: a **benefit statement** specifying income type, amount, frequency, and confirming the initial start date. | Fixed distribution or fixed payment: **none**. Variable distribution: **12 months**. | Insurance/personal annuity or retirement-account distribution: **3 years from the note date**. Eligible 401(k)/IRA/Keogh balances may be combined to meet it, where the borrower has unrestricted access without penalty. |
| `disability` (long-term) | **B3-3.4-09** (03/04/2026) p.365 | A copy of the borrower's **disability policy or benefits statement** from the benefits payer (insurance company, employer, or other qualified disinterested party), establishing current eligibility, the amount and frequency of payments, and whether there is a contractually established termination or modification date.<br>**Plus** evidence the borrower will receive at least one payment **on or before the first payment due date**. | **None.** | Not verified unless there is reason to believe the income may not continue; a re-evaluation of benefits is not such a reason. |
| `alimony`, `child_support` | **B3-3.4-02** (03/04/2026) p.353 | 🚨 **Opt-in only — see above.**<br>**One of**: a copy of a divorce decree or separation agreement (where the divorce is not final) · any other written legal agreement or court decree describing the payment terms · documentation verifying an applicable state law mandating the payments.<br>**Plus** documented receipt of income for the **most recent six months** — bank statements, cancelled checks, or evidence of other electronic receipt. | **6 months**, demonstrating full, regular and timely payments. | **3 years from the note date.** Check limitations such as the age of the children supported or the duration alimony is owed. |
| `investment` | **B3-3.4-08** (03/04/2026) p.364 · **B3-3.4-05** (03/04/2026) p.358 | Interest and dividend: signed personal federal returns for the most recent **two years**, **or** account statements covering the most recent **24 months**; plus verification of the borrower's **ownership of the assets** on which the income was earned.<br>Capital gains: signed personal federal returns for the most recent **two years including IRS Form 1040, Schedule D**; plus evidence the borrower owns a **portfolio of assets that can be sold** if additional income is needed to make future payments. | **2 years** (both). | Interest/dividend: not verified unless there is evidence the asset will be depleted. Capital gains: not verified absent reason to believe otherwise. |
| `other` | **B3-3.4-01** (03/04/2026) p.352 · **B3-3.1-02** (06/03/2026) p.321 | No single document set — the type must be identified before a specific requirement can be cited, so the engine asks for **two years of federal tax returns** (the near-universal artifact by which the source *can* be identified, per B3-3.1-02) and routes the rest to a human. Beyond the returns the engine emits **no guessed document list**. Trust income, for example, has its own rule at **B3-3.4-16** (03/04/2026) p.374. | — | — |

## Not covered here — deliberately

**This matrix is conventional (Fannie) only.** FHA, VA and USDA carry their own documentation
rules, and their handbooks are **not in this repo**:

| Program | Authority needed | Status |
|---|---|---|
| FHA | HUD Handbook 4000.1, §II.A.4/5 | **UNVERIFIED — needs the handbook.** `hud.gov` returned **403** on 2026-08-21. |
| VA | VA Lenders Handbook M26-7, Ch. 4 | **UNVERIFIED — needs the handbook.** The WARMS PDF path returned 200 with no income text; the URL is stale, not blocked. |
| USDA | HB-1-3555, Ch. 9 | **UNVERIFIED — needs the handbook.** `rd.usda.gov` returned **403** on 2026-08-21. |

Until each lands here, `INCOME_SOURCE_RULES` carries conventional requirements only, and a
non-conventional file keeps returning honest manual review rather than a guessed document list.

## Still to obtain

1. **Form 1005** (*Request for Verification of Employment*) — referenced by both employment rows; the
   form itself is not in this directory.
2. **Form 1007 / Form 1025** — referenced by the rental row.
3. **Form 1084** (*Cash Flow Analysis*) — still outstanding from
   `self-employment-income-reference.md`; behind Cloudflare Turnstile, needs a human download.
