# Doc Accuracy — 2026-08-23 (routing review)

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

STATUS: WARN
