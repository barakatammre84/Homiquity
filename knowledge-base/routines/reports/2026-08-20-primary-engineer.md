# Primary Engineer — 2026-08-20

STATUS: WARN — two PRs shipped and verified, both §9-clean and ready; the WARN is a missing
upstream (no Trunk Health / Launch Gate report exists for 2026-08-19) plus a third slot deliberately
left unspent because its candidate was already fixed on `main`.

MODE: **build.** No backpressure trigger: this routine had **zero** open PRs at orient time, and the
dirt in the primary checkout is a declared peer's branch (`feat/landing-coach-first`), which CHARTER
§5 and rail R3 both exclude as an observe trigger. All work happened in fresh worktrees off
`origin/main`; the primary checkout was never written to.

---

## ⛔ Human actions — hardest first

**1. Two ready PRs, both closing a defect a client hits on the first click. Nothing in either is
founder-gated.**

| PR | what it closes | why it is worth a merge slot |
|---|---|---|
| [#617](https://github.com/barakatammre84/Homiquity/pull/617) | the Homeowner Hub's **entire write surface** returned 500 | the Hub has one entrance and it has never opened for anyone — five dead client actions behind it |
| [#624](https://github.com/barakatammre84/Homiquity/pull/624) | **every notification rendered unread, forever** | program-scale, every borrower's shell, ECOA adverse-action notices included |

Both are `MERGEABLE`, current with `main`, and carry a §9 `detectTriggers()` run over the committed
diff returning **NONE**. Neither touches schema, dependencies, or a consent/disclosure/FCRA gate.

🚨 **Read Evening Triage's ⛔1 before merging either.** `main` still has
`required_status_checks.contexts: []` and Railway is still wired to `main` with
`checkSuites: false`, so **a merge is an unverified production deploy**. That is a founder decision
this routine cannot make and did not touch. Both PR bodies say so in their own words.

**2. GitHub Actions is still dead on the billing failure, so neither PR's checks mean anything.**
Both went `UNSTABLE` — that is the ~3-second `steps: []` failure Evening Triage documented on
2026-08-19 and QA Sweep on the same day, not a red gate. Every number in both PR bodies was
measured locally, in a clean worktree, with `pnpm install --frozen-lockfile` after each rebase.
This is the second consecutive day the suite has had to self-certify.

**3. Delete the local branch `routine/primary-engineer-2026-08-18-1` — it is fully superseded, and
its existence is misleading.** Yesterday's run left it unpushed with two commits, so it was invisible
to `gh pr list` and to every peer. I compared it to `origin/main` at blob level rather than by
3-dot diff: `client/src/pages/lending/LoanEstimate.tsx` and `tests/trid.test.ts` are **byte-identical**
to `main` (the work landed as `a7fea2fc`, #546), and the one file that differs,
`server/services/loanEstimate.ts`, differs because **`main` is ahead of it** — the branch predates the
FHA MI product-awareness work. Nothing on it survives. Its claim row was never pushed either, so
there is no stale REGISTER row to clear; the branch is the only residue. This is the third recorded
instance of the fire-and-lose-the-artifact class (Evening Triage P1-7 / roadmap §3.24).

---

## Summary

Two client-facing dead ends closed, both of the kind the 2026-08-19 founder directive ranks first:
the Homeowner Hub's setup form has never once succeeded — nine controls initialised to `""`, posted
whole, into a Drizzle `timestamp` mapping that calls `.toISOString()` on the value — so every write
endpoint behind that one door returned 500 and nothing in the Hub was ever reachable; and the
notification panel keyed read state off `readAt`, a column the `notifications` table does not have,
so `!undefined` made every notification render unread permanently while the bell count beside it
disagreed. Both were proven the house way — reintroduce the bug, watch the right tests red, restore.
The third slot went unspent for the right reason: the candidate I scoped, a 17× repeated full-tree
read in `tests/statusVocabulary.test.ts` that was timing out under load and blocking pushes, turned
out to have been fixed on `main` hours earlier by a peer, which rail R9 caught before I shipped a
duplicate — and a peer session confirmed the same diagnosis unprompted mid-run. The one thing I
could not do was read a Trunk Health verdict, because none was written for 2026-08-19.

---

## Evidence

### Orient

- `git fetch origin`; guard `git cat-file -e origin/main:.claude/skills/primary-engineer/SKILL.md` → **present**, so the phases ran from the merged definition rather than from memory.
- Read: `CHARTER.md` §1/§1a/§1b/§5/§6/§8–§11, `REGISTER.md`, `refactor-radar/LEDGER.md`, and the two upstreams that exist —
  `2026-08-19-qa-sweep.md` (on `origin/routine/qa-sweep-2026-08-19`, PR #611) and
  `2026-08-19-evening-triage.md` (on `origin/routine/evening-triage-2026-08-19`, PR #614).
- **§4 WARN — the Launch Gate upstream is missing.** `git ls-tree` over every remote ref returns no
  `2026-08-{18,19,20}-launch-gate.md` and no Trunk Health report. The most recent gate verdict in
  `reports/` is **2026-08-17**, three days old. Evening Triage independently recorded the 08-19 seat
  as *"fired, no artifact"*. Per Phase 1(a) I substituted my own orient-time health check rather
  than assuming: `pnpm check` **clean** and the node lane green on fresh `origin/main` before any
  edit — so no red gate outranked the queue.
- `ListAgents`: 11 peer sessions. Read last, as CHARTER §5.4 ranks it. `origin/main`, the 21 open
  PRs and `REGISTER.md` were the signals that decided the slate.
- Backpressure check: `git branch -r | grep primary-engineer` → **none**. Zero open PRs from this
  routine, so R3's observe trigger did not fire.

### Item 1 — the Homeowner Hub write surface (F-0819-03) → [#617](https://github.com/barakatammre84/Homiquity/pull/617)

Rank: founder directive **1** (*a client cannot complete something the product offers*), CHARTER §1
question **B**. Source: QA Sweep `F-0819-03`, Evening Triage **P1-4**, roadmap **§3.28**. No Illinois
tiebreak needed. Chosen over the four backend P1s because those carry a named owner (Backend Data
Engineer, §6b) and this one carried only *"Claude"*.

Five client actions, all dead, all for the same reason — a value the client sends that the column
cannot take:

| action | endpoint | the value |
|---|---|---|
| Set Up Dashboard | `POST /api/homeowner/profile` | `purchaseDate: ""`, `loanCloseDate: ""`, and `""` on six `decimal` columns |
| Schedule Review | `PUT /api/homeowner/profile/:id` | `nextReviewDate` as a date string |
| Record Snapshot | `POST /api/homeowner/equity` | nothing — NOT NULL `snapshot_date` never supplied |
| Generate Alert | `POST /api/homeowner/refi-alerts` | nothing — NOT NULL `current_rate` / `market_rate` never supplied |
| (Quick Actions balance/value) | `PUT /api/homeowner/profile/:id` | the one that worked — decimals only |

The fix, and the reasoning that shaped it:

- Both profile writes go through `homeownerProfileWriteSchema`, which encodes the rule the old code
  lacked: **a blank control is an unanswered question.** It drops, the column stays NULL — never
  `new Date("")`, never `""`. Malformed input now gets a **400 naming the field**; `userId` is off
  the wire entirely.
- The two action endpoints stop inserting the client's body and call the daily sweep's own legs,
  extracted from `sweepProfile` as `resolveHomeownerPosition` / `recordEquitySnapshot` /
  `evaluateRefiOpportunity`. **The sweep's sequencing is preserved exactly** — a profile already
  snapshotted today is still skipped whole, refi check included. This keeps the **EPO clawback
  suppression** and the **open-alert de-dup** on the borrower's own path, where a client-composed
  alert bypassed both, and it means no savings figure can be assembled from the wire.
- **Zero calculation changed.** The AVM refresh, `estimateRemainingBalance` and `computeRefiSavings`
  are untouched, so R6 is satisfied without a new `regulatory-ledger.json` entry: there is no new
  regulated math, only a caller.
- Both buttons report the **real outcome** instead of an unconditional success toast — the house
  defect class. "Already up to date" when today's snapshot exists; a named reason for each of the
  five ways the refi check can decline. A profile too thin to measure gets a **409 saying what is
  missing**, not a snapshot of nothing. "Generate Alert" became "Check rates", because the product
  cannot promise an alert.

```
tests/homeownerHubWrites.test.ts        16 assertions, node lane
  registered in vitest.config.ts; `vitest list --filesOnly` confirms the file is collected
mutation 1  drop blankToUndefined from the date field   → 2 red (both schema tests)
mutation 2  restore the raw-body equity insert          → 2 red (both wiring tests)
restore                                                 → 16 passed

pnpm check   clean
node lane    206 files / 3023 passed, 1 skipped     client lane  714 passed
pnpm build   green        pnpm preflight  exit 0 (on the merged base)
guard:{schema,tokens,ui,channel,docs,querykeys,migrations,kb,staleness,citations,bundle}  all pass
§9 detectTriggers() over the committed diff (9 files, 688 changed lines)  → NONE
```

### Item 2 — notification read state (F-0819-10) → [#624](https://github.com/barakatammre84/Homiquity/pull/624)

Rank: founder directive **1–2** — a gate that never opens, *and* two surfaces disagreeing about one
fact (DESIGN_SYSTEM §13, *Agreement*). Source: QA Sweep `F-0819-10`, Evening Triage **P2-4**.
Promoted above its P2 because the directive ranks correctness on every borrower's shell over polish.

`realNotificationToItem` computed `isUnread: !n.readAt`. The `notifications` table has no `readAt`
column: `markNotificationRead` sets `status: "read"` (`notificationsOps.ts:159-165`) and the bell
counts `status = 'unread'` (`:152-157`). `GET /api/notifications` returns rows verbatim, so `readAt`
was never in the payload and `!undefined` is `true` — **every notification rendered unread,
permanently.** Click one, it PATCHes read, the panel refetches, and it returns looking identical
while the count beside it drops. The write happened; the surface said it hadn't.

**Why it survived:** the colocated test hand-wrote `readAt: null` into its fixture — *the fixture
supplied what the product could not*, so the dead branch stayed green. Fixed structurally, not just
in the predicate: the fixture is now the real row, and three new assertions read the **server** files
(the mark-read write, the unread-count predicate, and the absence of a `read_at` column in
`shared/schema/admin.ts`), so the two sides cannot drift apart silently again.

`isNotificationUnread` is deliberately `!== "read"` rather than `=== "unread"`: if the vocabulary
grows, the safe failure is a notification the borrower still **sees**.

```
client/src/components/NotificationsPanel.test.tsx   13 assertions (was 6)
mutation  restore the readAt lookup  → exactly 1 red: "reads a read notification as read"
restore                              → 13 passed

pnpm check   clean
node lane    205 files / 3007 passed, 1 skipped     client lane  110 files / 721 passed
pnpm build   green
guard suite  all pass at or below baseline
§9 detectTriggers() over the committed diff (3 files, 128 changed lines)  → NONE
```

### The third slot, and what it turned into

I scoped a third item from a defect this run hit first-hand: `tests/statusVocabulary.test.ts` walks
`server/` + `client/src/` + `shared/` and re-reads all **1,002** files **17 times** — ~17,000 disk
reads — and under full-suite load individual tests crossed vitest's then-15 s per-test ceiling. It
failed on a *timeout*, in a different test each run, and via `.githooks/pre-push` it **blocked a push
of a branch that had never touched it**: item 2's first push died there while its own diff was a
single documentation line.

Cutting the worktree revealed the fix was **already on `origin/main`** — a `SOURCES` const reading
each file once, plus `testTimeout` 15 s → 45 s — landed by a peer between my fetches. R9 is what
caught it: I re-verified against `origin/main` before building, not after. The worktree and branch
were removed without shipping anything. Independent corroboration arrived mid-run: a peer session
(`homiquity-d7`) messaged the same diagnosis, naming `statusVocabulary` and `intakeNeverDenies` as
the two tests that were crossing the old ceiling.

The effect is measurable on my own branches: the node lane went **155–238 s with the flake** to
**51 s green** after rebasing onto that base.

**Rather than spend the slot on a speculative fourth item, I left it unspent.** An idle slot on a
queue whose real constraint is founder review beats a third PR nobody asked for — and 21 PRs were
already open at orient time.

### Honesty notes

- **`git push --force` is blocked in this session**, and so is `git reset --hard`. Item 1 had already
  been pushed before `main` moved three commits, so I could not rebase-and-force it. I merged
  `origin/main` in from the pushed tip instead and **proved the result byte-identical** to the
  rebased tree I had just run the full gate against (`git diff <rebased> <merged>` → empty) before
  pushing. Item 2 was rebased before its first successful push, so it needed no such handling.
- **`pnpm install --frozen-lockfile` was re-run after every rebase and merge**, per §5.1 — a worktree
  without it resolves `node_modules` upward into the primary checkout, which is on a peer's branch.
- One guard writes to the tree: `guard:bundle` modifies `scripts/bundle-size-baseline.json`. It was
  reverted with `git checkout --` each time and is in neither PR.
- `guard:citations` went red once, on **my own** REGISTER claim row citing
  `tests/notificationReadState.test.ts` — a file I had planned and then did not create, because the
  tests belonged in the colocated file. Corrected in the same worktree; the guard is back at its
  25-reference baseline. Worth recording because it is the guard doing exactly its job on the person
  who wrote the pointer.
- **No dev server was started and no browser probe was run.** Both fixes are proven by tests and by
  reading the shipped files; item 1's 500s are established from the QA Sweep's nine live probes plus
  the schema and the client payloads, **not** re-observed by me. That is the limit of this run's
  evidence and it is stated rather than papered over.
- Nothing was merged, no auto-merge was enabled on anything, `main` was never pushed to, no
  production variable or credential was touched, and no migration was written or applied.

### Register

Both rows claimed before any code and pushed with their branches; both released in the same PR as
their work, per rule 4. No stale primary-engineer row existed to clean up at orient time.

---

## Proposed tickets — for Evening Triage

| # | ticket | rank |
|---|---|---|
| 1 | **`F-0819-08` just became load-bearing.** `getMarketRate30YrFixed` needs a program filter and a deterministic tiebreak — and after #617 it is no longer only the cron's input: the borrower's own "Check rates" button consumes it directly, so a nondeterministic row selection now reaches a consumer-facing savings estimate on demand. Owner: Backend Data Engineer (§6b) or a directed session. | B, raised from the QA sweep's original P2 |
| 2 | **Delete the superseded local branch `routine/primary-engineer-2026-08-18-1`** (blob-level comparison in ⛔3 above), and give the fire-and-lose-the-artifact class its fix: a `STATUS: STARTED` report stub written at orient time. Three instances now. Roadmap **§3.24** already carries it. | hygiene, but it is why two of this seat's last three runs look like no-shows |
| 3 | **`F-0819-17` / `F-0819-12` (quiet hours) has no eligible owner and was skipped for that reason, not overlooked.** A test asserts a 5 AM-Guam instant is compliant, and the bracket behind it is wrong for 1,587 instants a year. `server/services/quietHours.ts` and `smsCompliance.ts` sit inside CHARTER §6's **outbound messaging** permanent off-limits list, so no code-writing routine may take it. Fixing only the assertion would leave a red suite. It needs a founder-directed session before any outbound SMS ships. | B, and structurally unassignable — that is the point of raising it |

STATUS: WARN
