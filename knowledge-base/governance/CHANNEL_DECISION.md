# Channel Decision: Broker or Correspondent

> **Freshness:** last verified 2026-08-23 · review every 30 days — enforced by `scripts/doc-freshness-guard.cjs`.

**Status: OPEN — founder-owned. Current declared channel: `broker`, as an operations fact.**
**The build freeze on the delivery stack was lifted 2026-08-23 by founder directive (CHARTER
§1a): the channel constant governs runtime behavior and what the business operates as — it no
longer governs what may be built.** Code may build for the declared channel and ahead of it;
flipping the constant remains an L3 founder act gated by §3 below.

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
reading it is **kept, not deleted** — deleting would destroy correct work that becomes valuable
the moment reading B is chosen. The maintenance burden (ULDD spec updates, annual QM threshold
tables, SFC catalog drift) is the real recurring cost, not the disk space.

**This is what the code currently asserts.** From 2026-08-04 to 2026-08-23 the reading was also
enforced mechanically — a CI guard failed any PR that grew the four tracked files while the
channel read `broker`. That freeze was **lifted 2026-08-23 by founder directive** (CHARTER §1a:
business decisions gate operations, never what may be built; the guard's unblocking trigger was a
warehouse line and GSE seller approval, i.e. purely business events). The scope doctrine that
replaces it is the coverage map's Part-C not-applicable rows
([SELLING_GUIDE_COVERAGE.md](../compliance/SELLING_GUIDE_COVERAGE.md)): GSE delivery is the
wholesale lender's function (A3-3-01), so growth in this stack should serve a named need — a
correction, a cited edit-mirror update, or reading B — not accretion by default.

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
- [x] ~~The delivery-stack freeze lifted deliberately, not as a side effect.~~ Done 2026-08-23,
      deliberately, by founder directive — ahead of the channel decision rather than as part of
      it (see the status note above).

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

The engineering cost of reading A is bounded and visible: ~1,482 lines whose upkeep is the cost,
with the coverage map's Part-C rows as the standing scope guidance now that the mechanical freeze
is gone.

The cost of *not deciding* is higher than either answer. Under A, the stack is dead weight the
business does not need. Under B, the company is operating without a capital plan for risks it has
already decided to take.

**The business question is the founder's, on the founder's clock — and per the 2026-08-23
directive it no longer holds any build work hostage. The code follows the answer in one line.**

---

## 6. Provenance

Opened 2026-08-04 by the financial architecture audit
([log](../logs/2026-08-04-financial-architecture-capital-structure-audit.md), finding F-14), which
escalated rather than picking an interpretation per the CLAUDE.md rule on ambiguous requirements.
This page exists so the escalation is actionable rather than merely recorded.
