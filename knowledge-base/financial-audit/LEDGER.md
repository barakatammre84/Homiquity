# Financial Audit — Ledger

The cross-run memory of the `/financial-audit` routine
([`.claude/skills/financial-audit/SKILL.md`](../../.claude/skills/financial-audit/SKILL.md)).
Every tick reads this file **before** choosing work (rail R2) and updates it in the same PR
as the change it describes. Ids are `F-###` in discovery order and are **never reused** —
they are the same ids the dated audit logs cite.

Seeded 2026-08-12 from the three audits to date, at `origin/main` @ `2444950`:
[2026-08-04](../logs/2026-08-04-financial-architecture-capital-structure-audit.md) ·
[2026-08-05](../logs/2026-08-05-financial-architecture-reaudit-qm-loan-size-floor.md) ·
[2026-08-12](../logs/2026-08-12-financial-architecture-reaudit-counterparty-integrity.md).

## Status vocabulary

- `open` — a verified finding, not yet authorized for a fix. **The routine reports it; it
  does not fix it.** Discovery is not permission (R7).
- `authorized` — the owner has approved a fix. Only these are eligible for Phase 2, one
  per tick.
- `in-pr` — a fix PR is open (URL in evidence). Not re-picked.
- `done` — fixed and merged, or verified resolved (date + evidence).
- `blocked-human: <reason>` — needs an owner decision, counsel, or a document this
  environment cannot fetch. The routine only annotates these.
- `blocked-collision: <PR#>` — another session has an open PR touching the same files
  (Phase 0.4). Re-evaluate once that PR lands.
- `sound` — audited and found correct. Recorded so it is not "re-discovered" as a defect,
  and so a regression is visible as a *change* from sound.
- `failed: <reason>` — a fix attempt was discarded. Needs the reason addressed first.

## Open — the routine reports these, and fixes none of them without authorization

| id | area | sev | summary | status | evidence |
|----|------|-----|---------|--------|----------|
| F-9 | risk | Medium | Third-party fee constants are unsourced national guesses in a **zero-tolerance** bucket. Architecture fixed (provenance tiers, `suspectedInaccurate` on transfer taxes); the **values** remain `platform_estimate`. Illinois transfer tax is levied at state, county AND municipal level against a single 0.1% national constant | `blocked-human`: needs a human with the Illinois statute — `ilga.gov`, `tax.illinois.gov`, `chicago.gov` are all blocked from this environment | `shared/compliance/feeProvenance.ts`; ledger `platform-closing-cost-fee-schedule` (30-day interval) |
| F-14 | capital efficiency | Escalation | Broker vs. mini-correspondent. One constant, and the largest unanswered question about the capital structure: under correspondent, F-16 dies, a warehouse line becomes necessary, duration mismatch becomes real, and the contingent-liability register is materially incomplete | `blocked-human`: founder decision | [CHANNEL_DECISION.md](../governance/CHANNEL_DECISION.md); `shared/businessChannel.ts`; freeze guard holds 1,482 lines at baseline |
| F-17 | unit economics | High | The QM dead band was resolved in code (fees now trim to fit), but the **business lever** remains: at ~300 bps compensation alone exceeds the cap and no fee reduction rescues the file. Fees are no longer the constraint at any loan size; the comp plan is | `blocked-human`: a negotiation, not a code change | [2026-08-05 log](../logs/2026-08-05-financial-architecture-reaudit-qm-loan-size-floor.md) §Resolution |
| F-24 | balance sheet | Medium | **Minimum net worth and surety bond are unquantified**, so reserve adequacy cannot be answered — every contingent exposure is a claim against exactly the net worth the licence requires be maintained. Verified 2026-08-12 that the local NMLS guidebook (Ch. VII, pp. 120/122) is filing mechanics only and defers the amount to state law. Structural note: the requirement is the **most stringent state in the footprint**, so multi-state expansion moves the floor *discontinuously* — an expansion plan's licensing line is a `max()`, not a sum | `blocked-human`: needs the Illinois RMLA statute | [CONTINGENT_LIABILITY_REGISTER.md](../governance/CONTINGENT_LIABILITY_REGISTER.md) §2 |
| F-25 | risk | Low | Reg Z readings shipped ahead of verification (dual compensation §1026.36(d)(2), points-and-fees §1026.32(b)(1)(ii), the §1026.4(a)(3) finance-charge question, the tax-service-fee classification, LE Section C tolerance tier). All are conservative in one direction only, and all carry short review intervals so `pnpm checkup` goes loud | `blocked-human`: `docs/reg-z/` holds no authoritative source text; every federal host is blocked | `data/regulatory/regulatory-ledger.json`; [docs/reg-z/README.md](../../docs/reg-z/README.md) |
| F-26 | balance sheet | Low | The clawback register quantifies exposure but **does not monitor for actual payoffs** — nothing tells the platform a loan paid off, so `totalAtRisk` is exposure, never realized loss. EPD (early-payment-default) repurchase provisions are also unmodeled | `open` | `shared/compensationClawback.ts`; noted in the F-8 remediation |
| F-27 | unit economics | Medium | Gross margin is an **upper bound** and says so: loan-officer compensation, processing labour and overhead allocation are modeled nowhere, so the cost side is direct vendor spend only | `open` | `shared/costLedger.ts` `computeUnitEconomics` notes |

## Closed — recorded so they are not re-discovered, and so a regression reads as a change

| id | summary | status |
|----|---------|--------|
| F-1 | Dual-compensation transaction on every file (Reg Z §1026.36(d)(2)) | `done` 2026-08-04 — comp model is a required input; lender-paid ⇒ borrower-paid origination is zero |
| F-2 | QM points-and-fees cap structurally unenforced, failing open | `done` 2026-08-04 — three-valued verdict off a computed floor; never passes on missing evidence |
| F-3 | "Phantom lock" — rate commitments with no lender-side lock | `done` 2026-08-04 — confirmation fields required (see also F-20, which fixed what "confirmed" *means*) |
| F-4 | Zero-tolerance cure liability unmodeled and untracked | `done` 2026-08-04 — immutable `loan_estimate_disclosures` baseline + tolerance engine |
| F-5 | Counterparty capacity zero, and submission did not check | `done` 2026-08-04 — `evaluateLenderSubmissionEligibility`; hardened by #417's fail-closed `approval_status` |
| F-6 | No revenue, receivable, or compensation representation | `done` 2026-08-04 — two-sided comp lifecycle; funding requires the money |
| F-7 | LE Section A omitted its largest line from the itemization | `done` 2026-08-04 |
| F-8 | EPO/EPC clawback exposure unrepresented | `done` 2026-08-04 — register + the refi-alert self-attack guard |
| F-10 | Lock-extension fee had no payer attribution | `done` 2026-08-04 |
| F-11 | No cost side, unmetered vendor COGS, pull-through unmeasurable | `done` 2026-08-04 — `loan_cost_entries` + unit economics |
| F-12 | Reg Z Total Loan Amount stand-in erred permissive | `done` 2026-08-04 |
| F-13 | No contingent-liability register; reserve adequacy unassessable | `done` 2026-08-04 — `quantifiedFloor`, never called a total |
| F-15 | RESPA §8 discipline — referral spines carry no payout columns **by design** | `sound` — preserve verbatim; the pressure to add a partner payout field will arrive |
| F-16 | Asset-light structure is correct; no money movement anywhere | `sound` — re-verified 2026-08-12. **F-14 is the one thing that would invalidate it** |
| F-18 | QM constraint evaluated after its own remedy expired | `done` 2026-08-05 — evaluated at the compensation election |
| F-19 | Tax service fee counted in the QM denominator but not the numerator | `done` 2026-08-05 — one `PLATFORM_FINANCE_CHARGES` list feeds both |
| F-20 | "Confirmed" was a presence test, not a counterparty test — a lock against a fictional lender booked as the lender's obligation, and the register priced it at $0 | `done` 2026-08-12 |
| F-21 | Revenue ledger simulation-blind while the cost ledger beside it was simulation-aware — margin subtracted real cost from imaginary revenue | `done` 2026-08-12 |
| F-22 | Lender authorization writable through the generic PATCH, audited by field name only | `done` 2026-08-12 — audited approval endpoint; columns off the generic write path |
| F-23 | `epoClawbackDays` had no write surface, pinning the reserve to an assumed window | `done` 2026-08-12 — captured at approval, corrected via contract-terms; plus `/admin/lenders` |

## Standing signals — where findings keep coming from

Recorded because three audits found the same *shapes*, not the same bugs:

1. **A shared rule with exactly one consumer.** Every 2026-08-12 finding traced to
   `evaluateLenderSubmissionEligibility` having one caller while three other money paths
   re-derived counterparty truth permissively. When a rule is extracted, grep every
   surface that should consume it.
2. **The measurement fails in the same direction as the defect.** The lock-honor line
   reported $0 for exactly the exposed locks (F-20); the revenue roll-up counted the
   simulated fundings it existed to distinguish (F-21). Audit the register, not only
   the mechanism.
3. **A column written but never read.** `simulated` was populated correctly for a week
   and consumed by no financial computation (F-21). `grep` for readers, not writers.
4. **A capability with no surface.** The approval endpoint, and `epoClawbackDays`, existed
   with no UI — so the only way to use them was a direct DB write (F-22/F-23). See
   [UNCONSUMED_CAPABILITIES.md](../governance/UNCONSUMED_CAPABILITIES.md).
5. **Asymmetric discipline between siblings.** The cost ledger was scrupulous about
   simulation while the revenue ledger beside it was blind. When one module is careful,
   check its neighbour.

## Run log

| tick | base | mode | outcome |
|------|------|------|---------|
| 2026-08-12 | `2444950` | audit + fix | F-20…F-23 found, verified by execution, and fixed under owner authorization; `/admin/lenders` built; routine installed |
