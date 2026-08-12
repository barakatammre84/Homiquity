# Session Claims — the cross-session coordination board

**Freshness:** reviewed 2026-08-12 · owner: whoever is running a session · review interval: 30 days

One page, on `main`, where a session or routine declares what it is working on **before** it
starts. Any session — agent or human, this repo's routines or an ad-hoc task — reads it first and
writes to it when it takes work.

## Why this exists, and why live-agent discovery is not enough

Between 2026-08-04 and 2026-08-12 the platform's finances were audited **nine times, once a day**,
by sessions that could not see each other. **Six of them minted findings starting at `F-20`** from
"the next free number", so `F-20` came to mean six different things (see
[financial-audit/LEDGER.md](financial-audit/LEDGER.md)). Two of those audits — 08-10 and 08-12 —
independently derived the *same four findings* two days apart, and four of the 08-12 files had
also been edited by another session: three conflicted, and one money path auto-merged silently.

The obvious fix — "check whether another session is live, and stand down if so" — **would not have
worked.** `ListAgents` was run during the collision and returned *No reachable agents*: it sees
in-process subagents and connected sessions, not another cloud session that already merged. The
mechanism that failed was not politeness; it was **visibility**.

So coordination here runs through artifacts every session can actually observe:

1. **`origin/main`** — commits and open PRs. Always true, never stale, no cooperation required.
2. **This board** — intent, which `main` cannot show until work lands.
3. **Live messaging** (`ListAgents` / `SendMessage`) — a *bonus* when agents are reachable, never
   the primary signal.

A claim is a courtesy that costs one commit. It is not a lock: nothing enforces it, and a stale
claim must never block real work (see Expiry).

## Protocol

**Before starting non-trivial work:**

1. Read this board and `git log --oneline origin/main -20`.
2. Check open PRs for files you expect to touch. **A file with an open PR against it is claimed by
   that PR**, board entry or not — that signal is stronger than this page.
3. If your work overlaps a live claim, pick the graduated response:
   - **No overlap** → proceed; add your claim.
   - **Adjacent** (same area, different files) → proceed, add your claim naming the adjacency, and
     keep your diff inside the files you listed.
   - **Direct overlap** (same files or same finding-id space) → do **not** race. Prefer different
     work. If the work must happen, coordinate: `SendMessage` if the session is reachable,
     otherwise leave a note in the Notes column and let the owner sequence it.
4. **Use ids that cannot collide.** Finding ids are date-qualified — `F-<MMDD>-<NN>`, using your
   audit's own date (`F-0812-01`) — never a bare next-free integer. Six of the nine financial
   audits minted `F-20` from "next free" and it now means six different findings. Date
   qualification needs **no register and no visibility**, which is exactly why it survives the
   case where sessions cannot see each other. (Ids predating the scheme, `F-1`…`F-19`, keep their
   original form: single origin, no ambiguity.)

**When you finish or abandon:** remove your row in the same PR as the work. A board nobody clears
becomes a board nobody reads.

## Expiry — a stale claim is not a lock

A claim older than **7 days** with no corresponding open PR or commit is dead. Anyone may delete it
and take the work; say so in the commit. Sessions end abruptly and cannot always clean up after
themselves, so the board must degrade toward "available", never toward "blocked forever".

## Active claims

| since | session / routine | scope — files or area | branch / PR | notes |
|-------|-------------------|------------------------|-------------|-------|
| 2026-08-12 | `/financial-audit` (weekly) | money paths: `shared/compensation*`, `shared/costLedger.ts`, `shared/rateLockConfirmation.ts`, `shared/wholesaleLenders.ts`, `server/services/contingentLiabilityRegister.ts`, `server/routes/rate-sheets.ts`, `server/routes/borrower/rateLocks.ts`, `client/src/pages/admin/{FinancialReports,Lenders}.tsx` · finding ids `F-0812-*` (date-qualified — no reservation needed) | `claude/fervent-mayer-oqk0iv` | Reads-and-reports by default; fixes only owner-authorized ledger rows, one per tick. Will not touch `client/**` UI decomposition — that is refactor-radar's lane. |

## Observed in flight — not declared by their sessions

Recorded by the `/financial-audit` tick on 2026-08-12 from open PRs and recent branches, because
a board showing only the one session that bothered to write in it is worse than no board: it reads
as "nobody else is working" when the opposite is true. **These sessions did not claim this work** —
this is observation, and it may be stale. Verify against open PRs before relying on it.

| observed | session / branch | scope | overlap with financial-audit |
|---|---|---|---|
| 2026-08-12 | ~~[#489](https://github.com/barakatammre84/Homiquity/pull/489) `docs/financial-audit-chain`~~ **merged 19:57** | Landed four stranded financial audit logs (08-07, 08-09, 08-10, 08-11) | Resolved. Was direct overlap — same domain and same id space; coordinated by comment rather than by editing another session's branch. Its 08-10 log near-duplicates the 08-12 audit. |
| 2026-08-12 | [#490](https://github.com/barakatammre84/Homiquity/pull/490) `claude/pensive-noether-5232f2` | Borrower data-capture defects | None observed |
| 2026-08-12 | [#488](https://github.com/barakatammre84/Homiquity/pull/488) `feat/lease-capture` | Rent-ledger lease capture, encrypted PII columns | Adjacent — touches `shared/schema/**`; watch for migration ordering |
| 2026-08-12 | [#483](https://github.com/barakatammre84/Homiquity/pull/483) `fix/partnerhub-cpa-gate-drift` | CPA PartnerHub role gate | None observed |

## Standing lanes — who owns what by default

Recorded so routines do not have to negotiate the common case every time.

| routine | lane | stays out of |
|---------|------|--------------|
| [`/refactor-radar`](../.claude/skills/refactor-radar/SKILL.md) (weekly) | `client/src/**` UI-vs-logic extraction, behaviour-preserving | `server/**`, `shared/` money modules, anything with a live finding |
| [`/financial-audit`](../.claude/skills/financial-audit/SKILL.md) (weekly) | money paths + the financial registers; audit-first | `client/src/**` decomposition, `shared/schema/**` without a migration, company identity |
| feature-review agents | domain review, findings register | fixing anything (they report; they never fix) |

**Known shared-file hazards** — both routines legitimately touch these, so expect conflicts and
resolve additively rather than overwriting:

- `vitest.config.ts` — the node-lane `include:` array (both add test files).
- `knowledge-base/README.md` — the doc index (both add entries; keep both, in date order).
- `tests/__snapshots__/zod-schema-semantics.json` — re-recorded by any schema change. **Never take
  one side wholesale**: re-record it after merging and re-read every delta.
