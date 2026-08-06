# Regulation Z (Truth in Lending) reference documents

Authoritative reference material for every Reg Z reading in this repo — loan-originator
compensation, the QM points-and-fees cap, the finance-charge definition, and TRID fee
tolerances.

Per [CLAUDE.md](../../CLAUDE.md), regulated logic is never written from memory. This directory
exists so Reg Z gets the same treatment [`docs/fannie-mae/`](../fannie-mae/) and
[`docs/nmls/`](../nmls/) already give their domains: a local, citable copy, so a reading can be
**verified** rather than **flagged**.

> ## ⚠️ Local inventory is EMPTY — this is the blocker, not an oversight
>
> **Five ledger entries are stuck on it**, three of them due within two weeks (see the table
> below). Each one records a reading that is *implemented conservatively and shipped*, but whose
> verbatim regulatory text **could not be checked**, because every authoritative source is
> unreachable from the agent environments this repo is developed in.
>
> Verified blocked on 2026-08-04 and re-verified 2026-08-05 — all return `CONNECT tunnel failed,
> 403` or equivalent at the proxy:
>
> | Source | Status |
> |---|---|
> | `ecfr.gov` (incl. the versioner API) | ❌ blocked |
> | `consumerfinance.gov` | ❌ blocked |
> | `govinfo.gov` (incl. CFR bulk data) | ❌ blocked |
> | `law.cornell.edu` | ❌ blocked |
> | `uscode.house.gov` | ❌ blocked |
> | `federalregister.gov` (API) | ❌ blocked |
>
> **This cannot be worked around from inside a session.** A human has to place the document
> here once; after that every entry below becomes verifiable, and the next Reg Z question does
> not repeat this.

## Document hierarchy

1. **The regulation text itself controls** — 12 CFR Part 1026, and its Official Interpretations
   (Supplement I), which are the CFPB's binding commentary and frequently the only place a
   composition question is actually answered.
2. **CFPB compliance guides** (e.g. the TILA-RESPA Integrated Disclosure small-entity compliance
   guide) are useful navigation aids, not authority.
3. Where a Fannie Mae job aid and the regulation disagree, **the regulation controls** for what
   the law requires; the job aid controls for what Fannie will *accept at delivery*. Both can
   bind at once — escalate rather than picking a side.

## What to obtain

The whole of **12 CFR Part 1026 plus Supplement I** is the safest single artifact — one file,
covers everything below and anything Reg Z that comes next. A current annual-edition PDF of
Title 12, Chapter X, Part 1026 is sufficient.

Drop it here as `12-cfr-1026-regulation-z.pdf` (or the eCFR XML as
`12-cfr-1026-regulation-z.xml`), then add it to the inventory section below with a section→page
map, following the pattern in [`docs/nmls/README.md`](../nmls/README.md).

### The five entries waiting on it

Each row is a *shipped* implementation whose regulatory basis is recorded as unverified in
[`data/regulatory/regulatory-ledger.json`](../../data/regulatory/regulatory-ledger.json).
Run `pnpm checkup` to see live due dates.

| Ledger entry | Sections needed | What it decides | Code |
|---|---|---|---|
| `regz-1026-36d2-dual-compensation` | **§1026.36(d)(2)** + Supp. I commentary | Whether the borrower may be charged an origination fee when the lender also pays the originator. Currently: never. | `shared/compliance/loCompensation.ts`, `server/services/loanCosts.ts` |
| `regz-1026-32b1-points-and-fees-floor` | **§1026.32(b)(1)** (esp. `(i)`) + Supp. I | Exactly which charges compose "points and fees". Our floor is a deliberate *lower bound* because this list could not be confirmed. | `shared/compliance/loCompensation.ts`, `server/services/mismoValidation.ts` |
| `regz-1026-4-platform-finance-charge-classification` | **§1026.4(a)**, **§1026.4(c)** + Supp. I | Whether a **tax service fee** is a finance charge. Drives both the QM numerator and denominator. Post-F-17 this no longer changes originability — see below. | `server/services/loanCosts.ts` (`PLATFORM_FINANCE_CHARGES`) |
| `trid-1026-19e3-fee-tolerance` | **§1026.19(e)(3)(i)–(iv)**, **§1026.19(f)(2)(v)** + Supp. I | Which tolerance bucket each fee sits in (zero / ten-percent / none), reset rules, and the 60-day refund. | `shared/compliance/feeTolerance.ts`, `server/services/leDisclosureBaseline.ts` |
| `platform-fee-schedule-qm-fit` | **§1026.36(d)(1)**, **§1026.17/19** disclosure rules | Whether a platform fee that varies with the comp plan is acceptable disclosure practice, and its fair-lending posture. | `server/services/loanCosts.ts` (`resolvePlatformFinanceCharges`) |

### Which one to do first — corrected

> **Correction (2026-08-05).** The first version of this file said the tax service fee question
> should go first because it "changes numbers today", citing ~$10–13k of loan amounts per comp
> plan being refused. **That was written from the pre-F-17 state and is wrong.** Measured across
> every loan size $20k–$500k at 175/200/225/275/290 bps: the classification now changes
> originability in **zero** cases. The F-17 fee-fit absorbed it — because the platform's own
> fees trim to fit the cap, a $100 reclassification no longer pushes any file over.

What the classification still decides, post-F-17:

- **Accuracy of the disclosed points-and-fees figure.** The tax service fee is counted against
  the QM cap. If it is not a finance charge, that figure overstates by $100 on every file.
- **$100 of our own revenue on budget-bound files.** The fee is non-reducible (a vendor
  pass-through we cannot discount), so where the trim binds it consumes $100 of the same budget
  that would otherwise fund our application/underwriting fees. At $120k the total charged is
  $1,738 either way — the difference is only who gets the $100.

So none of the five is urgent on *outcome* grounds. Prioritise instead by **due date** — the
three 14-day entries (`regz-1026-36d2`, `regz-1026-32b1`, `trid-1026-19e3`) go loud first — and
by the fact that **§1026.32(b)(1) is the keystone**: confirming the points-and-fees composition
would let the floor stop being a deliberate lower bound, which is the single change that would
most improve the QM math's precision.

Every reading in the table is conservative in the borrower's favour and safe to sit on: each can
only *remove* a borrower charge or *tighten* a gate, never create the violation it guards
against. That is why they shipped flagged rather than blocked.

## Once the document is here

1. Add it to a **Local inventory** section with a section→page map (see `docs/nmls/README.md`).
2. Work the table above. For each entry: confirm or correct the reading, update the `citation`
   to drop "VERIFICATION PENDING", set `lastVerified`, and reset `reviewIntervalDays` to **180**
   — the short 14/30-day intervals exist only to keep these loud while unverified.
3. Point `sourceUrl` at the local file rather than a blocked host.

Adding a document here is not itself a compliance decision. Confirming or correcting a reading
is — and where a reading turns out to be wrong, the correction ships as its own change with its
own tests, not as a quiet ledger edit.
