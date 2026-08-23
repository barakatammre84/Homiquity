# Doc Accuracy — 2026-08-23

> **Two runs landed on this date and both are recorded here, in order.** The 17:49Z **routing review**
> (founder-directed, no sweep) is below, unchanged. The scheduled **19:33 tick** — the first real tick
> under the amended skill — is appended at the end and rides on the same PR, because opening a second
> PR for one day is what LESSONS 2026-08-17 forbids.

## Run 1 — routing review (17:49Z)

**STATUS: WARN**
**Mode:** *not a tick* — **routing review**, founder-directed, scope narrowed by the operator to
"is this seat still relevant, and update its routing." **No corpus sweep was attempted** and the
ledger's `last-swept SHA` is deliberately untouched. · **PR:** this branch ·
**Ledger:** [doc-accuracy/LEDGER.md](../../doc-accuracy/LEDGER.md) (rows `DA-0823-17…19`)

One-line verdict: the seat is relevant and its in-repo definition is current, but its **routing**
carried two dead triggers and a drifted laptop prompt — one trigger deleted, one declined, the
prompt replaced by a staged (disabled) CCR trigger that needs one founder action to go live.

## ⛔ Human actions

1. **⛔ Complete the fleet move — the staged trigger is inert until you do (§11, both halves in one
   session).** Delete the local `doc-accuracy-daily` scheduled task on the laptop, then enable
   `trig_01HNfBQUXKmkLb9kmCfQEBG2` (`30 22 * * *` UTC), then move its row into CHARTER §3a's table
   and drop the §3 row. **Do not enable it while the local task still exists** — two stewards over
   one corpus is the hazard §3a records twice. Two things to check at that moment: (a) the **UTC
   offset** — `30 22` assumes local is still UTC−3, and §3a's own header says the offset moves;
   (b) the trigger fires sessions **without connector (`mcp__*`) tools**, because the creating
   session held none to pass through. If a tick needs the GitHub MCP server to open its PR,
   recreate the trigger from a session that holds it, or add the connector from the claude.ai
   routines UI.
2. **⛔ `DA-0823-18` — a second dead trigger, deletion declined this session.**
   `trig_011uNfD7y5GgBhjzm1RXgkVr` (*"[RETIRED 2026-08-18 — duplicate of the 6-hourly steward]
   weekly doc hygiene sweep"*, `0 14 * * 1`, disabled) still exists and its stored prompt still
   routes a session to `/doc-accuracy`. Recorded, not executed — your call.
3. **⛔ D11 — CHARTER factual-row edits ride in this PR.** Three of them, all in the ⛔-flagged
   lane, listed individually in §3 below: the preamble's amendment line, the §3 clock row's staged-
   move pointer, and the §3a "moved off this table" note. Pointer/status only — no rule semantics
   touched.
4. **⛔ Structural prevention proposed, not made (`fossil` class reached 3).** Retiring a seat
   should mean `delete_trigger`, **not** `enabled: false`. Detail in §5.
5. **Carried forward, untouched and still open** — from `DA-0823-16`, because CHARTER §4 makes
   reading a peer's report mandatory: (a) #706's scheduler repoint of `client-journey-walk` is
   still pending, so nothing writes the handoff corpus on a clock; (b) the daily Client Journey
   Walk lost its cadence in #706 — confirm that was intended.

## Summary

Scope was set by the operator to routing only, so this is a routing review and not a sweep tick,
and it says so in the ledger rather than advancing `last-swept SHA`. The seat itself checks out:
`.claude/skills/doc-accuracy/SKILL.md` is on `origin/main` with its `## Modes` section, CHARTER's
§3/§3a/§4/§6 rows describe it correctly, and two real ticks have shipped findings — this is a live
control, not a fossil. The routing around it was the problem: the pre-move CCR trigger had never
been deleted (only disabled) and had carried an unresolved ⛔ since 2026-08-20 purely because no
prior session held a `list_triggers` tool; a second retired trigger sat in the same state; and the
laptop scheduler prompt had drifted, routing this very session to a `## Modes` amendment on a branch
that merged days ago. The fix follows the Selling Guide Steward's pattern — a thin pointer prompt
with a no-op proof and restated rails, on the fleet a peer session can actually audit — staged
disabled so it cannot become the duplicate steward it is meant to prevent.

## Evidence

### 1 · The seat is current (the "still relevant?" question)

The prompt that launched this session carried a transitional clause: *"if `origin/main`'s copy of
the skill has no `## Modes` section, the founder's 2026-08-23 amendment has not merged yet — read
`git show origin/docs/doc-accuracy-daily-steward:…`"*. Measured:

```
git show origin/main:.claude/skills/doc-accuracy/SKILL.md | grep -n '^## Modes'
→ 117:## Modes                                   # present on main
git merge-base --is-ancestor origin/docs/doc-accuracy-daily-steward origin/main
→ exit 1                                        # that branch is NOT an ancestor of main
```

The amendment merged as **#700**; the branch the clause points at is a stale fork missing ~23,000
lines main now has (the Selling Guide corpus, handoff chapters 00–13, the CI rework). So the
instruction was not merely redundant — following it would have run the tick against a fork.
Recorded as **`DA-0823-19`**.

Everything else about the seat verified current, at `c8bb44f6`:

| claim | check | result |
|---|---|---|
| skill on `origin/main` | `git cat-file -e origin/main:.claude/skills/doc-accuracy/SKILL.md` | ✅ exists, 351 lines |
| CHARTER §3 seats it 19:33 local | `CHARTER.md:197` | ✅ correct |
| CHARTER §6 territory row current | `CHARTER.md:565` | ✅ carves out `handoff/**` per #706 |
| prior ticks real | `reports/2026-08-20-doc-accuracy.md`, `…-08-22-…` | ✅ both `WARN`, both with landed fixes |

### 2 · The two fossil triggers (`DA-0823-17`, `DA-0823-18`)

`list_triggers` (Claude_Code_Remote MCP) read live **2026-08-23T17:35Z** — the tool DA-0820-07
recorded as unreachable from the fleet's own sessions, which is exactly why that ⛔ sat open for
three days:

```
trig_01AuiWjui3tz3ApbNKV5vxBU  "Doc Accuracy — 6-hourly knowledge-base steward"
    cron 40 3,9,15,21 * * *  ·  enabled false  ·  next_run_at 2026-08-18T21:40:00Z (frozen)
    prompt still describes the 6-hourly cadence retired on 2026-08-20

trig_011uNfD7y5GgBhjzm1RXgkVr  "[RETIRED 2026-08-18 — duplicate of the 6-hourly steward]
                                weekly doc hygiene sweep"
    cron 0 14 * * 1  ·  enabled false  ·  next_run_at 2026-08-24T14:03:52Z
```

The first was **deleted**. Re-read at **17:44Z** over all 24 triggers:

```
trig_01AuiWjui3tz3ApbNKV5vxBU in list: False     # deleted
trig_011uNfD7y5GgBhjzm1RXgkVr in list: True      # deletion declined — ⛔ 2 above
trig_01HNfBQUXKmkLb9kmCfQEBG2 in list: True      # new, enabled: None (disabled)
```

This closes the ⛔ carried by **DA-0820-07** and restated in **DA-0823-03**; both rows are updated
in place with the closing evidence rather than left silently superseded.

### 3 · The staged replacement, on the Selling Guide Steward's pattern (`DA-0823-19`)

`trig_01HNfBQUXKmkLb9kmCfQEBG2` · `30 22 * * *` UTC (= 19:30 local at UTC−3) · fresh session per
fire · **created DISABLED**. Its prompt is shaped like
`.claude/skills/selling-guide-steward/SKILL.md`'s trigger, deliberately:

- **a thin pointer**, not a second copy of the method — *"Invoke `/doc-accuracy` and follow
  `.claude/skills/doc-accuracy/SKILL.md` exactly"*;
- **the no-op proof first** — *"verify the SKILL exists on `origin/main`; if absent, STOP … a
  routine whose definition is not on main is a fossil, not a seat (CHARTER §11)"*;
- **the precedence chain stated** — SKILL beats the prompt, CHARTER beats the SKILL, say so in the
  report;
- **rails restated compactly** (draft PRs only, docs-only `.md` diffs, dated evidence,
  drift-vs-regression, meaning-preserving only, immutable history, the off-limits list including
  `knowledge-base/handoff/**` and its own `SKILL.md`, the ⛔ lane, observe mode at ≥2 open PRs);
- and **no restated cadence, branch or version fact** — the drift class in `DA-0823-19` was a
  prompt asserting something the repo also asserts. This one asserts nothing the repo owns.

It is deliberately **not** in CHARTER §3a's table: a disabled trigger does not fire, and a
registered-looking non-routine is §0's founding failure wearing the other face.

### 4 · D11 ⛔ lane — the three CHARTER edits in this PR

| file:line | what changed | class |
|---|---|---|
| `CHARTER.md:4` | preamble amendment line — records this routing session | factual row |
| `CHARTER.md:197` | §3 Doc Accuracy row — appends *"⛔ A CCR replacement is staged **disabled** … §3a"* | factual row |
| `CHARTER.md:341-349` + new §3a paragraphs | "moved off this table" note: ⛔→✅ with the deletion evidence, the surviving fossil recorded as ⛔, and the staged move + its completion steps | factual row |

No rule semantics touched anywhere: §1b, §5, §6 and §10 are untouched, per D11.

### 5 · The learning loop — `fossil` reached 3

The scoreboard's `fossil` row moves 1 → 3 (DA-0820-05, plus both trigger rows), which under the
SKILL's Phase 3.2 earns a structural-prevention proposal. Both new instances are one shape: **a
retired seat's trigger is disabled rather than deleted.** A disabled trigger keeps a `next_run_at`,
keeps a stored prompt that still routes to a live skill, and re-enables straight into a duplicate
steward. CHARTER §11 already says retired *definitions* are archived and "never left
registered-looking"; the proposal is to say the same of *triggers* — in §11 and §3a — and to have
the quarterly knowledge audit diff `list_triggers` against §3a's table **in both directions**, since
today it would catch a missing row but not a surviving trigger.

## Proposed tickets

*(For Evening Triage to land — never edited into the roadmap here.)*

1. **A real `sweep+fix` tick is overdue.** `last-swept SHA` is `4206025f` (2026-08-22T15:20Z) and
   `origin/main` is ~102 commits ahead. This session deliberately did not touch it. Next tick takes
   that window and **rotation slice 3** (`governance/` registers + `security/` pack).
2. **CHARTER §11 + §3a: "retire a trigger by deleting it, not disabling it"** — the prevention in §5
   above. Doc-lane, but it is a rule change, so it is **propose-only** for this routine (D8).
3. **Quarterly knowledge audit: diff `list_triggers` against §3a both ways.** Today's audit reads
   both fleet lists; it does not catch a trigger that exists with no row.
4. **`hq-ci-guards-owner` (carried, unchanged): `DA-0823-15`** — no `knowledge-base/handoff/` file is
   in `scripts/doc-freshness-guard.cjs`'s `REQUIRED`, so 28 `Freshness:` lines are unenforced and
   `FACTS.md` lapses 2026-09-05 unnoticed.
5. **Consider whether the local fleet should hold any seat a cloud session cannot audit.** This
   session found prompt drift on the one fleet with no peer visibility, and found it only because
   the drift happened to point at a branch. Doc Accuracy is being moved; the same argument applies
   to the other ten local seats. Founder question, not a routine's.

STATUS (run 1): WARN

---

## Run 2 — the scheduled 19:33 tick

**STATUS: WARN**
**Mode:** `sweep+fix`. **Why:** one open PR from this routine (#713, this one) — below D4's
threshold of two, so not `observe`; detection found six fixable items, so not `sweep`.
**Skill source:** `origin/main`'s copy — it **has** a `## Modes` section (`:117`, 351 lines), so the
scheduler prompt's self-expiring clause about reading `docs/doc-accuracy-daily-steward` has expired
and was not followed. **CHARTER read; no conflict with the skill found this tick.**
**Window:** `4206025f..da71f82d` — **104 commits**. **Rotation slice:** cluster 3.
**Worktree:** `.claude/worktrees/doc-accuracy-2026-08-23` off `origin/main`, no `pnpm install`.

## ⛔ Human actions (hardest first)

1. **`DA-0823-27` — stop the count in your own skill from needing a third correction.**
   `.claude/skills/doc-accuracy/SKILL.md:12` says `pnpm guard:docs` re-verifies "**the eight docs**
   in its `REQUIRED` list". It is **ten** (`scripts/doc-freshness-guard.cjs:35-58`; `pnpm guard:docs`
   prints `10 living docs verified within interval. ✅`). This integer was corrected six→eight by
   DA-0823-02 **earlier today** and was already wrong again by this evening, because #701 added
   `handoff/README.md` and `handoff/FACTS.md`. D10 forbids this routine touching its own skill, so:
   **proposed wording — delete the number.** "the docs in its `REQUIRED` list" says everything the
   sentence needs and cannot drift. One line, `SKILL.md:12`.
2. **`DA-0823-25` — the handoff corpus is red and today's steward tick could not have known.**
   Both checks fail at the swept tip, and the 17:06 report does not explain either, because both
   causes landed after it ran. Full outputs in the `handoff:` line below. **Nothing was written** —
   no `--write`, no stamp, no chapter edit; the fix is that seat's next tick, or a hand
   `/handoff-refresh` if you want it sooner.
3. **Structural prevention, proposed not made — `contradiction` reached 7 and `www` is now a class.**
   Three sites in three documents have told a reader to point a machine probe at
   `www.homiquity.com`: DA-0820-08 (CHARTER §2's own table), DA-0823-20 (both deploy runbooks) and
   DA-0823-23 (the incident-response plan). The rule exists in two places already — CHARTER §2 and
   `ci.yml:846-852` — and neither notices a doc disagreeing with it. **Ticket (code, so not mine):**
   a ratcheted `wwwMachineProbes` metric in `scripts/doc-staleness-guard.cjs`, with the legitimate
   uses excluded by construction — they are a short, stable list (uptime-monitor targets, the
   `/rates` Googlebot prerender check, `/sitemap.xml`, `/api/articles`, which test the public host
   on purpose and must keep saying `www`).
4. **Carried from run 1 and from DA-0823-16, still open, still yours:** #706's scheduler repoint of
   `client-journey-walk` is pending and the task is paused, so nothing writes the handoff corpus on
   a clock; and the daily Client Journey Walk lost its cadence in #706 — confirm that was intended.
   Run 1's staged CCR trigger for this seat is still **disabled** by design.

## Summary

The window was 104 commits wide and the yield was concentrated in one place: **the deploy and
local-dev runbooks had drifted away from what CI actually does**, and three of the six fixes were
`HO-` rows the handoff corpus had already located and assigned to this routine's lane — this tick
was the first to consume that queue. The sharpest single find is its own class: the
**incident-response plan told the Incident Commander to confirm recovery by curling `www`**, the
host CHARTER §2 forbids for machine probes, in the one document read under pressure. Phase 1.4 is
red and unexplained (outcome (c)) — two `--check` rows and one `--cite` symbol-slide, all three
caused by #712, which merged after the 17:06 steward's tick; nothing was written to that corpus.
Phase 1.5 was **not due** (last teach-back 2026-08-23, this tick's slice is cluster 3).

## Evidence

**Ledger reconciliation (Phase 0.5) — and one place the skill's own rule misfires.** Three of this
routine's PRs merged today: #647 (`5a7082c0`, 17:22:02Z) closing DA-0820-01…12, #658 (`c8bb44f6`,
17:24:43Z) closing DA-0822-01…03, and — the interesting one — **#700 was CLOSED unmerged at
13:52:07Z, yet DA-0823-01…10 are all `done`**, because its content shipped inside #705 (`6dd7bbf7`).
Phase 0.5 maps CLOSED-unmerged to `escalated: ask founder`; that is wrong whenever the content
merged elsewhere, and one command distinguishes the two:
`git log origin/main -- .claude/skills/doc-accuracy/SKILL.md` → `6dd7bbf7`. Recorded as this tick's
LESSONS row. **DA-0823-15 also closed by landing**: #701 (`8453abfd`) added the handoff corpus to
`scripts/doc-freshness-guard.cjs`, so the freshness opt-in this routine proposed is now enforced.

**Fixed here — six sites, all `.md`, each dated against the code (D6):**

| id | file | was | is | proof |
|---|---|---|---|---|
| DA-0823-20 | `runbooks/CICD.md:66`, `runbooks/DB_MIGRATIONS.md:52` | `verify-deploy` polls `www…/api/health`; `continue-on-error` unrecorded | polls `homiquity-production.up.railway.app`; `continue-on-error: true` stated | `ci.yml:859` is the curl; `:846-852` is the workflow's own "never `www`" comment; `:825` the flag |
| DA-0823-21 | `runbooks/CICD.md` | "the integration suite **never runs in CI**" | it runs in the gate, conditional on change-scope | `ci.yml:638` step name, `:639` `if: steps.scope.outputs.code == 'true'`, added by #704 `d9e8f79d` |
| DA-0823-22 | `runbooks/LOCAL_DEV.md:24-26` | eight seeded accounts | eleven, matching its own §6a | `grep -c "@test.com" server/auth.ts` → **11**; `loa@`, `processor@`, `renter@` were missing |
| DA-0823-23 | `governance/security/INCIDENT_RESPONSE_PLAN.md:68` | `curl https://www.homiquity.com/api/health` to confirm recovery | the Railway origin, with the reason inline | CHARTER §2 machine-to-machine row; `ci.yml:846-852` |
| DA-0823-24 | `handbook/app-guide/02-architecture.md:42` | two vitest configs named | all three, with lane and script | `vitest.config.ts:30` is an allowlist; `vitest.client.config.ts:37` is a glob |

**The `www` fix is a rule correction, not a dead host — probed before editing.** At
2026-08-23T22:39Z both origins answered `200` with the *same* commit
`da71f82dfa264abbb5364000095ab32d999800d1` = the `origin/main` tip, so **prod is current** and `www`
works today from this environment. The correction stands anyway: CHARTER §2 forbids `www` for
machine probes because of *how it can fail* (Squarespace DNS — stale record, redirect, cached edge),
and D8 permits tightening toward a rail. Public-surface probes that legitimately target `www` —
the `/rates` Googlebot prerender check, `/sitemap.xml`, `/api/articles`, the uptime-monitor target —
were **left alone**; they are testing the host users hit, which is the point of them.

**Rotation slice — cluster 3 (`governance/` registers + the `security/` pack), audited inline**
(no subagent used this run). Six documents, 970 lines. Every code pointer resolves. Verified rather
than assumed: `CHANNEL_DECISION.md`'s freeze is real (`guard:channel` is in `package.json:42` and
`ci.yml:306`; `BUSINESS_CHANNEL = "broker"` at `shared/businessChannel.ts:49`); its 1,482-line table
is **correct** (see the exclusion row — the guard counts `split("\n").length`, one more per file
than `wc -l`, and prints `1482 … (baseline 1482)`); `CONTINGENT_LIABILITY_REGISTER.md`'s
`quantifiedFloor`/`unquantifiedCount` contract is real in `shared/contingentLiabilities.ts:23-24`
and `server/routes/underwriting/submissions.ts:528-529`; every endpoint
`UNCONSUMED_CAPABILITIES.md` closed still exists. The slice's one finding is DA-0823-23. The three
registers stamp 2026-08-04 / 30 days ⇒ due 2026-09-03, outside sweep 2e's 7-day window, so **no
stamp was bumped** — none of the three was re-read in full.

**Mechanical sweeps.** 2a: 23 hits, **2 real** (both DA-0823-26, in a peer's register), 21 excluded
— **4 new exclusion rows** for classes that would otherwise be re-litigated every tick: guard-derived
line counts, git branch names that look like paths, gitignored-by-design paths, and
ellipses/route-group labels. 2b: 26 hits, **0 real** (all prose-after-`pnpm`, globs, or the doc
stating the command does not exist). 2c/2d: `pnpm guard:staleness --list` read row by row per
LESSONS 2026-08-20 — all 24 baselined occurrences are quoted history, explicit negatives or dated
banners; no live survivor this tick. 2e: `pnpm guard:docs` → `10 living docs verified within
interval. ✅`, nothing due within 7 days.

**Guards, in the worktree, before the push:** `guard:kb` `237 docs, all indexed; no dead links` ·
`guard:staleness` all five metrics at baseline · `guard:citations` `29 unresolved (at baseline)` ·
`guard:docs` `10 living docs` · `guard:ui` — see below. `git diff --stat` proves `.md`-only and
nothing under `knowledge-base/handoff/`.

**handoff:** `--check` **RED, unexplained by the 17:06 report → DA-0823-25, WARN** (Phase 1.4
outcome (c)). `48 rows · 40 checkable · 8 not machine-comparable`; `DISAGREES F-19` agents
`doc says 58 · 41` / `command 59 · 41`; `DISAGREES F-31` commits `doc says 1098` / `command 1159`;
`STAMP FACTS.md says @ fd4a22c5; HEAD is da71f82d`. Causes dated, not guessed: F-19 is
`.claude/agents/_JOURNEY_WALK_RAILS.md`, the single `A` in
`git diff --name-status fd4a22c5..origin/main -- .claude/agents/`, added by **#712 (`da71f82d`,
12:53:48-05:00)**; F-31 is `git rev-list --count fd4a22c5..origin/main` → **61**.
`--cite` **RED, 1 problem**: `971 citations · 746 rooted · 225 by unique basename · 0 ambiguous ·
0 absent → bounds: 971 ok / 0 out-of-range · symbols: 57 checked (56 ok · 1 slid · 0 missing)`;
the slide is `knowledge-base/handoff/TEACHBACK_KEY.md:116 -> knowledge-base/routines/CHARTER.md:525-526
| F- | slid`, and the cited text is now at **`:533-534`**
(`grep -n 'Never a bare next-free integer' knowledge-base/routines/CHARTER.md` → `534`) — moved by
#712's CHARTER edit. **Today's `2026-08-23-handoff-steward.md` exists** (its own `--check` named
F-13/F-31/F-36 from a shallow clone, and F-19 not at all), so this is not CHARTER §4's
missing-upstream-report `WARN` — it is fresh drift the seat has not seen. **Teach-back: not due** —
this tick's slice is cluster 3, and the last teach-back is dated 2026-08-23 in the corpus run log,
so the 21-day clause does not fire either. **Nothing written under `knowledge-base/handoff/`.**
**Proposed `HO-` row for the 17:06 seat:** re-run `--write` at the new tip, prose-check F-19's
annotation (the agent total moved but the auto-loading set may not have), and retarget
`TEACHBACK_KEY.md:116` to `CHARTER.md:533-534`. ⚠️ **Note for that seat:** this PR does **not** edit
`CHARTER.md`, deliberately — run 1 already carries three CHARTER edits and every further line shift
re-slides the corpus's citations into it.

## Proposed tickets (not made here)

- **`DA-0823-25` → the 17:06 Handoff Corpus Steward.** The `HO-` row above, with the two `--check`
  rows, the `--cite` slide, and the dated cause for each.
- **`DA-0823-26` → the feature-review seat.** Two further dead paths in `FINDINGS.md` beyond
  DA-0822-04's three: server/routes/borrower.ts (`:46`, `:104`) and server/routes/underwriting.ts
  (`:296`) — deleted by `8ee9fd33` (#193) and `268b6911` (#207) respectively, both now directories.
  Written without backticks so this report does not add three dead citations of its own.
- **`DA-0823-27` → the founder.** The one-line skill wording above.
- **Structural prevention → `hq-ci-guards-owner`.** The `wwwMachineProbes` ratchet in ⛔3.
- **Carried, untouched:** DA-0822-03 (`docs/fannie-mae/README.md` still says Claude's Read tool
  opens PDFs; `pdftoppm` is absent on this machine), DA-0822-05 (`CTO_ROADMAP.md:504` →
  docs/freddie-mac/, Evening Triage's lane), DA-0823-11 (`TEACHBACK_KEY.md` chapters 11–12 unkeyed —
  founder authoring), DA-0823-18 (the second dead CCR trigger).

## What this tick did not do

No code, no `docs/**`, no `data/regulatory/**`, no `CTO_ROADMAP.md`, no peer register, no
`knowledge-base/handoff/**`, no self-amendment of `SKILL.md`, no `pnpm install`, no dev server, no
stamp bumped without a full re-read, and no count typed by hand — every number in this report is
pasted from the command printed beside it.

STATUS: WARN
