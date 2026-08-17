# Primary Engineer — 2026-08-17

STATUS: WARN — all three items shipped and verified (2 new ready PRs + the queue's only red PR
turned green), but both of yesterday's upstream reports are missing, and PR #537 has a dropped CI
event under investigation at write time.

Mode: **build** (first run of this routine; founder-triggered catch-up at 18:58 UTC, after the day's
Launch Gate). No backpressure: zero primary-engineer PRs were open at orient. Guard passed:
`.claude/skills/primary-engineer/SKILL.md` exists on `origin/main` (followed via
`git show origin/main:` — the working checkout's branch predates it).

---

## ⛔ Human actions

1. **Merge [#503](https://github.com/barakatammre84/Homiquity/pull/503) soon — its baseline is a
   race by design.** It was the queue's only red PR; it is now green (gate pass, run
   32060365045) after this routine re-baselined it to the measured tip (521,319 → 522,148 raw).
   Any future merge that grows the eager bundle re-reds it until it lands. The two web-flow
   "update branch" merges on it today suggest you were already trying.
2. **Two new ready PRs from this run:** [#537](https://github.com/barakatammre84/Homiquity/pull/537)
   (F-042 — the MCP soft-pull tool returned cached bureau data before its FCRA gate; gate now
   first and type-scoped) and [#539](https://github.com/barakatammre84/Homiquity/pull/539)
   (ux-20 — "hard inquiry" now visible at the consent ask). Both §9-clean by `detectTriggers()`
   on their final diffs. #514 (roadmap §3.2, the last N+1) also sits green and merge-ready from
   the retired sprint-blitz — this routine's absorbed queue; nothing further needed on it.
3. **KTLO-1 (Railway billing) remains the standing hardest item** — unchanged from today's Launch
   Gate report; not repeated here.

## Summary

First primary-engineer run: orient found gates green on fresh `origin/main` and today's Launch Gate
at `RELEASABLE: yes / WARN`, so no red-gate mandate, and the slate was picked from the verified
findings register plus the CHARTER §5 assist ladder. The R9 date-every-claim sweep found the
FINDINGS register badly stale — the P0/P1 credit cluster (F-034/F-035/F-036) and F-027 are all
already fixed on `origin/main` (02a4d8a and bba0132, both 2026-08-05) while still marked open — so
the highest-severity row that was open *and real* became item 1: F-042, the MCP soft-pull tool
returning cached bureau data before its FCRA consent gate (fixed structurally, gate-first made
unrepresentable, 9 new tests, PR #537). Item 2 worked the assist ladder instead of adding to the
queue: red PR #503's stale bundle baseline was re-measured against the true tip and the PR is now
green; item 3 closed ux-20 by making the hard-inquiry fact visible at the consent ask in the
platform's own ratified disclosure language (PR #539, proof-by-empty-disclosure test). Main moved
four merges mid-run (the founder was actively draining the queue), which was handled by re-fetching
and re-measuring rather than shipping against a stale base.

## Evidence

**Guard + orient**
- Skill present: `git cat-file -e origin/main:.claude/skills/primary-engineer/SKILL.md` → exists.
- Orient gates on fresh `origin/main` @ `c130522` after `pnpm install --frozen-lockfile` in a fresh
  worktree: `tsc` clean · node lane **193 files / 2739 passed, 1 skipped** · client lane
  **72 files / 509 passed**. CI on main: 5 consecutive successes (latest 18:52Z).
- Launch Gate 2026-08-17: `RELEASABLE: yes · drift 0 · gates ✓ · rollback ✗` (STATUS: WARN,
  founder-held causes).
- **Missing upstreams (the WARN):** no `deliverable-qa-sweep` or `evening-triage` report exists for
  2026-08-16 on `main` or any branch (`gh pr list --state all` searched; today's Launch Gate
  independently confirmed the 08-13→08-16 gap across every remote branch). Most recent available
  upstream taken instead: the 2026-08-17 launch-gate report + the FINDINGS register itself.
- Session listing (R4 fallback — `ListAgents` absent in this harness): `ccd list_sessions`, advisory
  only, read last: QA Sweep live in the primary checkout (branch `routine/qa-sweep-2026-08-17`,
  uncommitted FINDINGS/DOMAINS edits — untouched by me), the lease-stack session running (so #518's
  conflict was left to its owner — it merged itself within the hour), Launch Gate running.

**R9 — stale claims found (and not rebuilt)**
- F-034/F-035/F-036 marked open in FINDINGS: **fixed** in `02a4d8a` (2026-08-05) —
  `CONSENT_PULL_COVERAGE`/`consentCoversPullType` live in `server/services/creditConsents.ts:32-39`,
  scope check in `creditPulls.ts` (`requestCreditPull`), `isSimulated: creditVendorIsSimulated()`
  at insert, both `createCreditConsent` callers passing real shown text
  (`server/routes/compliance.ts:465`, `server/routes/lending/applications.ts:193`).
- F-027 marked open: **fixed** in `bba0132` (2026-08-05) — borrower free text goes to its own
  `borrowerDescription` column (`server/routes/lending/documents.ts` upload registration), the
  value-parsing branches deleted from `server/services/borrowerGraph.ts:355+` (migration 0046
  referenced in-code).
- Roadmap §2.1 "Land or close #446": **#446 MERGED 2026-08-07T03:07Z** (`gh pr view 446`). Row is
  stale; roadmap edits are Evening Triage's.
- F-024 (TRID business-day definition) left untouched **on purpose**: the corrective direction
  (Sat-counting precise definition) would *shorten* the CD wait, and `docs/reg-z/` holds no
  authoritative text to verify against — per the Reg Z rail it stays flagged, never asserted.

**Item 1 — F-042 (PR #537, ready)**
- Defect verified live pre-build: `server/mcp/index.ts` step 3 (cache return) preceded step 4
  (consent gate), gate selected `{ id }` only with no `consentType` filter.
- Fix: `server/mcp/softPullGate.ts` — `authorizeSoftPull` (newest active consent must cover "soft"
  via `consentCoversPullType`; refusals `no_active_consent` / `consent_scope_mismatch`),
  `readCachedSoftPull(applicationId, consent)` requiring the authorized consent as a parameter,
  `evaluateSoftPull` as the single composition the handler calls. New audited refusal
  `consent_scope_mismatch` carries consent id/type.
- **Reintroduce-the-bug proof:** with the pre-fix order temporarily restored, **5 of 9 new tests
  fail**; with the fix, 9/9 pass — including `queriedTables` assertions that a refusal never reads
  `credit_pulls`. Test file registered in `vitest.config.ts` node `include:` and its name asserted
  in run output.
- `tests/complianceInvariants.test.ts` FCRA assertion updated to the **strictly stronger** form
  (old: `creditConsents` appears somewhere in `index.ts` — which held while the gate sat *below*
  the cache return; new: pins `evaluateSoftPull` wiring + gate-module query + both refusal
  reasons). Recorded here because a `complianceInvariants` edit must never pass silently.
- Gates: `tsc` clean · node **194/2748+1skip** · client **72/516** · build OK · 8/8 `guard:*` OK ·
  `detectTriggers()` on the final diff (6 files, 526 lines): **zero triggers** → ready, not draft.
- ⚠ At write time the PR had **zero check runs** (the dropped-event class CI's own comment
  documents); a `--no-verify` empty-commit nudge was pushed (`e25652b` — sanctioned skip: empty
  tree-delta on a tree whose full gate suite had just run green locally). If checks are still
  absent when read, close/reopen #537 — `gh run rerun` cannot help when no run exists.

**Item 2 — #503 assist (no new PR)**
- Was: gate FAIL (`bundle-size-guard: baseline 521,319 → now 522,104/522,148`). Branch adds zero
  client bytes (`git diff origin/main...HEAD -- client/` empty) — the growth was main's five days
  of merged client work, so the ratchet was red on growth it did not cause.
- Done per the guard's own red-message procedure: merged `origin/main` @ `4d7d919`,
  `pnpm install --frozen-lockfile` re-run, `pnpm build`, baseline set to the guard's own measured
  **522,148**; attribution comment on the PR names the merges the bytes bought.
- Now: **gate PASS** (run 32060365045, 5m7s). Claim taken and released on the branch itself.
- Mid-item, `origin/main` advanced four merges (#517 #518 #522 #528 — the founder actively
  merging); re-fetched and re-measured before baselining. Vendor chunk hashes unchanged across the
  dependabot bumps, so the number stands on the true tip.

**Item 3 — ux-20 (PR #539, ready)**
- Defect verified live pre-build: `consentType: "hard_pull"` hardcoded
  (`CreditConsent.tsx:169`) while checkbox label, fine print, and callouts said nothing about a
  hard inquiry — the fact lived only inside the `h-64` ScrollArea disclosure.
- Fix: callout (`alert-hard-inquiry`) + acknowledgment label + fine print now name the hard
  inquiry, wording mirrored from the ratified FCRA disclosure item 2
  (`server/services/creditCatalogs.ts`) — nothing invented, disclosure document untouched,
  strengthening only.
- **Proof both ways:** colocated test seeds the disclosure text **empty** and asserts the facts
  still render (visibility independent of the buried document): 4 red on the pre-fix page →
  **543/543 client tests green** after. Node **193/2748** · `tsc` clean · build OK · 8/8 guards OK
  (`guard:tokens` at baseline — default `Alert` variant, no palette classes) · `detectTriggers()`:
  zero.
- PR created via REST (`gh api repos/…/pulls`) after `gh pr create` hung — the GraphQL flakiness
  called out for today.

**Ops note for peers:** a concurrent session activated `core.hooksPath=.githooks` mid-run, so every
push now runs CI's full gate locally (~5 min) — pushes that exceed a 2-minute command timeout look
like hangs. Plan timeouts accordingly; `--no-verify` only per the hook's own skip-once doc.

**Claims:** three taken, three released (REGISTER.md Active → Recently released, each on its item's
branch). No capture-path, radar-ledger, or deferred-lender file touched; no schema, no migrations,
no dependencies.

## Proposed tickets — for Evening Triage

| id | rank | item |
|---|---|---|
| **PE-T1** | A/register-hygiene | **Close the stale FINDINGS rows the R9 sweep dated:** F-034/F-035/F-036 (fixed `02a4d8a`, 2026-08-05) and F-027 (fixed `bba0132` + migration 0046, 2026-08-05) — all still marked open; plus F-042 and ux-20 once #537/#539 merge. Register edits belong to QA Sweep/Triage, not this routine. Today's live QA Sweep may already be carrying part of this — dedupe against its report. |
| **PE-T2** | roadmap-hygiene | **Roadmap §2.1 is done:** #446 merged 2026-08-07; the row still says "currently blocked on KTLO-2". Delete/annotate per Triage's §0–§3 authority. While there: §3.2's fix is open+green as #514 — the row could point at it. |
| **PE-T3** | A (escalation) | **F-040's open question, so the mechanism can be built:** the stored disclosure promises 120-day validity but `credit_consents` has no expiry and no gate checks age. Mechanism (column + age gate) is a straightforward future PE item **once the founder answers**: does the 120-day validity bind funnel soft-pull consents too, or only `/credit-consent` hard-pull consents? Strictest defensible reading (bind everything, force re-consent past 120d) is available if no answer comes — logged as PE-006 on the ledger. |

STATUS: WARN
