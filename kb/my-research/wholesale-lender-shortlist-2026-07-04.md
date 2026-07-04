# Wholesale Lender "Target 5" Shortlist — 2026-07-04

Owner: founder (all outbound contact/credentialing). Claude maintains this file as desk-research
prep so the day F1 (NMLS licensing, currently PENDING in `server/config/company.ts`) clears,
the next step is *submission*, not *research*.

⛔ No outbound emails have been sent to any lender below — that is founder-only, gated on F1.
Everything in this file is public-source desk research (lender websites, trade press).

Strategy context: [kb/founder-routines/broker-mismo-ppe-strategy — see MEMORY] Homiquity is a
broker with its own MISMO 3.4 middleware, targeting a lean PPE (Lender Price and/or Mortech —
see `CTO_ROADMAP.md` F11) and dual DU + LPA submission. Shortlist below is GSE/conventional-heavy
with one non-QM lender for diversification, matching that strategy.

## 1. UWM (United Wholesale Mortgage)
- NMLS #3038. Largest wholesale lender by volume; broker-exclusive (does not lend direct-to-consumer).
- **Broker-approval requirements (known):** state license type must match UWM's checklist (Mortgage
  Broker License / Mortgage Company Registration / Real Estate Corporation Endorsement per state);
  net worth and surety bond minimums vary by state; standard "Sign Up With UWM" application flow.
  Source: [New Broker Resources](https://www.uwm.com/new-broker-resources), [Join](https://www.uwm.com/join-now).
- **Sandbox-access prerequisites:** not published publicly — requires an Account Executive contact
  post-application. ⛔ Missing — needs a founder call to the Director Hotline (248-833-4602, per
  public listing) once F1 clears.
- **Pricing-matrix format:** not confirmed. UWM has its own proprietary pricing engine (BOLT);
  unclear if it exposes a PPE-consumable rate sheet feed vs. portal-only pricing. ⛔ Missing —
  ask AE whether a Lender Price/Mortech-consumable feed exists, or if it's portal-only.
- **What we have:** general approval-path shape, licensing checklist source (NMLS "New Application").
- **What's missing:** specific net-worth/bond numbers, sandbox/test-loan process, pricing feed format.

## 2. Rocket Pro TPO
- Rocket Mortgage's broker/community-bank/credit-union channel.
- **Broker-approval requirements (known):** state licensing (pre-licensure training, exam, surety
  bond — standard NMLS path); Rocket Pro's own materials claim brokers can be licensed "in under
  2 months" through their program. Source: [Become A Broker](https://www.rocketpro.com/become-a-broker).
- **Sandbox-access prerequisites:** application is a lead-gen form ("tell us your goals") — no
  published trial-loan/sandbox process. ⛔ Missing.
- **Pricing-matrix format:** not confirmed. Rocket Pro TPO is integrated into ARIVE (a broker
  LOS/PPE aggregator) per trade press — worth checking whether ARIVE's integration implies a
  standard pricing-feed contract we could mirror. Source: [Rocket Pro Has ARIVE'd](https://nationalmortgageprofessional.com/news/rocket-pro-has-arived).
- **What we have:** application entry point, confirmation of ARIVE integration (a possible format reference).
- **What's missing:** concrete approval checklist, sandbox process, direct pricing-feed spec.

## 3. Plaza Home Mortgage
- Mid-size wholesale/correspondent lender; publishes the most detailed broker documentation of
  the five (full agreements + guides are public PDFs, unusual for this industry).
- **Broker-approval requirements (known):** approval is "at Plaza's discretion" ("approved in good
  standing"); on request, broker must supply financial statements (audited if available) incl.
  net-worth statement, all licenses, credit reports, and disclosure of any adverse public
  records/regulatory findings. FHA approval is a separate rider requiring an FHA experience
  detail form. Source: [Wholesale Broker Guide PDF](https://www.plazahomemortgage.com/documents/becomeanapproved/wholesale-broker-guide.pdf),
  [Master Wholesale Broker Agreement PDF](https://www.plazahomemortgage.com/documents/becomeanapproved/master-wholesale-broker-agreement.pdf),
  [Become an Approved Wholesale Client — start page](https://www.plazahomemortgage.com/becomeabroker/firststep.aspx).
- **Sandbox-access prerequisites:** not extracted — the broker guide PDF (82 pages) is stream-encoded
  and didn't parse cleanly via automated fetch. ⛔ Missing — worth a manual read of the PDF (it's
  the most detailed public doc of the five, likely has the actual checklist) or a founder call.
- **Pricing-matrix format:** Plaza publishes a [Wholesale Loan Submission Matrix](https://www.plazahomemortgage.com/documents/miscforms/wholesale-loan-submission-matrix.pdf)
  and a [Wholesale Product Lineup](https://info.plazahomemortgage.com/wholesale-product-lineup) —
  format not yet confirmed as PPE-feed-compatible vs. PDF-only.
- **What we have:** the most public documentation of any lender here; agreement + broker-guide PDFs
  already located.
- **What's missing:** the broker guide needs a manual (non-automated) read for the actual net-worth
  number and FHA experience threshold; sandbox process unconfirmed.

## 4. Angel Oak Mortgage Solutions (non-QM)
- Non-QM specialist (bank statement, jumbo, investor cash flow, asset-qualifier, full-doc
  portfolio-select products) — included for product diversification beyond GSE/FHA/VA.
- **Broker-approval requirements (known):** sources ~3,600 approved brokers (~20% of the estimated
  18,000 US mortgage brokers) — banks, credit unions, mortgage banks, and brokers; licensed in 46
  states + DC per NMLS. No specific approval checklist found publicly.
  Source: [About Angel Oak Mortgage Solutions](https://angeloakms.com/angel-oak-mortgage-solutions/).
- **Sandbox-access prerequisites:** ⛔ Missing entirely — no public info found; likely requires
  direct wholesale-team contact.
- **Pricing-matrix format:** ⛔ Missing — no public rate-sheet/PPE-feed format found.
- **What we have:** product catalog, broker-network scale (confirms they do work with independent
  brokers, not just banks).
- **What's missing:** everything procedural — this is the least-researched of the five; lowest
  priority for desk research time until F1 is closer, unless non-QM becomes a near-term product
  priority.

## 5. Newrez Wholesale
- Newrez/Caliber-family wholesale channel; "Brigade" team model (dedicated onboarding contact
  before first submission).
- **Broker-approval requirements (known):** form-based application ("Get Approved" / "Become a
  Partner"); a named Brigade team member becomes the primary contact and walks a new broker through
  systems/process before the first submission — implies a guided (not self-serve) onboarding.
  Source: [Become a Partner](https://www.newrezwholesale.com/get-approved/).
- **Sandbox-access prerequisites:** implied to be handled by the Brigade contact post-application;
  no self-serve sandbox found. ⛔ Missing — confirm with Brigade contact once F1 clears.
- **Pricing-matrix format:** ⛔ Missing — [Product Profiles](https://www.newrezwholesale.com/loan-products/product-profiles-brokers/)
  page exists but format (PDF vs. feed) not confirmed.
- **What we have:** application entry point, confirmation of a guided-onboarding model (useful to
  know going in — expect a relationship-first process, not a portal self-signup).
- **What's missing:** approval checklist specifics, pricing feed format.

## Founder call/desk-research checklist (human — pre-F1 prep, not outbound sales contact)

None of the below is "contact the lender to start onboarding" — it's confirming public info we
couldn't extract automatically, so day-1-after-licensing is submission-ready:

- [ ] Manually open Plaza's [Wholesale Broker Guide PDF](https://www.plazahomemortgage.com/documents/becomeanapproved/wholesale-broker-guide.pdf)
      (automated fetch couldn't parse the stream encoding) — extract the actual net-worth/bond
      minimums and FHA-rider requirements.
- [ ] Confirm whether UWM's BOLT pricing and Rocket Pro TPO's pricing are consumable by a
      Lender Price/Mortech PPE feed, or portal-only (affects F11 PPE middleware scope).
- [ ] Angel Oak and Newrez have no public approval-checklist detail — if either becomes a near-term
      priority, this likely needs a direct (non-outbound-sales) info request once F1 clears rather
      than more desk research; automated search hit a wall.
- [ ] Re-verify all five lenders still wholesale-broker-friendly and NMLS-active before F1 clears
      (this file is a snapshot; wholesale lending is a volatile channel — HomePoint-style
      shutdowns happen).

## Research log
- 2026-07-04: Initial shortlist created (file did not previously exist in `kb/my-research/`).
  Desk research via public lender sites + trade press (WebSearch/WebFetch, no outbound contact).
  Plaza's broker-guide PDF fetch failed to parse cleanly (stream-encoded) — flagged above for a
  manual read rather than treated as "no requirements exist."
