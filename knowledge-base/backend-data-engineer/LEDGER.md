# Backend Data Engineer — ledger

**Owner:** the `backend-data-engineer` routine (rows added by it or the founder).
**Freshness:** seeded 2026-08-18 — every row is a claim about the day it was written; re-verify
with `git log -S '<symbol>' -- <path>` before building (routine rail R10, CHARTER §10).

Cross-run memory for [`/backend-data-engineer`](../../.claude/skills/backend-data-engineer/SKILL.md),
the Phase 2 queue source (d). The routine has no memory of any prior run; this file is the memory.

**Rules.** Every row carries a source cite or it is invalid. A row fixed elsewhere is closed with a
pointer, never rebuilt. A row marked `refused` or `blocked-human` is **not re-attempted** by a later
run — `refused` rows in particular are the record of a MISMO mapping that could not be verified
against `docs/fannie-mae/` or the Loan Delivery job aid, and re-deriving one from memory is exactly
the fabrication rail R5 forbids. Only the founder reopens a `refused` row.

**Status vocabulary:** `open` · `shipped (PR #)` · `blocked-human (why)` · `refused (why)` ·
`superseded (by what)`.

| id | target | source | rank note (§1 / §1a) | status |
|---|---|---|---|---|
| — | *(seeded empty; the first run fills it from its Phase 0 upstreams)* | — | — | — |

## Refusal record

A MISMO data point name, enumeration, XML container path, edit code or Special Feature Code that
could not be verified stays here permanently, with what was searched and what was not found. This
section is append-only.

_(empty)_
