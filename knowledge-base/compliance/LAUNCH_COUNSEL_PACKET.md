# Launch Counsel Packet — the four asks that gate the go-live flip

**Prepared 2026-08-05.** This packet is written to be sent to outside counsel as-is. It
contains **only** the questions that block opening the public funnel (the "gate flip" in
[BETA_GO_LIVE_READINESS.md](../runbooks/BETA_GO_LIVE_READINESS.md) §3). Counsel items
attached to parked or dark features are deliberately excluded (list at the end) so this
review can be scoped and priced small.

## Context for counsel

- **Homiquity Mortgage Corporation**, NMLS #427468, licensed **2026-07-13**; footprint is
  **Illinois only** (Illinois Residential Mortgage License; the platform hard-blocks
  applications and quotes for property outside the licensed footprint, server- and
  client-side).
- **Channel: mortgage broker.** We arrange financing with wholesale lenders; we make no
  credit decisions and fund no loans, and the public site says so.
- **Current posture:** the marketing site is live at homiquity.com behind a "launching
  soon" waitlist. Free calculators, education content, and legal pages are public today;
  the application funnel, rate pages, and personalized surfaces are gated. The flip we
  are asking counsel to clear opens the funnel to real applicants (initially
  invite-only).
- Engineering references in this packet point at the internal knowledge base; each ask
  lists the primary sources. The standing engineering-level review these asks were
  distilled from is [COMPLIANCE_COUNSEL_REVIEW.md](COMPLIANCE_COUNSEL_REVIEW.md).

---

## Ask 1 — Priced calculators and apply CTAs on unauthenticated pages at launch

**Question.** May the public (unauthenticated) marketing surface, at and after the flip,
continue to show: (a) calculator outputs that include illustrative payment amounts and
rate assumptions, and (b) "Get Pre-Approved" calls-to-action — under Reg Z §1026.24
advertising rules (trigger terms / required assumption disclosures) and Reg N §1014
(no approval or guarantee representations)? If conditions are required (on-page
assumption disclosures, representative-example framing, ARM disclosures), specify them.

**Current implementation.** Nine free calculators are public today; each presents
outputs as estimates with assumption disclosures and no approval language (enforced by
copy tripwire tests). The internal launch charter (BUILD-1) originally forbade any
priced output or apply CTA on unauthenticated routes; product overrode that on
2026-07-08 as a recorded **authorized deviation** with the note "requires counsel
sign-off before F1" ([CICD.md](../runbooks/CICD.md), ledger row 2026-07-08). The
original concern was framed pre-license; licensure (2026-07-13) resolved the
unlicensed-solicitation leg, but the **advertising-content** leg was never ratified,
and the footprint is now Illinois-only — which changes the question from "may an
unlicensed entity show this" to "what must an Illinois-licensed broker's national-reach
website disclose."

**What changes on your answer.** Copy/disclosure edits to the calculator and rates
surfaces before the flip; possibly geo-scoping of priced content.

## Ask 2 — Adverse-action notice: administering agency + creditor address

**Question.** (a) For our adverse-action notices (ECOA §1002.9 / Reg B Appendix A +
FCRA §615), which administering-agency identification should the notice carry for a
state-licensed Illinois mortgage broker — CFPB, FTC, or otherwise? (b) Please confirm
the notice's creditor identification requirements: we currently lack a published
business mailing address on the consumer-facing disclosure surface and in the notice
template's address block.

**Current implementation.** Denials are mechanically **blocked** unless a compliant
notice generates; borrower delivery is in-app with a staff postal-PDF fallback and a
30-day delivery watchdog. The administering-agency line and the creditor address block
carry TODOs pending this confirmation
([COMPLIANCE_COUNSEL_REVIEW.md](COMPLIANCE_COUNSEL_REVIEW.md) §adverse-action). The
company treats the missing mailing address as **resolve-before-un-gating**.

**What changes on your answer.** One-line template edits (agency, address) plus adding
the business address to the public Disclosures page. The founder supplies the address
itself.

## Ask 3 — Denial-reason specificity and notices of incompleteness

**Question.** Review our denial-reason statements for Reg B §1002.9(b)(2) specificity
(are our reason phrasings specific enough?), and confirm whether our "application
incomplete" outcome must be delivered as a §1002.9(c) notice of incompleteness rather
than a denial.

**Current implementation.** The decision engine emits typed, deterministic reasons;
borderline files route to `under_review` rather than auto-denial; incomplete files
today surface as a task/request loop, not a formal §1002.9(c) notice
([COMPLIANCE_COUNSEL_REVIEW.md](COMPLIANCE_COUNSEL_REVIEW.md) §Reg-B).

**What changes on your answer.** Reason-phrase edits and, if required, a formal
notice-of-incompleteness artifact on the incomplete path.

## Ask 4 — Reg N citation confirmations (from the comms-lint hard-block)

**Question.** Confirm the two Mortgage Acts and Practices (Reg N, 12 CFR 1014.3)
citations our outbound-comms linter attributes: the "no fees" prohibition mapped to
§1014.3(c) (previously cited (f)), and the government-affiliation misrepresentation
mapped to §1014.3(n) (previously cited (m),(n)). Our auditor endorsed keeping
government-affiliation as a warning rather than a hard block because truthful VA/FHA
program statements are common; confirm or correct that treatment.

**Current implementation.** Loan-officer outbound messages are linted; "approval
guaranteed" class statements are hard-blocked (§1014.3(q) class); the two cites above
are flagged for verbatim confirmation (shipped 2026-07-12, PR #138).

**What changes on your answer.** Citation-string corrections in the linter and its
tests; possibly reclassifying the government-affiliation rule.

---

## Explicitly out of scope for this packet

Tracked in their own program docs; none block the flip: the Shariah-financing lane
(marketing gated off), PartnerHub consent/RESPA co-marketing framework (partner surfaces
education-only), IVES / 4506-C transcript workflow (§7216 — feature dark), the
verified-funds letter product (parked; a standing internal rule bars machine-issued
financial attestations to third parties), and ad-imagery / Fair Housing review for
lifestyle marketing assets (no ad campaigns before that review).
