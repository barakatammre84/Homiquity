# Notice to Home Loan Applicant (FCRA §609(g)) — build spec + F3 vendor requirements

**Status 2026-08-06: entirely absent from the codebase** (grep across `server/`, `shared/`,
`client/src/`, `migrations/` for "home loan applicant | nthla | 609(g)" → 0 hits). Not
launch-blocking for the gated beta. **Hard-blocking for F3** (the live credit-vendor
contract) — and unlike adverse action it fires on *every* file with a real score, so a
missing implementation at F3 fails 100% of production loans rather than a subset.

Statutory text quoted here was fetched from GPO govinfo (15 U.S.C. §1681g, §1681m, §1681c)
and the Cornell LII CFR mirror (12 CFR 1022.72/.74, Appendix H); supervisory gloss is the
Federal Reserve *Consumer Compliance Handbook*, FCRA §§ pp. 25–26, 41, 47 — **examination
guidance, not binding law**. The statute controls.

---

## 1. Why it reaches us, and when it fires

§1681g(g)(1) binds "any person who **makes or arranges** loans and who **uses a consumer
credit score** … in connection with an application … for a consumer purpose that is
**secured by 1 to 4 units of residential real property**", and then calls that person "the
lender" for the whole subsection. **"Arranges" is disjunctive — a broker is in scope.**

Three properties that drive the design:

1. **Outcome-independent.** Handbook p. 26: "This disclosure requirement applies to any
   application for a covered transaction, **regardless of the final action** on the
   application." Adverse action hangs off the denial seam; **NTHLA cannot.** It fires on
   approvals, counteroffers, withdrawals and incompletes alike.
2. **Timing rides the pull, not the decision and not the LE.** Statute: "as soon as
   reasonably practicable"; Handbook p. 47: "as soon as reasonably practicable **after the
   credit score has been obtained**." Bundling it with the TRID package is only acceptable
   when the score is already in hand at that moment.
3. **Scope conditions must be encoded, not assumed.** A business-purpose loan is outside
   §609(g) (Handbook p. 25). And the triggering "credit score" is the bureau score —
   §1681g(f)(2)(A) expressly **excludes** "any mortgage score or rating of an automated
   underwriting system", so a DU/LPA recommendation is not it.

Express carve-outs: no more than **one disclosure per loan transaction** ((g)(1)(E)(iv) — a
re-pull or refresh does not owe a second); no duty when **another person has already made
the disclosure for that transaction** ((E)(v) — a wholesale lender's notice can discharge
ours, but do **not** build on this: we pull first, and whether any Target-5 lender issues and
evidences one is a contractual fact not in this repo); nothing owed for scores obtained
**after closing** ((E)(iii)).

## 2. Why we must NOT issue one today

Production credit pulls refuse rather than simulate (`creditPulls.ts`, `server/mcp/vendors.ts`
— both throw unless `CREDIT_VENDOR_MODE=simulation`), so no CRA-derived score exists in prod
and **no duty has attached**. A simulated number is not a score "derived from a statistical
tool or modeling system" (§1681g(f)(2)(A)), and (g)(1)(F)(i) limits the obligation "**solely
to providing a copy of the information that was received from the consumer reporting
agency**" — for a simulated pull, none was received.

Issuing an NTHLA from simulated data would name Experian/Equifax/TransUnion as having
"provided a credit score that was used" when they provided nothing, and aim the borrower's
dispute rights at agencies holding no such file. That is the same falsified attribution the
§615(a) chokepoint refuses (PR #397), and it violates the standing no-machine-issued-
falsified-records rule.

**Operating rule: refuse rather than issue a notice that cannot be truthful** — and record
the refusal in the tamper-evident chain so the absence is an affirmative, dated fact rather
than silence. (Shipped for the adverse-action twin in the PR carrying this doc; the same
`resolveNthlaPosture` shape applies when NTHLA is built.)

**No table until F3.** The refusal path writes to `credit_audit_log`, which needs no schema
change (`action` is free-form varchar). Creating `home_loan_applicant_notices` now — when
nothing can write a notice row until a real vendor exists — would be speculative schema,
which this repo bars. Build the table in the F3 PR, with its migration, per §5 below.

## 3. Required content (all quoted from §1681g)

The notice carries **(A)** a copy of the §1681g(f)(1) information *plus* **(D)** the
statutory notice block.

| (f)(1) item | Requirement |
|---|---|
| (A) | the score used |
| (B) | "the range of possible credit scores **under the model used**" — not a hardcoded 300–850 |
| (C) | "**all** of the key factors that adversely affected the credit score … **in the model used**, the total number of which shall not exceed 4, **subject to paragraph (9)**" — and (f)(2)(B) requires they be "**listed in the order of their importance**" |
| (D) | the date the score was **created** (not pull-completion time) |
| (E) | the entity that provided the score or the credit file it was created from |

**(f)(9) inquiries carve-out:** when a key factor is the number of inquiries it is included
"**without regard to the numerical limitation**" — effective cap 4, or 5 when one is
inquiries. Key factors come from the CRA (§1681c(d)(2) obliges the CRA to flag the inquiries
factor). **They are the vendor's to supply — never synthesize them, and never reuse denial
reasons as key factors** (the adverse-action template already removed exactly that false
statement).

**(D) the notice block is verbatim.** The statute says "**A copy of the following notice**",
there is no CFPB model form for §609(g), and Reg V Appendix H ¶4 only says Model Form H-3 "is
**intended**" to also comply. Store it as an immutable versioned constant and interpolate
nothing inside it — the word "lender" in that text is statutory and must not be swapped for
"broker". It must include "the name, address, and telephone number of **each** consumer
reporting agency providing a credit score that was used."

**Multi-bureau:** one notice, N score blocks. Handbook p. 26: "if multiple scores are used,
**all of them can be included in one disclosure**". ⚠️ **Escalation:** 12 CFR 1022.74(d)(4)
permits a *single* score in the Reg V notice, while §609(g) + the Handbook point at all
scores used. We derive the representative score **from all three**, so all three are used as
inputs. Recommended build discloses all three and names all three CRAs (the superset
satisfies both readings) — but a one-score H-3 is a defensible industry posture, so **confirm
with counsel** rather than treating the superset as settled.

## 4. It does not overlap with what we already have

NTHLA and §615(a) adverse action are **independent duties; neither discharges the other**.
Adverse action carries the §1681j 60-day free-copy right and the §1681i dispute right, which
NTHLA lacks; NTHLA carries the verbatim (D) block and names **each score-providing** CRA
(adverse action names only the CRA that **furnished the report**), and it exists on approvals
where adverse action never does. On a denial with a real pull the file owes **both**.

They may share a delivery moment — 12 CFR 1022.74(d)(2)(ii)–(iii) *requires* the Reg V notice
to ride "on or with" the §609(g) notice and to be "**segregated** from other information …
except for" it. So if co-delivered, keep the §609(g) block as its own segregated
section/document rather than interleaving it into adverse-action prose.

## 5. F3 vendor-contract acceptance criteria ⚠️ CAPTURE BEFORE SIGNING

`credit_pulls` today stores bureau scores, tradeline/debt aggregates, derogatory and inquiry
**counts**, a liabilities blob, the encrypted raw response, vendor metadata and
`is_simulated`. It has **no** column for the key factors, the model name/version or its range,
the score **creation** date, or the provider entity — and `bureaus` records the set
**requested**, not which bureaus returned a file. Without these, both the NTHLA and the
§615(a) score block are structurally incomplete (which is why `computeFcraCompliant` holds
three conjuncts false today).

**The credit-vendor feed must deliver, per bureau:** the score · the scoring model **name and
version** · that model's **range** · the score **creation date** · the **provider entity** ·
the **ordered key factors** with codes *and* consumer-usable descriptions · the
inquiries-factor flag (§1681c(d)(2)) · and **which bureaus actually returned a file**.

**Add to F3 acceptance:** *on every completed real pull, an NTHLA is generated at pull
completion, delivered to the borrower, and chained — before any decision, letter, or pricing
is communicated to that borrower.*

## 6. Implementation sketch (build at F3)

A leaf service `server/services/homeLoanApplicantNotice.ts` mirroring the shape that worked
for the adverse-action chokepoint: a pure `resolveNthlaPosture(pull, application)` returning
`not_applicable` (no score / not consumer purpose / not 1–4 residential) | `refuse`
(simulated or incomplete score data) | `issue`, plus an idempotent
`ensureHomeLoanApplicantNotice(...)`.

**Coverage trap:** two paths complete a pull with scores — `POST /api/loan-applications/:id/
credit/pull` (via `simulateCreditPullCompletion`) **and** `recordExternalSoftPull` in
`server/services/creditAudit.ts`, used by the MCP agent tool, which inserts a completed pull
directly and bypasses the first path entirely. Prefer one shared
`finalizeCompletedCreditPull(pull)` used by both so a third path cannot silently skip the
notice; at minimum, both call sites plus a test asserting both.

The decision seams (`statusDecisions.ts`, `underwriting/pipeline.ts`, letter issuance) get a
**backstop assertion** that a notice exists whenever a completed real pull does — never the
trigger, because the duty is outcome-independent. Render from the **pull**, never from
`application.creditScore` (a general-purpose column next to self-reported figures).

Persistence follows the `adverse_actions` pattern: verbatim `notice_text`, versioned
statutory-text marker, per-bureau `disclosed_scores` JSONB, `cras_named`,
`basis_pull_simulated`, delivery columns, `generated_by`; **no `.default(true)` on any
compliance assertion** (compute it). Audit actions
`home_loan_applicant_notice_{generated,delivered,refused}` — and note that
`computeAuditEntryHash` digests `actionDetails` but **not** the FK columns, so any linkage
that must be tamper-evident has to ride in `actionDetails` too.

Delivery mirrors the borrower-notice + staff-PDF pattern (borrower page, staff-only PDF
stream with an audit entry per download, a deliver endpoint). ⚠️ Electronic-only delivery of
a required disclosure needs **E-SIGN** consent (15 U.S.C. §7001(c)); an `e_consent` step
exists but its template was **not** verified against §7001(c) — gate electronic delivery on
it, keep the staff PDF as the postal fallback, and have counsel review the template.

## 7. Open / unverified

- **Multi-score content**: 1022.74(d)(4) vs §609(g) — counsel call (§3).
- **Risk-based pricing (§615(h) / 12 CFR 1022.72)**: likely the wholesale lender's duty, since
  a broker does not "grant, extend, or otherwise provide credit" — **unassessed**, and the
  sibling FCRA audit likewise left §615(h) open for the `counteroffer` / `rate_adjustment` /
  `terms_change` action types.
- **Illinois overlay**: the RMLA / Ill. Adm. Code position on credit-score disclosure was not
  checked. IL is our only licensed state and `getStateDisclosureRules` exists to hold such
  rules — state law controls where stricter.
- **Private right of action / liability posture** for §609(g): courts have split; counsel.
- **`BUREAU_CONTACT_INFO`** addresses and phones are hardcoded and unverified against current
  CRA-published details — verify before the first real notice, since the borrower's dispute
  and free-report rights are aimed by them.
- **(E)(v) discharge** by a wholesale lender: contractual fact, not in the repo.
