# Contingent Liability Register

**Purpose:** the one page that answers *"what could we owe, and is our reserve adequate?"* — a
question that had no answer before 2026-08-04, because the exposures had never been enumerated.

**Why this document exists.** Homiquity is a mortgage broker. It holds no loans, so there is
nothing to mismatch against liabilities and no duration risk on assets. That asset-light structure
is correct and worth defending. It also means **the company's real balance sheet is entirely
contingent**: obligations that exist only if something happens — a fee comes in over what was
disclosed, a loan pays off early, a lock expires before closing. Those exposures are the balance
sheet, and until this register they were represented nowhere.

**Live figures:** `GET /api/reports/contingent-liabilities` (admin). This page is the policy
layer — what each exposure *is*, what bounds it, and who has to resolve it. The endpoint computes
what is computable; everything below marked **unquantified** needs a human.

**Maintenance rule:** same cadence as [ASSUMPTIONS.md](./ASSUMPTIONS.md). When an exposure becomes
quantified (statute checked, agreement signed), move it out of the unquantified list and update
the date in the same commit. If the code contradicts this page, the code wins — fix this page.

---

## The one rule

Some exposures can be measured from live data. Others are real, potentially unbounded, and cannot
be quantified without a statute or counsel.

A register that quietly omitted the second kind would produce a total that **looks complete and is
not**, which is worse than no total. So the endpoint reports a `quantifiedFloor`, never a "total",
and carries `unquantifiedCount` alongside it. **The floor is not the reserve number.** It is the
part of the reserve number we can currently see.

---

## 1. Quantified exposures (computed from live data)

| Exposure | Trigger | Window | Basis |
|---|---|---|---|
| **TRID good-faith cures** | A disclosed charge increases with no valid changed circumstance | Until closing, then 60 days post-consummation to refund | Persisted Loan Estimate baselines (F-4). Only files whose *current* evaluation returned `cure_required` are counted — a superseded version's evaluation is history, not exposure. |
| **EPO compensation clawback** | A funded loan pays off inside the lender's early-payoff window | Funding → window close | Funded submissions × recorded remittance (F-8). |
| **Honor exposure on unconfirmed quotes** | Rates move against a quote no lender committed to | Until confirmed, repriced, or withdrawn | Open locks with no lender confirmation (F-3 residual). |
| **Rate-lock extension cost** | A file misses its lock expiry and the lender bills an extension | Until each lock expires | Confirmed locks expiring within 21 days. |

### What each one rests on

**TRID cures** carry no assumptions — the figure is a measured delta against what was actually
disclosed.

**EPO clawback** rests on the EPO window length. No executed broker agreement supplies one, so the
platform default applies and the register flags `usesAssumedWindow`. **A funded loan with no
recorded remittance is exposed but contributes $0** — it is counted in `indeterminateCount`
instead. Do not read that $0 as "no exposure".

**Honor exposure** is sized at 2 points of price, roughly a 50 bps adverse move. That is a
**scenario, not a forecast** — it exists so the exposure has a magnitude rather than a paragraph.
Note this exposure only exists on rows written before lender confirmation became mandatory; a
confirmed lock is the lender's obligation, not ours.

**Extension cost** is sized at 1.5 bps/day over 15 days. Extension pricing comes from each
executed agreement, and none exists.

> All four assumptions are ledger-tracked and must be replaced with contracted terms as
> agreements land. Until then, treat these figures as order-of-magnitude, not accounting.

---

## 2. Unquantified exposures (real, no figure here)

These are the reason the floor is a floor.

### Reg Z §1026.36 / ATR liability on defective loans
- **Trigger:** a funded loan carries a dual-compensation or points-and-fees defect.
- **Window:** life of the loan — ATR is a defense to foreclosure, so it does not age out.
- **Status:** the register **counts** exposed loans and deliberately does not price them. TILA
  statutory and actual damages require the statute and counsel, and inventing a multiplier would
  put a fabricated number on the balance sheet.
- **Who resolves it:** counsel, working from the count the endpoint reports.
- **Note:** loans funded before the compensation and QM gates landed cannot be *shown* to be free
  of the defect. That is the population to review first.

### Surety bond (state licensing)
- **Trigger:** a condition of maintaining the residential mortgage license.
- **Window:** continuous while licensed.
- **Status:** unverified. The required amount appears nowhere in the code or in
  [`docs/nmls/`](../../docs/nmls/), despite an active license and an Illinois-only footprint.
- **Who resolves it:** a human with the state statute. Not verifiable from this codebase.

### Minimum net worth (state licensing)
- **Trigger:** a condition of maintaining the residential mortgage license.
- **Window:** continuous while licensed.
- **Status:** unverified, same as above.
- **Why it matters most:** this is where the whole page converges. Every contingent exposure in
  §1 is a claim against **exactly the net worth the licence requires be maintained.** A cure and a
  clawback do not merely cost money — they can eat the capital that keeps the company licensed.
  Reserve adequacy is not "can we pay this?", it is "can we pay this and still clear the
  minimum?" That question cannot be answered until this line has a number.

---

## 3. How to use this for a reserve decision

1. Read `quantifiedFloor` from the endpoint — the measurable exposure today.
2. Read `unquantifiedCount` and the list above — what the floor excludes.
3. Read `assumptions` — which figures rest on platform defaults rather than contracts.
4. **Do not treat the floor as the reserve.** The reserve must cover the floor *plus* a counsel
   estimate for §2, *plus* the licensing minimum that must survive both.

The endpoint also returns an `actions` list: everything a human must resolve to shrink the
unquantified set. Working that list is what turns this page from an inventory into a number.

---

## 4. Provenance

Opened 2026-08-04 by the financial architecture audit
([log](../logs/2026-08-04-financial-architecture-capital-structure-audit.md), finding F-13). Each
quantified exposure became measurable only because an earlier finding was fixed — F-4 persisted
the disclosure baselines, F-8 modeled the clawback window over F-6's funding columns, and F-3 made
lender confirmation a recorded fact so an unconfirmed lock is distinguishable from a real one.

**Code:** `shared/contingentLiabilities.ts` (pure model),
`server/services/contingentLiabilityRegister.ts` (live data), tests in
`tests/contingentLiabilities.test.ts`.
