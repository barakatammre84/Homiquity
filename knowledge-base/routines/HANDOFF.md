# Hand-off board

**The team's shared queue.** Rules live in [`TEAM.md`](TEAM.md) §4. This file is the board.

**This is not the claim lock.** Claim files in [`REGISTER.md`](REGISTER.md) before writing them;
hand off *work* here. A seat doing both writes in both places.

## How to use it

1. **Append under your block.** Four types: `DECISIONS` (Domain Oracle) · `ASKS` (Integration
   Readiness) · `VERDICTS` (QA Mutation Verifier) · `WAITING` (any seat).
2. **Every row names its next seat.** "Needs review" with no owner is a wish, not a hand-off.
3. **A `WAITING` row jumps the queue** of the seat it names. Blocking a peer is worse than a slow
   day.
4. **Clear your own rows** when the hand-off completes — in the same PR as the work, and move the
   row to *Recently cleared* with its outcome. A board nobody clears becomes a board nobody reads.
5. **Date every row.** UTC. A row older than 14 days with nothing behind it is dead; take the work
   or delete it, and say which in your report.

Humans use this board too. A founder decision that unblocks a seat belongs here, not only in chat.

---

## WAITING

| since (UTC) | blocked seat | waiting on | what is needed |
|---|---|---|---|
| 2026-08-18 | Complex File Engine | **Domain Oracle** | **One ask, four findings — the Selling Guide income chapter (B3-3.1-09).** `docs/fannie-mae/` holds income references for self-employment and rental **only**, and that single absence blocks: `CF-0818-02` capital-gains income (detected at `situationClassifier.ts:180-185`, computed by no path) · `CF-0819-02` non-taxable **gross-up** (absent — under-qualifies Social Security / Disability / VA borrowers) · `CF-0819-03` **continuance** (absent — can over-qualify alimony and child support) · `CF-0819-04` **asset depletion** (no path at all). ⚠️ Each rule is **flagged, not asserted** — no in-repo text exists to verify any of them. Needs the document, then a ledger citation; the catalog's colocated test then fails any citation naming a file not on disk. **The classification prerequisite is already shipped** (`CF-0819-01`), so each is a one-entry change once the authority lands. |
| 2026-08-18 | Complex File Engine | **Integration Readiness** → founder | `CF-0818-03` — the Angel Oak **DSCR minimums by LTV/FICO** and **deposit-eligibility rules** are portal-gated and not in-repo, so the `dscr` and `bank_statement` paths compute no figure (`paths/dscr.ts:128-132`, `paths/bankStatement.ts:142-147`). A vendor-edge ask: obtain the current matrices from the AE. **Do not soften the block** — a wrong non-QM number cannot be recalled from a lender package. |

## DECISIONS — from the Domain Oracle

| date (UTC) | scenario | verdict | citation | next seat |
|---|---|---|---|---|
| — | — | — | — | — |

## ASKS — from Integration Readiness

| date (UTC) | adapter | stage | the ask | next seat |
|---|---|---|---|---|
| — | — | — | — | — |

## VERDICTS — from the QA Mutation Verifier

| date (UTC) | merged fix | verdict | evidence | next seat |
|---|---|---|---|---|
| — | — | — | — | — |

---

## Recently cleared

Keep the last ~15 rows for forensics; trim older ones freely. A cleared row records what actually
happened, not that it was tidied away.

| date (UTC) | row | outcome |
|---|---|---|
| 2026-08-18 | board created | Opened with [`TEAM.md`](TEAM.md) and the three new seats. Empty is the correct initial state — a board seeded with invented rows would be the first thing to mislead a reader. |
