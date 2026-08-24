# Selling Guide Steward — 2026-08-24

STATUS: WARN — the corpus is sound and the drill is byte-identical, but **the seat did not run
itself**: its scheduled slot never dispatched, and two manually-fired sessions did the work and
landed nothing. This report was produced **by hand** from a founder-directed session, not by the
routine. That distinction is the whole point of the report, so it leads.

## ⛔ Human actions

1. **The scheduled path is broken and unexplained.** `trig_0178zdN8Y27qPKtFWUGoNaFb` was due
   `2026-08-24T05:36:53Z`. `next_run_at` advanced to 08-25 and **no session was created** — the
   newest session in the account at 09:57Z was seven hours older. No branch, no report, no PR,
   and every gate green. Tomorrow's 05:36Z firing is the open test.
2. **Two manual fires ran and landed nothing — cause unknown.** `fire_trigger` dispatches
   immediately (proving the trigger, skill and prompt are fine), but both sessions ended `IDLE /
   REVIEW_READY` having pushed no branch and opened no PR:
   - `session_01HeWJA3FmJyCXggDp5SMS63` — 10:04:33→10:13:34Z, 34,322 output tokens
   - `session_018bGdoWV2Bv6r5kVShaNdk2` — 10:26:02→10:32:37Z, 23,140 output tokens (this one ran
     **after** #719 fixed the Phase 4 wording, so that wording was **not** the cause)
   Both are `origin: force_run_trigger`, `permission_mode: auto`, served by `claude-sonnet-5`.
   Their transcripts are not readable from another session, so the failure point is invisible from
   here. **This is the finding that matters and it is not closed.**
3. **Eight other CCR triggers sit frozen at `next_run_at: 2026-08-19`** — five days stale — while
   the routine work that actually lands comes from the local Mac fleet. Same symptom, other seats.
   If CCR dispatch is unreliable, the fleet decision (CHARTER §3 local vs §3a CCR) is yours.
4. **Standing, unchanged:** allowlist `*.fanniemae.com` in the environment network settings. All
   four edition sources and 21 hosts remain blocked; every one is acknowledged, so this is a WARN
   rather than a coverage regression — but the watch cannot see a new edition until it is lifted.

## Summary

The corpus itself is in excellent shape: the from-scratch drill recovered the PDF from git history
and produced byte-identical output across two consecutive runs on a `main` that has moved
substantially since the corpus landed, which is the first real proof the extraction chain survives
trunk movement. All four guards pass and the tracked fact layer regenerates with an empty `git
diff`. The watch sweep ran and honestly reported itself incomplete (exit 3) because every Fannie
host is blocked from this environment. What is broken is not the Guide corpus but the *seat*: it
has never once run itself to completion, in either the scheduled or the dispatched path. That is
precisely the failure CHARTER §0 records and §7 forbids, which is why `scripts/selling-guide-freshness.cjs`
now fails on a missing report (#718) and the skill now requires one every run (#719).

## Evidence

**The drill — run twice in a fresh worktree off `origin/main` @ `b74d06a`:**

```
recovered Selling-Guide_08-05-2026.pdf from git history (blob c984148cc830, sha256 verified)
source=Selling-Guide_08-05-2026.pdf sha256=✓ pages=1185 toc=554 sections=423 groups=131 revised=25
  links: 319 unique urls (295 ok / 22 mailto / 2 malformed) 989 xref edges

run 1 tree sha256: e9a0647efb0d476ae7f47a431f33f5a16058f5b5c986921c36adde87814b5b20
run 2 tree sha256: e9a0647efb0d476ae7f47a431f33f5a16058f5b5c986921c36adde87814b5b20   BYTE-IDENTICAL
git status after both runs: clean (tracked fact layer regenerates exactly)
```

**Guard battery:**

```
python3 scripts/extract-selling-guide.py --check   → tracked fact layer is current            exit 0
node scripts/selling-guide-corpus-guard.cjs        → ok — 554 TOC entries, 423 sections, 319 URLs, pymupdf 1.28.2   exit 0
node scripts/selling-guide-coverage.cjs --check    → ok — 423 sections, map current           exit 0
```

**Watch sweep** (`--update-state`, exit 3 — incomplete, correctly *not* an all-clear):

```
UNREACHABLE  Selling Guide HTML edition (Part B): HTTP 403
UNREACHABLE  Selling Guide announcements: HTTP 403
HOST-BLOCKED selling-guide / singlefamily / capitalmarkets / www .fanniemae.com, studentaid.ed.gov
Observed 0/4 edition sources; links: 0 ok, 0 rot, 22 denied, 273 host-blocked, 0 unreachable of 295 probeable
```

Zero `rot` against 273 host-blocked is the denied-is-not-rot rule working: no false link-rot signal
was emitted for a host this environment simply cannot reach.

**Seat liveness** — `list_triggers` shows `next_run_at` advanced 08-24 → 08-25 with `enabled: true`,
`ended_reason: null`. `last_run` is `NONE` for **all 25 triggers**, including ones that provably ran,
so it is not evidence in either direction. Branch search across all 141 branches: no
`routine/selling-guide-steward-*`. `list_sessions` (filtered and unfiltered): no session at or after
05:36Z.

## Proposed tickets

1. **Determine why a `force_run_trigger` session lands nothing.** The routine's procedure is proven
   sound — every phase above ran clean by hand in the same repo. The next diagnostic is reading a
   fired session's transcript in the claude.ai UI, which only the founder can do.
2. **Decide the fleet for this seat.** If CCR dispatch stays unreliable, move it to the local Mac
   fleet alongside Doc Accuracy, and update CHARTER §3/§3a in the same change.
3. **Do not treat manual firing as the schedule.** A seat that runs only when a human pokes it is
   not a scheduled control (CHARTER §7); #718's check is what will keep saying so.

## What this run did NOT do

No edition cutover (no new-edition signal — the PDF endpoint is unreachable, not different). No
`acknowledgedBlocked` entries authored: the 21 blocked hosts were already acknowledged on 08-23 and
no NEW blocked host appeared. No product code, no `scripts/**`, no pinned constants, no
`knowledge-base/handoff/**` touched.

STATUS: WARN
