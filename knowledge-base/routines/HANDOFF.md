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
| — | — | — | *(empty — the board opens with the routines that write to it)* |

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
