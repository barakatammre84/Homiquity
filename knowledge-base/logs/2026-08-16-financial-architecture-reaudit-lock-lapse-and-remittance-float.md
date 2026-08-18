# Financial Architecture Re-Audit — What Happens After the Deadline Passes — 2026-08-16

**Scope:** the standing four areas — capital flow & liquidity, risk & liability, unit economics,
balance sheet — re-run against HEAD (`1f520b1`), two days after the
[2026-08-14 propagation pass](./2026-08-14-financial-architecture-reaudit-revenue-fix-propagation.md).

**Method:** diff-driven first, then the ledger's own
[standing signals](../financial-audit/LEDGER.md#standing-signals--where-findings-keep-coming-from).
Findings 1 and 2 were confirmed by **executing the repository's own functions** against
constructed rows (rail R6). Finding 3 is a measurement *absence* and is verified by exhaustive
grep rather than execution — it is labeled accordingly. Ids are date-qualified: `F-0816-01` …
`F-0816-03`.

**`main` has not moved since the 08-14 audit branched from it**, so the diff-driven pass had a
literally empty input. That is itself worth recording: thirteen PRs are open, one of them this
routine's own audit record ([#520](https://github.com/barakatammre84/Homiquity/pull/520), open
since 08-14). This pass therefore ran on a question the prior eleven audits had not asked.

## The question this pass asked

Every prior audit checked whether a money-bearing rule fires **at the right moment**. This one
asked what the platform believes **once the moment has passed** — after a lock's expiry date,
after funding but before the wire. Both answers turn out to be the same shape:

> **The platform stops measuring an exposure at exactly the point the exposure becomes real.**

A lock that has lapsed is dropped from the liability register because it carries "no forward
commitment". Cost on a file that has funded is dropped from working capital because the file is
"recovered" — though no cash has arrived. In both cases the number goes **down** as the position
gets **worse**, which is standing signal #2 (*the measurement fails in the same direction as the
defect*) recurring for the third audit running.

---

## Severity-ordered summary

| id | Finding | Area | Severity |
|---|---|---|---|
| `F-0816-01` | A confirmed lock **past its expiry** on a file that has not closed is dropped from the contingent-liability register entirely. The register's lock exposure is keyed on dates alone and never on the file's lifecycle state, so it is wrong in **both** directions — it drops lapsed locks on live files, and counts locks on files that have already funded | Balance sheet / Capital flow | **High** |
| `F-0816-02` | Committed working capital excludes every file that has **funded but not been remitted** — the exact cohort the figure exists to size. On a steady-state book the understatement is ~47%, and it makes the Little's-Law projection internally inconsistent: the cost base excludes a period the duration explicitly includes | Capital flow / Liquidity | **High** |
| `F-0816-03` | **Counterparty concentration is measured nowhere in dollars.** `lenderId` is carried on every submission and every clawback entry, but no surface aggregates exposure, funded volume or revenue by counterparty | Risk & liability | Medium |
| — | Revenue recognition on `GET /api/reports/compensation` — both channels reach the margin | Unit economics | ✅ verified sound |
| — | F-16 asset-light structure; no custody, no warehouse line, no payment rail | Capital flow | ✅ holds (re-verified 08-14) |

---

## `F-0816-01` — the register stops counting a lock the moment it lapses

**Area:** balance sheet / capital flow · **Severity:** High

### The architectural problem

`server/services/contingentLiabilityRegister.ts:123` reads:

```ts
if (expiresAt <= now) continue; // already expired: no forward commitment
```

The comment is half right and the conclusion does not follow from it. "No forward commitment"
is true — the **lender** no longer owes us a rate. But the register exists to measure what
**we** owe, and a lapsed lock is precisely when our own obligation crystallises: the file still
has to close, the rate has to come from somewhere, and it now comes from today's market.

The register's own `lock_extension` entry already states who pays:

> "Falls on the broker unless passed through with a changed circumstance, which is why the
> extend endpoint records a payer."

So the platform has the doctrine written down. It applies it to locks that are *about* to lapse
and drops the ones that already have.

Two facts make this reachable rather than theoretical:

1. **Expiry is computed, not stored.** `shared/statusVocabularies.ts:17-21` is explicit — *"an
   expired lock keeps its last status, so 'open' checks must pair `OPEN_RATE_LOCK_STATUSES`
   with an `expiresAt` comparison where staleness matters."* So `getOpenRateLocks()` returns
   lapsed rows still marked `active`/`extended`, and line 123 discards them.
2. **Nothing else is watching.** `getExpiringRateLocks` filters `gte(expiresAt, now)` —
   also future-only. `runRateLockAlertSweep` (`server/services/rateLockAlerts.ts`) notifies
   within 7 days *before* expiry, **deduplicated to one notification per lock, ever**
   (`:36-48`). After the date passes there is no alert, no register entry, and no report. The
   lock goes quiet at the moment it becomes a cost.

The lock is still extendable after lapsing — `POST /api/rate-locks/:id/extend` checks only that
the status is open and the new date is forward (`:298-335`) — so the money path is live; it is
the *measurement* that stops.

### Executed evidence

Three confirmed locks ($400k each, same approved lender), on files that have not closed. Run
through the register's own loop and `buildContingentLiabilityRegister`:

```
=== isLenderConfirmed (repo function) on each row ===
  expiring-in-10d    confirmed=true  status=active  expiresAt=2026-08-26
  EXPIRED-3d-ago     confirmed=true  status=active  expiresAt=2026-08-13
  EXPIRED-20d-ago    confirmed=true  status=active  expiresAt=2026-07-27

=== SHIPPED register: lock_extension entry ===
  count=1  amount=$900        quantifiedFloor=$900

=== COUNTERFACTUAL: identical book, none past expiry ===
  count=3  amount=$2700       quantifiedFloor=$2700
```

All three rows are confirmed locks on open files. The book where **two of the three have
lapsed** reports **$900**; the healthy book reports **$2,700**. The worse position produces the
smaller reserve, and it does so silently.

### The second direction

The same loop has no access to the file's lifecycle state at all — its only input is the lock
row. And **funding never closes a lock**: the only two writers of `rateLocks.status` are the
extend endpoint (`→ extended`) and a manual staff cancel (`→ cancelled`,
`server/routes/borrower/rateLocks.ts:429`). Nothing in `lenderSubmission.ts` touches a lock.

So a file that funded last week keeps an `active` lock, and if that lock expires inside the
21-day window it is counted as live extension exposure on a loan that has already closed. That
error is conservative — it overstates the liability — which is why it is reported here rather
than raised as its own finding. But it has the same cause: `RegisterInputs.locks` is documented
as *"Confirmed locks expiring soon on files not yet closed"* (`shared/contingentLiabilities.ts:92`)
and the implementation never checks whether the file closed.

### Quantification

At the register's own constants — `ASSUMED_EXTENSION_BPS_PER_DAY = 1.5`,
`ASSUMED_EXTENSION_DAYS = 15` — a lapsed $400k lock drops **$900** of exposure to zero. Two of
them drop $1,800. The figure scales linearly with lapsed loan volume: **$900 per $400k of
lapsed, unclosed lock volume**, or 22.5 bps.

That is a **floor**, and deliberately so. The extension constant prices a lock that is
*extended before it lapses*. A lock re-priced after expiry is generally re-locked at the worse
of the original and current market. Sizing that requires an executed broker agreement, which
does not exist (ledger: `platform-lock-extension-bps-per-day`), so no number is asserted for it
here — only the direction, which is that the true cost is higher than the floor, never lower.

### Structural fix

Give the lapsed cohort its own register entry rather than folding it into `lock_extension` —
they are different obligations with different windows and different triggers:

- Partition the loop into `expiringSoon` (confirmed, unexpired, inside the cutoff) and
  **`lapsed`** (confirmed, `expiresAt <= now`, file not closed), and add a `lock_lapsed`
  category to `EXPOSURE_CATEGORIES` whose trigger is *"a lock expired before the file closed
  and the rate must be re-established at market"*.
- Pass the file's lifecycle state into the loop so both buckets exclude closed files. The
  register already loads `getAllLenderSubmissions()` at `:50` — the funded set is one `Set`
  away and needs no new query.
- Size `lock_lapsed` at the extension floor and flag it `assumptions: [...]` in the same style
  as its siblings, so it reads as a floor rather than a reserve.
- Extend the alert sweep past expiry, or add a lapsed-lock action to `actions[]`. A lock that
  lapses on a live file is an operational event nobody is currently told about.

This is conservative in the permitted direction (R8): it raises a reserve and tightens a
measurement. It creates no borrower charge.

---

## `F-0816-02` — working capital excludes the float it exists to measure

**Area:** capital flow / liquidity · **Severity:** High

### The architectural problem

`shared/costLedger.ts:216-223` defines the input contract:

> `unrecoveredCost` — "Cost entries, already filtered to files that **have not reached cash**."

and the module header (`:190-213`) states the purpose exactly:

> "costs are incurred at application, and revenue arrives after funding — **later still, once
> the lender's wire lands**. The company funds that gap out of its own cash, and nothing said
> how much."

The only caller filters on something else. `server/routes/underwriting/submissions.ts:486-497`:

```ts
const fundedApplicationIds = new Set(
  submissions.filter(s => s.status === "funded").map(s => s.applicationId),
);
...
if (fundedApplicationIds.has(entry.applicationId)) continue;
```

`status === "funded"` is not "reached cash". Between those two events sits the lender's
remittance — the gap the whole module was written to size. A file that funded and has not been
wired is treated as recovered, so its cost leaves the working-capital figure at the moment the
company starts carrying it longest.

### Executed evidence

A steady-state book: 10 files in process, 9 funded-but-unremitted, 5 funded-and-paid, vendor
cost $500/file (a labeled scenario operand — the platform holds no cost-per-file constant).
Run through the repo's own `computeWorkingCapitalPosition`:

```
=== AS SHIPPED (route filters on status === 'funded') ===
  committed = $5000    committedFileCount = 10

=== BY THE MODULE'S OWN CONTRACT ('have not reached cash') ===
  committed = $9500    committedFileCount = 19

  UNDERSTATEMENT = $4500 across 9 file(s) — 47.4% of the true committed working capital
```

### Why it compounds

`committed` is described in the module as **MEASURED**, in contrast to the Little's-Law
`projectWorkingCapital()` beside it, which is a projection. That contrast is the reason a reader
trusts `committed` — and it is the figure that is wrong.

Worse, the two halves of the projection now disagree about what period they cover.
`daysToCash` is defined in `shared/cycleTimeReport.ts:88-95` as
`cycleTime (created→funded) + remittanceLag (funded→remittance)` — it **explicitly spans through
the wire**. So `projectWorkingCapital(filesStartedPerMonth, costPerFile, daysToCash)` multiplies
a cost base that **excludes** the funded→remittance cohort by a duration that **includes** the
funded→remittance period. The C and the D in `F × C × (D/30)` are measured over different
windows.

This is also the sibling of `F-0814-04` (the remittance timestamp is stamped equal to `fundedAt`,
so the lag reads as a fabricated zero) and the two conceal each other: with the lag reading zero,
the excluded cohort looks empty, so the filter's error is invisible. **Fixing `F-0814-04` alone
would make this finding worse**, not better — a real 13-day lag would populate a cohort that this
filter then discards. They should be promoted together.

### Quantification

The understatement is `(files funded but unremitted) × (vendor cost per file)`. At the 08-14
audit's own operands — 20 files/month, a 12–14 day remittance lag — roughly **9 files sit in that
state at any time**, so the committed figure is short by 9 × cost-per-file continuously. As a
share it is ~47% of true committed working capital on the book modeled above. The dollar figure
depends on a cost-per-file the platform does not yet hold; the **share** does not.

### Structural fix

Filter on cash, not on status — the column already exists and is already read elsewhere:

```ts
const paidApplicationIds = new Set(
  submissions
    .filter(s => s.status === "funded" && s.compensationReceivedAt != null)
    .map(s => s.applicationId),
);
```

Better, and in the spirit of the ledger's standing signal #1: this predicate ("has this file
reached cash?") is now needed by the working-capital filter, the cycle-time report and the
revenue-recognition path. It should be **one exported function in `shared/`**, not a third
inline re-derivation. The last three audits have each found a money rule re-derived at a second
call site; this is the chance to not create the next one.

Conservative in the permitted direction (R8): it raises a measured cash requirement.

---

## `F-0816-03` — counterparty concentration has no dollar measure

**Area:** risk & liability · **Severity:** Medium ·
**Verification: absence, by exhaustive grep — not executed.** Labeled as such per R6.

### The architectural problem

Concentration is currently visible in exactly two forms, both of them **counts**, and both at
the compliance layer rather than the financial one:

- `approvedLenderCount()` (`shared/wholesaleLenders.ts:76`), surfaced on the admin stats panel
  and the compensation report.
- `singleCreditor` on the anti-steering option set
  (`server/services/antiSteeringOptions.ts:85-100`), which exists to answer a Reg Z
  §1026.36(e)(3)(i) safe-harbor question and says so.

Neither answers the balance-sheet question: **how much of our exposure, volume and revenue sits
with one counterparty?** A grep across `server/`, `shared/` and `client/src` for concentration,
Herfindahl/HHI, or any per-lender aggregation of dollars returns nothing — the only two hits are
the anti-steering comment above and an unrelated borrower credit-mix goal.

The data is all there and carried deliberately: `lenderId` is on every `lender_submissions` row
and on every clawback entry (`shared/compensationClawback.ts:70`). Nothing groups by it.

### Why it matters here specifically

The contingent-liability register has no counterparty dimension at all. Every exposure on it —
EPO clawback, lock honor, lock extension, and the lapsed-lock exposure `F-0816-01` would add —
is an obligation *to a specific lender*, and the register presents them as one undifferentiated
pool. So the question a CRO asks first ("if our largest counterparty exits wholesale, lapses its
approval, or disputes a remittance, what fraction of the book moves?") cannot be answered from
any surface.

This is not hypothetical for this business: the platform's own design target is the **Target-5**
wholesale lender catalog, and the most recent audit to check the live count — 08-12, via the
`F-0807-01` anti-steering fix — recorded the number of approved creditors the company does
business with as **zero**. (Not re-checked here: it is a database fact, and this environment has
no read path to prod.) Concentration risk at N=1 or N=2 approved lenders is therefore not a tail
scenario — it is the launch configuration, and the state the business will be in for its first
funded loans.

### Structural fix

Add a counterparty dimension to the register rather than a new report:

- Group the computed entries by `lenderId` and emit a `byCounterparty` breakdown alongside
  `entries`, plus the single number worth alerting on — **largest counterparty share of
  `quantifiedFloor`**.
- Do the same for funded volume and recognized revenue on the compensation report, where the
  submissions are already in hand.
- Report it as a share, never a threshold. What counts as "too concentrated" is a policy
  decision for the owner and belongs in
  [CONTINGENT_LIABILITY_REGISTER.md](../governance/CONTINGENT_LIABILITY_REGISTER.md), not in a
  constant chosen here.

No regulatory reading is asserted. The §1026.36(e)(3)(i) sufficiency question stays where it is,
at the anti-steering module, unchanged.

---

## Verified sound this pass

**Revenue recognition reaches the margin on the reports route.** `F-0814-02` established that
`getAdminStats` neither selects `compensationModel` nor calls `recognizeRevenue`. The obvious
next question is whether the *fixed* surface completes the circuit — a two-channel revenue figure
is worth nothing if the margin computation beside it still receives one channel. It does not:
`submissions.ts:466-473` passes `receivedCompensation: revenue.total`, both channels, into
`computeUnitEconomics`, with the reason in a comment. **No finding.** Recorded so the next audit
does not re-walk it.

**F-16 asset-light structure** was re-verified by direct grep on 08-14 and is not re-derived
here. No payment rail, no warehouse line, no custodial or trust account, no loans held for sale.
Under the broker channel there is no duration mismatch, no borrower funds in custody, and no
funding-delay risk borne by the company. **F-14 (broker vs. mini-correspondent) remains the one
decision that would invalidate all of it** — and note that `F-0816-01` and `F-0816-02` both get
materially larger under a correspondent model, where the company would carry the loan itself.

---

## Unchanged and owner-blocked

`F-9` (Illinois transfer-tax values) · `F-14` (channel decision) · `F-17` (comp plan vs. the QM
cap) · `F-0812-05` (minimum net worth — needs the Illinois RMLA statute) · `F-0812-06` (Reg Z
readings ahead of verification; every authoritative host is blocked from this environment).

**Still open from 08-14 and not re-derived here:** `F-0814-01` … `F-0814-04`, all four awaiting
promotion on [#520](https://github.com/barakatammre84/Homiquity/pull/520).

## Suggested promotion order

1. **`F-0816-02` together with `F-0814-04`.** They are the same seam — funding is not cash — and
   fixing the remittance timestamp without fixing the filter makes the working-capital figure
   worse rather than better. One change, one shared `hasReachedCash()` predicate.
2. **`F-0816-01`.** Self-contained, conservative, and the register already loads every operand
   it needs.
3. **`F-0816-03`.** Additive measurement; no existing number changes.

All three are conservative in the one permitted direction (R8): each raises a reserve or a
measured cash requirement. None creates a borrower charge, and none rests on a regulatory
reading.
