# Channel Decision: Broker or Correspondent

> **Freshness:** last verified 2026-08-04 · review every 30 days — enforced by `scripts/doc-freshness-guard.cjs`.

**Status: OPEN — founder-owned. Current declared channel: `broker`.**

**What this decides:** whether Homiquity hands every file to a wholesale lender who funds it
(**broker**), or closes loans in its own name with borrowed money and sells them on
(**correspondent**). It is one constant in code — `BUSINESS_CHANNEL` in
[`shared/businessChannel.ts`](../../shared/businessChannel.ts) — and the largest unanswered
question about the company's capital structure.

**Why it needs a page.** The codebase was building toward both answers at once, and nobody could
tell which from reading it. That ambiguity was itself the defect
([audit F-14](../logs/2026-08-04-financial-architecture-capital-structure-audit.md)).

---

## 1. The evidence that raised it

A broker never delivers a loan to Fannie Mae. The wholesale lender is the seller/servicer: it owns
ULDD delivery, the UCD, the EarlyCheck edits, the Special Feature Codes and MERS registration, and
it performs all of that itself after we hand over the file.

Yet the repo contains a full seller/servicer delivery stack:

| File | Lines |
|---|---|
| `shared/fannieMae/loanDeliveryEdits.ts` | 677 |
| `shared/fannieMae/specialFeatureCodes.ts` | 338 |
| `server/services/loanDeliveryReadiness.ts` | 271 |
| `shared/fannieMae/ucdFeeEnumerations.ts` | 196 |
| **Total** | **1,482** |

Plus ~690 lines of tests, the `loan_delivery_data` table, and a MERS org ID being pursued.

**Reachable through one staff API route pair and no client surface at all** (verified: zero client
callers). It is well-built, carefully cited work. The question is not its quality — it is whether
the business needs it.

> **Not in scope of this decision:** MISMO 3.4 *export to a wholesale lender*
> (`server/mismo.ts`, `buildLenderPackage`). That is core broker work in every channel and is
> deliberately excluded from the freeze below.

---

## 2. The two readings

### A — It is overhead (consistent with today's declared channel)

The delivery stack implements a function the wholesale lender performs again itself. Under this
reading it should be **frozen, not deleted** — deleting would destroy correct work that becomes
valuable the moment reading B is chosen, and the maintenance burden (ULDD spec updates, annual QM
threshold tables, SFC catalog drift) is the real recurring cost, not the disk space.

**This is what the code currently asserts**, and it is enforced: `pnpm guard:channel`
([`scripts/delivery-stack-freeze-guard.cjs`](../../scripts/delivery-stack-freeze-guard.cjs)) runs
in the CI gate and fails if the tracked files grow while the channel is `broker`. The stack may
shrink freely. The guard turns itself off if the channel flips.

### B — The real plan is mini-correspondent

Then the stack is prescient and the freeze should be lifted. But **the entire capital picture in
the audit changes**, and nothing in the knowledge base currently reflects any of it:

- A **warehouse line** becomes necessary — with covenants, borrowing base, and a lender who can
  pull it.
- **Duration mismatch becomes real.** Loans sit on the balance sheet between funding and purchase;
  dwell time becomes a financing cost and a rate risk.
- **Loans held for sale** appear as assets, with fair-value marks.
- **Early-payment-default repurchase** risk lands on us, not the wholesale lender.
- **Minimum net worth and warehouse covenants bind** far harder than broker licensing does.
- **Audit finding F-16 dies.** "Asset-light, no duration risk on assets, and that is the correct
  architecture" is the foundation the whole contingent-liability framing rests on. Under
  correspondent it is simply false, and
  [CONTINGENT_LIABILITY_REGISTER.md](./CONTINGENT_LIABILITY_REGISTER.md) becomes materially
  incomplete — it would need warehouse exposure, repurchase reserves and mark-to-market added.

---

## 3. What must be true before flipping to `correspondent`

Flipping the constant is one edit. Being able to flip it honestly is not. Do not change it until
every line below is true:

- [ ] An executed warehouse line, with its borrowing base and covenants recorded.
- [ ] Minimum net worth verified against the state statute **and** the warehouse covenants,
      recorded in the contingent-liability register.
- [ ] Fannie Mae and/or Freddie Mac seller/servicer approval obtained.
- [ ] A MERS organisation id issued (it becomes genuinely required — see §4).
- [ ] EPD repurchase exposure modeled and reserved against.
- [ ] `CONTINGENT_LIABILITY_REGISTER.md` extended with warehouse, repurchase and mark-to-market
      exposures.
- [ ] `L1_VISION_AND_SCOPE.md` §2 updated — it currently states the broker spine as the product.
- [ ] The delivery-stack freeze lifted deliberately, not as a side effect.

---

## 4. What changed in code while this stays open

Nothing was deleted. Three things became honest:

1. **The channel is declared** rather than implied — `shared/businessChannel.ts`, one edit point.
2. **The delivery-readiness report says what it is.** It now carries a `channelApplicability`
   block stating plainly that in the broker channel these results are a data-quality pre-flight on
   our own file, **not a delivery obligation we owe**, and that nothing in it gates a broker
   submission. The report stays available — it is genuinely useful — but can no longer be
   misread as a compliance gate we are subject to.
3. **The MERS line stopped implying it was merely late.** `mersOrgId` was `"PENDING"`, which read
   as a roadmap item someone should chase. MERS registers the notes an entity *holds*; a broker
   holds none, so it is now `NOT_APPLICABLE_BROKER_CHANNEL` and the "MERS Org ID is not
   configured" warning no longer fires in a channel where it cannot apply. **Pursuing an org ID
   today would be an annual membership fee for a registry with nothing to register.**

---

## 5. How to decide

The engineering cost of reading A is now bounded and visible: 1,482 frozen lines that cost nothing
until someone tries to grow them, at which point CI asks this question again.

The cost of *not deciding* is higher than either answer. Under A, work keeps accreting into a
stack the business does not need. Under B, the company is operating without a capital plan for
risks it has already decided to take.

**Decide the business question first; the code follows in one line.**

---

## 6. Provenance

Opened 2026-08-04 by the financial architecture audit
([log](../logs/2026-08-04-financial-architecture-capital-structure-audit.md), finding F-14), which
escalated rather than picking an interpretation per the CLAUDE.md rule on ambiguous requirements.
This page exists so the escalation is actionable rather than merely recorded.
