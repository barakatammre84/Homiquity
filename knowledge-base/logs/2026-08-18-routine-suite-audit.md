# Routine-suite audit — 2026-08-18

**Asked for by the founder:** review every routine and find what is missing so they support each
other, keep the build clean, and keep Claude — the primary developer here — from shipping
hallucinated or wrong information.

**Scope:** both fleets. Fleet 1 is the local scheduler's ten routines
([`routines/CHARTER.md`](../routines/CHARTER.md) §3). Fleet 2 is the Claude-Code-Remote triggers,
read live from `list_triggers` at **2026-08-18 19:00Z**. Also read: the four domain router skills,
the six `.claude/agents/*.md`, the CI gate, the twelve guard scripts, `reports/`, `LESSONS.md`,
`REGISTER.md`, `TEAM_PRACTICES.md` §9.

**Verdict.** The rules are not the weak part. This suite has an unusually good contract — dated
lessons, an assist ladder, honesty rails that name the incident behind each one, and a §1b
authority matrix that is genuinely conservative. **The weak part is that almost none of it is
mechanically checked, and a third of it lives where nobody can read it.** Every other layer of this
repo ratchets: schema↔migrations, tokens, the UI standard, query keys, the KB index, doc staleness,
bundle bytes, the §9 security review. The layer that governs the machine writing all of them was
enforced by asking politely.

This is a dated snapshot. Verify any claim below against the code before acting on it.

---

## What was found

Ordered by what it would cost. **Fixed here** means this PR closes it; **founder** means it needs a
decision no session should make alone.

### 1. Six of ten scheduled routines have no definition anyone but one laptop can read — *founder*

`.claude/skills/` holds five routine definitions (`primary-engineer`, `refactor-radar`,
`compliance-watch`, `financial-audit`, `rent-reporting-watch`). CHARTER §3 schedules ten. The other
six — **Launch Gate, Frontend Wiring Audit, Lender Delivery Gate, Deliverable QA Sweep, Evening
Triage, Vendor & Procurement** — exist only under `~/.claude/scheduled-tasks/` on the founder's
machine. Two of those write code (the Wiring Audit writes to the capture path *daily*), and one of
them, Evening Triage, is the routine that performs §7's proof-of-life count.

Consequences, in order:

- **They cannot be reviewed.** A rail that changes changes silently. §0's five-week failure was
  exactly definitions drifting out of sync with reality while reading as live.
- **They cannot run anywhere else.** Fleet 2 keeps growing (eight triggers, up from zero in a
  week) and cloud sessions are where an increasing share of this repo's work happens. A cloud
  session cannot run six of the ten routines at all.
- **The proof-of-life control is itself invisible.** Evening Triage is the only routine whose
  absence hides the absence of the others, and it is the least readable of the six.

Fixed here only to the extent of making it *visible and dated*: [`registry.json`](../routines/registry.json)
carries a waiver per routine with a reason and an expiry, CHARTER §3 gains a **Definition** column,
and `pnpm guard:routines --strict` fails once a waiver expires. **The actual fix is committing the
six definitions**, which is the founder's to do — they are on a machine no session here can reach.
Recommended order: Evening Triage, then the Wiring Audit, then Deliverable QA Sweep.

### 2. The routine layer had no guard — *fixed here*

Twelve guard scripts and nothing checking the suite. Now `scripts/routine-registry-guard.cjs`
(`pnpm guard:routines`, in the required gate) fails on: a routine `SKILL.md` nobody registered (a
fossil — §11's word); a registered routine with an invisible definition and no dated waiver; a §3
clock that disagrees with the registry; a frontmatter `name` that disagrees with its directory (the
skill would not load where the registry says it lives); a routine skill that never names the
contract that outranks it; a report in `reports/` attributable to no routine; two scheduled
routines sharing a cron minute; and a fleet-2 trigger promising to invoke a skill that does not
exist.

Watched failing before being trusted, per `LESSONS.md` 2026-08-12: a fossil skill, a waiver with no
expiry, and an expired waiver (gate exit 0, `--strict` exit 1) were each induced and observed.

**What it cannot see:** the scheduler. It reads the repo. It can never tell you a routine is
really registered, that its cron is what the registry says, or that it ran. That remains §7's job,
and §7's evidence is a report.

### 3. CHARTER §8's hard-nevers were prose — *fixed here*

§8 forbids pushing to `main`, merging, arming auto-merge, flipping a production variable, and
applying a migration to prod. §1b explains why: *"a rail the machine can relax for itself is not a
rail."* Nothing stood between any of those commands and production but a session having read it.

`.claude/settings.json` now registers two `PreToolUse` hooks: `charter-rails.cjs` over `Bash`, and
`deny-merge-tools.cjs` over the three GitHub MCP merge/auto-merge tools — both paths, because a
cloud session has no `gh` CLI and reaches the MCP tools instead, and a rail that depends on which
machine you are on is not a rail. Each block prints the reason and the sanctioned alternative.
Also blocked: `db:push` (shared dev database), `git add -A`/`.`, bare `--force` pushes
(`--force-with-lease` passes), and `git checkout <ref> -- .`, which cost a session its working tree
on 2026-08-12.

Pinned by `tests/routineGovernance.test.ts` — 15 forbidden commands and, more importantly, **16
ordinary ones that must still get through**. That half is not padding: the hook's first run blocked
its own test harness, because the harness *mentioned* a forbidden command. A rail that fires while
you read the repo is a rail somebody switches off by the end of the day.

**Not a sandbox.** It is a string check on a shell command; `bash -c "<blocked>"` reads as text and
passes. It is a floor under §8, not a replacement for it.

### 4. CHARTER §6 forbade the write it requires — *fixed here, founder to confirm*

The always-off-limits list said `data/regulatory/**` flat. The next paragraph requires a
`data/regulatory/regulatory-ledger.json` entry in the same commit as any regulated-math change. A
routine had to break one rule to obey the other, and the resolution it picked was unrecorded either
way. Narrowed to the reading that keeps everything else locked: `regulatory-watch-state.json` stays
off limits (it is machine-owned by `pnpm reg:watch:save`), and the ledger is writable **only** as
the same-commit companion to the change it cites.

### 5. The second fleet had already drifted from the table describing it — *fixed here*

CHARTER §3's fleet-2 table was written 2026-08-18 and was stale by that evening.

- The **Monday 14:00** row described a "doc & memory hygiene sweep". That trigger was repointed the
  same day to invoke `/doc-accuracy` — so it is no longer its own routine, and **two triggers now
  fire the same routine on Mondays, 100 minutes apart** (14:00 and the 15:40 steward tick).
  `LESSONS.md` 2026-08-17 already records what one routine firing twice in a day does to a backlog.
- **`.claude/skills/doc-accuracy/SKILL.md` does not exist on `origin/main`** (founding PR: branch
  `claude/md-docs-accuracy-routine-2x0850`). Both triggers are correctly written to say so and
  stop — that is the right shape — but it is **~29 firings a week producing nothing**, and nothing
  was counting. `guard:routines` now prints it as a WARN on every run until the PR merges.
- **Financial Audit** is governed by §6's territory table and fires monthly from fleet 2, but
  appeared on no clock at all. It is in the registry now, and §3 says where it lives.

### 6. `REGISTER.md`'s released-claims table was malformed — *fixed here*

The most recent released claim was written as a six-column row *above* the "Recently released"
header, so it rendered outside the table it belonged to. A claim board is read by every routine
before it writes; a row that does not render is a claim that was never made.

### 7. §2 told every routine to hardcode a path `LESSONS.md` tells it not to — *fixed here*

The standing-facts table gave the repo as `/Users/ammrebarakat/Developer/Homiquity`. `LESSONS.md`
2026-08-12 records a radar run aborting in a cloud session for exactly that reason. The row now
says to derive it with `git rev-parse --show-toplevel`.

### 8. Controls with no owner — *fixed here, as assignments the founder can veto*

Every one of these was described in the charter and assigned to nobody: the proof-of-life count,
registry truth, waiver expiry, cross-fleet reconciliation, and promoting a proven `LESSONS.md` row
into §10. New **CHARTER §12** gives each an owner, a cadence, and the evidence that it happened —
and says plainly that three of the five are assigned to Evening Triage, whose own definition is
`⚠ laptop-only`, so those three assignments are only as real as finding 1's fix.

### 9. Work no routine owns at all — *founder*

Recorded in §12 so it is a decision rather than an oversight:

- **The server-side refactor lane.** Radar is `client/src` only by R5 and routes server ideas to
  `blocked-human`. Primary Engineer may take one but ranks by §1, where a server refactor is LOW by
  construction. They accumulate, owned by nobody.
- **Test-suite health.** Nothing watches for slow, skipped or quarantined tests. The 2026-08-12
  `it.skipIf` fix found eight XSD cases vitest had been reporting as *passed* for as long as
  `xmllint` had been absent — and it was found by a routine looking for something else.
- **The second fleet's private method copies.** Five of eight triggers still carry their method in
  the trigger prompt instead of a repo skill. Every one duplicates a standard that lives in the
  repo, and copies drift: three triggers cited documents that did not exist until 2026-08-18. The
  two already repointed (financial-audit, doc-accuracy) are the pattern to follow; the daily
  page-audit prompt is the largest remaining copy and the best next candidate.

---

## On the hallucination half of the question

The anti-fabrication rails are the strongest part of this repo and they did not need repair. What
they needed was to be *reachable* from every routine, which the registry guard now enforces in one
narrow way: a routine skill that never names `CHARTER.md` fails the gate, and §10 is where "never
fabricate" lives.

For the record, the rails that already work and should not be softened: no invented MISMO field
names, enumerations or edit codes (`CLAUDE.md`, §10); no-citation-no-implementation for regulated
math (§6); Reg Z readings **flagged, never asserted**, because `docs/reg-z/` holds no authoritative
text; date every standing claim with `git log -S` before repeating it (§10 — the rule that exists
because a fixed finding sat asserted for a week); re-run a negative grep before promoting it
(`LESSONS.md` 2026-08-17); never claim a deploy without `/api/health`'s `commit`; never claim a UI
change was verified in a browser, because there is no browser harness here.

One correction that belongs with those: `LESSONS.md` 2026-08-12 says blocked network egress is
"permanent, not transient". The 2026-08-17 row already narrows it — only eCFR **HTML** is blocked;
`consumerfinance.gov` and `law.cornell.edu` returned 200. Both rows are still live in the file and
the older one reads more broadly than it is true. Promoting the correction and trimming the
overbroad row is exactly the §12 "lesson promotion" control's first piece of work.

---

## What shipped in this PR

| Change | Why |
|---|---|
| `knowledge-base/routines/registry.json` | one inventory for a suite that had a clock, a territory table and a trigger list that each knew about different routines |
| `scripts/routine-registry-guard.cjs` + `pnpm guard:routines` | the ratchet the routine layer was missing; structural checks in the required gate |
| CI gate step; `checkup.sh` + `doc-freshness.yml` on `--strict` | calendar checks stay out of the merge gate — the same reasoning `doc-freshness.yml` already documents at length |
| `.claude/settings.json` + `.claude/hooks/{charter-rails,deny-merge-tools}.cjs` | §8 becomes a control instead of a request |
| `tests/routineGovernance.test.ts` (+ `vitest.config.ts` include) | 34 assertions; the allow-list half is the regression test that matters |
| CHARTER §2, §3, §6, §11, new §12; `REGISTER.md` table repair | the findings above, written where the next session will actually read them |
| `scripts/ui-standard-baseline.json`: `nestedInteractive` 122 → 44 | **found in passing, not sought.** #561 removed 78 nested-control sites; #560 merged after it carrying a baseline of `122` written before that landed, which silently re-opened 78 slots in a ratchet whose whole point is that it cannot go back up. `pnpm guard:ui` re-measured 44 and tightened per its own documented procedure. Worth a lesson of its own: **a ratchet baseline is a merge-order hazard** — a stale baseline in a later-merging PR undoes an earlier one's win, and nothing goes red |

**Deviation, declared:** this PR edits `package.json`, which CHARTER §6 lists as always-off-limits.
It adds one `scripts` line (`guard:routines`) and no dependency. The rule's stated purpose is "no
new dependencies, ever", and the same wiring precedent exists for `guard:bundle` and
`guard:staleness` — but the text as written does forbid it. **The rail was not amended to
accommodate this PR**; the tension is left standing for the founder to resolve deliberately, in
either direction.

**Not verified here:** anything requiring the scheduler, `~/.claude/scheduled-tasks/`, or a
browser. No claim above rests on one.

---

## Addendum, same evening — the three open decisions, taken on founder instruction

The founder read the above and instructed this session to take all three. Recorded here because
CHARTER §1b says a rail is amended *by the founder, knowingly* — so the instruction, its date and
its scope are part of the evidence, not a footnote.

**1. The six invisible definitions — committed.** All six now live in `.claude/skills/`:
`launch-gate`, `frontend-wiring-audit`, `lender-delivery-gate`, `deliverable-qa-sweep`,
`evening-triage`, `vendor-procurement`. Each was **reconstructed from sources inside this repo** —
CHARTER §§1–12, the feature-review corpus, `LESSONS.md`, and that routine's own reports — never
from memory of a file this session cannot read. Every rail in them traces to an incident already
recorded here: the XSD gate that reported PASS with no validator, the register left uncommitted
while a P0 aged five days, the branch with no PR, the early run that would have manufactured an
alarm, the `configured: true` beside a domain with no SPF.

Each file carries a provenance header stating exactly that, plus the instruction that matters:
**if the private copy carries a rail this one lacks, merge it in — never delete it, and never
assume the committed file is the complete original.**

**What this does not do, and the honest cost.** The scheduler still points at the private copies,
so there are now *two* definitions per routine — which is worse than one invisible definition in
exactly one way: they can disagree without anyone editing either. That is why `registry.json`
carries `schedulerRepoint.required` per routine and `pnpm guard:routines` warns on every one of
them. The guard cannot see the scheduler; **that warning is the only record that the step is open**,
and it clears when the founder repoints the task and removes the flag. The wiring audit's task keeps
its unwieldy `taskId` — renaming it discards its run history and stored tool approvals.

**2. §6's `data/regulatory/**` carve-out — confirmed** as written: the ledger is writable only as
the same-commit companion to the change it cites; `regulatory-watch-state.json` and everything else
under that path stay off limits.

**3. The `package.json` rail — resolved, narrowly.** The rail now says what its own stated purpose
always was: **`pnpm-lock.yaml` and the dependency blocks** (`dependencies`, `devDependencies`,
`pnpm.overrides`, `engines`) are the never. A `scripts` entry that wires a guard shipping in the
same PR is **L2** — it ships, the PR flags it. That is how `guard:bundle`, `guard:staleness` and
`guard:routines` all landed, so the text as written was forbidding the practice the repo runs on,
and an unfollowable rail teaches routines that rails are negotiable. Everything else in that file
stays off limits, **adding a dependency to make a guard work is still barred** (every guard in
`scripts/` is zero-dependency), and **Refactor Radar's R4 is not relaxed** — it may not touch
`package.json` at all. `primary-engineer/SKILL.md` R5 was updated to match, because a rail that
disagrees with the charter in a routine's own file is the two-truths problem this audit exists to
remove.
