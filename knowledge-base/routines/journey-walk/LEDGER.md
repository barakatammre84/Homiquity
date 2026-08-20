# Client Journey Walk — rotation ledger

Cross-run memory for the `client-journey-walk` seat (daily since 2026-08-19). One persona per run,
**strict rotation 1 → 2 → 3 → 4 → 1**. A fresh session reads this file to know where to resume.

Charters: the persona summaries in the routine's `SKILL.md` are authoritative **until
`knowledge-base/feature-review/JOURNEYS.md` lands on `origin/main`** (founding PR #607), at which
point that file wins. Record which source each run used.

## Rotation state

| next run walks | persona | account convention |
|---|---|---|
| **→ Journey 2** | Active buyer, W-2 salaried | fresh `/signup` as `jw2+<MMDD>@test.local`; starts `aspiring_owner`, **must end `active_buyer`** |

## Run history

| date | journey | source used | server (commit) | verdict | report |
|---|---|---|---|---|---|
| 2026-08-20 | **1 — Aspiring owner** | SKILL.md summaries (JOURNEYS.md absent from `origin/main`) | `b799b91d` (`origin/main`) via a dedicated worktree on :5001 | **WARN** — 2 data-correctness defects, 1 mobile-unreachable surface, 10 tickets | [2026-08-20-journey-walk.md](../reports/2026-08-20-journey-walk.md) |

## Standing notes for the next walker

- **Do not use `preview_start {name}`.** It boots the *primary checkout*, which is routinely on a
  peer's feature branch with uncommitted files. Add a worktree at `origin/main`, `pnpm install`,
  copy `.env`, run `pnpm dev`, and verify the process with `lsof -a -p <pid> -d cwd`.
- **The browser pane may arrive with a stale session cookie.** `POST /api/auth/logout` before any
  anonymous leg, and assert `/api/auth/user` returns 401. (The user endpoint is `/api/auth/user`;
  `/api/auth/me` is a 404.)
- **`mcp__Claude_Browser__computer left_click` by `ref` did not deliver clicks** on this page set —
  the button was topmost per `elementFromPoint` and nothing fired. Confirm any "dead control" by
  invoking the handler before filing it; I nearly filed a false one.
- **⚠️ The seeded `renter@test.com` seat carries a `self_employed` application in `processing`
  (created 2026-07-02).** The incubator gate therefore correctly withholds `RenterHome`, so **that
  seat cannot demonstrate journey 1's core surface.** `/test-login` re-writes the role but **not**
  application rows. Walk `RenterHome` on a fresh `/signup` account instead. The charter should be
  amended; flagged in the 2026-08-20 report.
- **The Landing route in the charter is stale against `main`.** There is no *"You're renting now"*
  door on `origin/main` — `Landing.tsx:36-84` has six persona cards and the word "renting" appears
  zero times. That door set lives on `feat/landing-coach-first`. Journey 1's door on `main` is
  **First-Time Buyers → `/first-time-buyer`**.
- **Before filing any 320px or touch-target finding, check open PRs.** #587 (public calculator
  overflow) and #605 (touch targets, 232 → 0) were both open on 2026-08-20 and already covered
  findings this walk would otherwise have re-reported.
