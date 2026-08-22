# Client Journey Walk — rotation ledger

Cross-run memory for the `client-journey-walk` seat (daily since 2026-08-19). One persona per run,
**strict rotation 1 → 2 → 3 → 4 → 1**. A fresh session reads this file to know where to resume.

**Charter: `knowledge-base/feature-review/JOURNEYS.md` is ON `origin/main` and WINS.** It arrived
**2026-08-20 via #595**, not via its founding PR #607 (still open, `DIRTY` — and now partly
redundant, since the file it exists to add already landed). From the next run on, read `JOURNEYS.md`
and treat the `SKILL.md` summaries as a convenience copy. Record which source each run used.

> *(Resolved 2026-08-22: #607 merged on 2026-08-20 and the `.git/info/exclude` entries were removed;
> the agents and skill are tracked on `main`. The 2026-08-20 account amendment that #607 merged
> **without** was ported to `journey-walker-aspiring-owner.md`, `journey-walk/SKILL.md` W6 and
> `feature-review/CHARTER.md` in the staff-journey PR. Staff desks have their own lane:
> `knowledge-base/routines/staff-journey-walk/LEDGER.md`.)*

## Rotation state

| next run walks | persona | account convention |
|---|---|---|
| **→ Journey 2** | Active buyer, W-2 salaried | fresh `/signup` as `jw2+<MMDD>@test.local`; starts `aspiring_owner`, **must end `active_buyer`** |

## Run history

| date | journey | source used | server (commit) | verdict | report |
|---|---|---|---|---|---|
| 2026-08-20 | **1 — Aspiring owner** | `SKILL.md` summaries — JOURNEYS.md was absent from `origin/main` at 12:31Z and **arrived at 12:47Z, mid-walk**, via #595 | `b799b91d` (`origin/main` tip at start; main advanced to `8260d734` during the run) via a dedicated worktree on :5001 | **WARN** — 2 data-correctness defects, 1 surface unreachable at 320px, 11 tickets. Findings re-verified against `8260d734` after the merge; **one claim withdrawn**, one new finding (`ux-50`) found by that re-verification | [2026-08-20-journey-walk.md](../reports/2026-08-20-journey-walk.md) |

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
- **⚠️ Journey 1 now takes a FRESH SIGNUP (`jr+<MMDD>@test.local`), not `renter@test.com`.**
  **Amended 2026-08-20** in `JOURNEYS.md` §1, the local `client-journey-walk/SKILL.md`, the in-repo
  `journey-walk` skill (W6) and the `journey-walker-aspiring-owner` agent. Reason: the incubator
  gate keys on the **file**, not the role — that seat carried a `self_employed` application in
  `processing` from **2026-07-02**, so `RenterHome` was unreachable on the very account the charter
  named for it. `/test-login` re-writes the role but not application rows, and `server/seed.ts`
  creates none, so it is dev-DB drift that any submitting run recreates. If you take the seeded seat
  anyway, probe `GET /api/loan-applications` first (`[]` ⇒ `RenterHome` renders) and say which.
- **🚨 `main` can move under you mid-run — it did, by fifteen minutes.** #595 merged at
  **2026-08-20T12:47Z** while a walk started at 12:32Z was in flight. That run reported
  "`origin/main` has no renting door" — true of the commit it walked (`b799b91d`), false by the time
  it was written, and the recommendation it produced had to be withdrawn. **So: `git fetch` and
  re-check `origin/main` at the END of the walk, not only the start, then re-verify every finding's
  file and line refs against the new tip before writing them down.** Doing exactly that is what
  caught **ux-50**.
- **The charter's Landing route is CORRECT** (four doors: renting, self-employed, owner, moving-up).
  Its `Landing.tsx` line refs were stale after #595 and were corrected the same day — renting
  `:58-73`, self-employed `:74-91`, owner `:92-100`, moving-up `:101-112`; the "Homi answers your
  questions" line is a `TRUST_POINTS` entry at `:123`, **not** a door.
- **Two promises the charter used to send you after have been RETRACTED — do not re-file their
  absence.** #595 removed *"…and what your rent already proves about you"* (a Reg N / MAP Rule
  §1014.3 misrepresentation — nothing downstream furnishes rent) and *"We work out every way your
  income can count"* (the funnel never feeds self-employment into the multi-path engine). The
  retractions are the fix. New copy that re-implies either **is** a finding.
- **Before filing any 320px or touch-target finding, check open PRs.** #587 (public calculator
  overflow) and #605 (touch targets, 232 → 0) were both open on 2026-08-20 and already covered
  findings this walk would otherwise have re-reported.
