# Trunk Health — 2026-08-20

STATUS: WARN — **the trunk is healthy and all four build lanes can work today; nothing they finish can land.** GitHub Actions has been down on a billing failure for ~22 h, so the one required check cannot start and all 21 open PRs are frozen.

---

## ⛔ Human actions

1. **GitHub Actions billing — the entire merge queue is frozen.** Every workflow since
   **2026-08-19 14:22 UTC** fails in 1–5 s with `steps: []` and this annotation, read live:

   > *"The job was not started because recent account payments have failed or your spending limit
   > needs to be increased. Please check the 'Billing & plans' section in your settings"*

   Fix in **GitHub → Settings → Billing & plans**. This is not a repo or workflow defect —
   `actions/permissions` reports `{"enabled":true,"allowed_actions":"all"}`. Note the 2026-08-18
   workaround is **no longer in place**: `gh repo view --json visibility` now returns **PRIVATE**,
   so private-repo minutes are being billed again. **Killed runs need a manual
   `gh run rerun <id>`** once billing clears — they do not retry themselves.

2. **The prod deploy pipeline is NOT paused — it is live and deploying.** The routine definition I
   run under states it is paused per PR #608. **#608 is open and unmerged.** Verified two
   independent ways: `.github/workflows/ci.yml` gates `migrate-prod` and `verify-deploy` on
   `github.event_name == 'push'` with no pause condition, and Railway actually shipped deployment
   `b9da904d` (SUCCESS) from the last push to `main`. Nobody intends this — either merge #608 or
   correct the seat definitions that assert the pause. **Decide before billing is restored**, because
   the moment Actions comes back, every merge is a production deploy again.

3. **PR #612 — the suite rewrite I am defined by has not merged.** `CHARTER.md` on `main` is still
   the 2026-08-18 Launch Gate version (`git log -1 -- knowledge-base/routines/CHARTER.md` →
   `f733e6ed`, 2026-08-18). Per CHARTER §11 a definition that the repo does not carry is a fossil in
   the making, and I am flagging rather than silently following the newer prompt. Three routine
   reports are stuck behind the same wall (#611, #613, #614).

---

## TRUNK verdict

```
TRUNK: healthy · main b799b91d · gates ✓ (13/13) · lanes clear: yes to build, NO to land
```

Everything CHARTER §7 and the CI `gate` job require was run on a **clean detached worktree at
`origin/main`**, after `pnpm install --frozen-lockfile` (exit 0) — never against the primary
checkout, which is dirty on a peer's branch.

---

## Summary

`main` is genuinely green: `tsc` clean, 3,000 node tests + 680 client tests passing, all thirteen
guards at baseline, production build and bundle ratchet green, and `pnpm audit --prod` reporting no
high or critical vulnerabilities. The trunk is not the problem — GitHub Actions is, and it has been
since 14:22 UTC yesterday, which is why 17 of 21 open PRs read `UNSTABLE` for a reason that has
nothing to do with their content. Four PRs (**#587, #597, #599, #603**) got a genuinely passing
`gate` *before* the outage began and are the only mergeable work in the queue the instant billing
clears. `pnpm checkup` fails on three overdue regulatory ledger entries. Prod is current
(`/api/health` commit == `origin/main` tip) — because the deploy pipeline everyone believes is
paused is still running.

---

## Evidence

### Gates on `origin/main` (`b799b91d`)

| Gate | Result |
|---|---|
| `pnpm check` | ✓ clean, no output |
| `pnpm test` node lane | ✓ **203 files, 3000 passed, 1 skipped** |
| `pnpm test` client lane | ✓ **104 files, 680 passed** |
| `pnpm guard:tokens` | ✓ 0 raw palette · 97 bare white/black (baseline) |
| `pnpm guard:querykeys` | ✓ convergence + reachability + transport all OK |
| `pnpm guard:schema` | ✓ every column migrated or baselined (29 legacy exempt) |
| `pnpm guard:migrations` | ✓ 57 migrations, contiguous idx 0..56 |
| `pnpm guard:channel` | ✓ 1482 lines / 4 files, frozen at baseline |
| `pnpm guard:kb` | ✓ 169 docs indexed, no dead links |
| `pnpm guard:docs` | ✓ 8 living docs within interval |
| `pnpm guard:ui` | ✓ 505 files, 9 metrics at baseline |
| `pnpm guard:staleness` | ✓ 5 metrics at baseline |
| `pnpm guard:citations` | ✓ 25 unresolved refs (at baseline) |
| `pnpm build` + `guard:bundle` | ✓ **523,584 raw bytes, at baseline** (3 eager chunks, ~159.3 kB gzip) |

`tests/complianceInvariants.test.ts` is inside the passing node lane — **no compliance incident.**

#### One flaky test found by accident — it can red any PR at random

The clean full run above passed 3000/3000 in **51 s**. The pre-push hook, run minutes later on the
same machine and the same commit, failed:

```
FAIL tests/statusVocabulary.test.ts > every literal compared against
     <task>.verificationStatus is canonical
Error: Test timed out in 15000ms.        ❯ tests/statusVocabulary.test.ts:447
Test Files  1 failed | 202 passed (203)
Duration  122.17s          # vs 51.31s on the clean run
```

**It is a load-sensitive timeout, not a defect.** Re-run in isolation three times:
**2.58 s / 3.42 s / 3.58 s**, 41/41 passing every time. The test regex-scans the source tree, so
under full-suite contention on a loaded machine it crosses the 15 s ceiling — it took 15.649 s.

This matters to the build lanes: it is a **non-deterministic red on `main`'s own test suite** that
any lane can hit on any PR, and diagnosing it costs a run each time. `main` itself is not broken —
CI's own gate passed on `b799b91d` at 14:12 UTC, and so did my clean run.

Two guards CI runs that my seat definition omits — `guard:ui` and `guard:staleness`/`guard:citations`
— were run anyway, because "lanes clear" means the *CI* gate, not a subset of it. `git status` in the
worktree was **empty after the full guard sweep**, confirming `citation-guard` did not rewrite its
baseline this run (the known local-poisoning trap).

### The CI outage

```
$ gh run view 32324702706 --json jobs
gate (typecheck · tests · schema guard)  failure  1s   steps: []
migrate-prod                             skipped  0s   steps: []
verify-deploy                            skipped  0s   steps: []

$ gh api .../check-runs/96293500650/annotations
"The job was not started because recent account payments have failed or your
 spending limit needs to be increased..."
```

Outage boundary, from `gh run list`:

- last success — `32263062715` `cron-jobs` **2026-08-19T14:16:47Z** (7 s)
- first failure — `32263590558` `cron-jobs` **2026-08-19T14:22:08Z** (3 s, same billing annotation)

The last CI run on `main` itself (`32262620835`, **14:12:22Z**, 2 m 8 s) **succeeded** — `main` was
never red. Every 3–5 s "failure" since is the biller, not the code.

### Build queue — 21 open PRs

**Green and mergeable the moment billing clears (gate observed passing, pre-outage):**

| PR | Title | gate |
|---|---|---|
| [#603](https://github.com/barakatammre84/Homiquity/pull/603) | 41 owner agents, one feature map — and the §9 gap the auth owner found | pass 3m16s |
| [#599](https://github.com/barakatammre84/Homiquity/pull/599) | fix(compliance): the assistant was the one borrower channel CS2 never scanned | pass 3m26s |
| [#597](https://github.com/barakatammre84/Homiquity/pull/597) | rescue(guard): the inert-button ratchet, written 2026-08-06 and never on a branch | pass 3m35s |
| [#587](https://github.com/barakatammre84/Homiquity/pull/587) | Let the calculator CTA wrap at 320px — five capture-path pages overflowed | pass 3m21s |

Confirmed with `gh pr checks`, not inferred from `mergeStateStatus` — `CLEAN` means no merge
*conflicts*, never "CI passed".

**Blocked on the biller (15 PRs, `UNSTABLE`):** #589, #595, #598, #601, #604, #605, #606, #607,
#608, #609, #610, #611, #612, #613, #614. None has content evidence against it; all fail in 3–5 s.

**Blocked on a real merge conflict (`DIRTY`) — these need a human regardless of billing:**

- **#596** `fix/ux-30-le-reachable-v2` — `CONFLICTING`, created 2026-08-19, last substantive commit
  **2026-08-18**. Nothing was ever scheduled for it: GitHub schedules **no** check-run for a
  conflicted PR, so its zero-check state is not the outage.
- **#542** `rescue: 13 unlanded 2026-08-12 compliance commits` — draft, `CONFLICTING`, last
  substantive commit **2026-08-12 = 8 days**. ⛔ per CHARTER §5's decide-or-close clock (>7 days,
  any state): it needs a recommended disposition with its surviving content recorded *first*. This
  is the PR whose entire purpose is recovering already-lost work; it is now itself the thing being
  lost.

**Auto-merge:** `autoMergeRequest` is `null` on **all 21** PRs. Nothing is armed to fire when Actions
recovers. Checked before writing anything about the queue, per the known "armed in an earlier
session" trap.

**Open > 5 days:** only #542 (8 days by last substantive commit). Everything else is ≤ 2 days.

### Security delta

**Baseline caveat, stated rather than papered over:** there is **no predecessor report to diff
against**. `knowledge-base/routines/reports/` on `main` holds nothing dated 2026-08-19, and the last
report from this seat is `2026-08-17-launch-gate.md`. The three 08-19 reports exist only on the
unmerged branches of #611/#613/#614. So the window below is **48 h of `main`**, not a delta.

Also honest: **`main` received zero commits in the last 24 h.** Its tip `b799b91d` landed
2026-08-19 09:12 CDT, just outside the window.

- **(a) `pnpm audit --prod`** — `5 vulnerabilities found · Severity: 1 low | 4 moderate`. **No new
  critical or high**, so CI's `--audit-level=high` step passes. The moderate is
  `@hono/node-server <1.19.15` reached via `.>@modelcontextprotocol/sdk>@hono/node-server`
  ([GHSA-frvp-7c67-39w9](https://github.com/advisories/GHSA-frvp-7c67-39w9)) — a transitive of the
  MCP SDK, correctly classified, not a dev tool mis-filed into `dependencies`.
- **(b) Secrets** — clean. One regex hit reviewed and dismissed: `scripts/local-db.sh:63` builds a
  loopback URL for the local Postgres the script itself creates. Not a credential; value not
  reproduced here.
- **(c) PII in logs** — clean. Zero `console.*`/`logger.*` calls under `server/` interpolating
  `ssn`, `dob`, `dateOfBirth`, `creditScore`, `accountNumber` or `routingNumber`. SSN persistence
  still routes through `server/services/ssnVault.ts`; the six files referencing SSN-encryption
  symbols are unchanged in the window.
- **(d) Routes changed** — three files, **all ≥ 2 days old, all already merged with their reviews**:
  `server/routes/agent-broker/invites.ts` (#576), `server/routes/lending/applications.ts` +
  `dashboard.ts` (#549), `server/routes/underwriting/compliance.ts` (#514).

  **§9 audited by running `detectTriggers()`**, not by reading the list — against the 308-file 48 h
  set plus the parsed diff `a8870681..b799b91d`:

  ```
  TRIGGERS: [ { label: "outbound messaging",
                evidence: "server/services/emailService.ts" } ]
  ```

  One trigger, attributable to #549 (the single submission email), which merged **2026-08-18** under
  a gate that was working. **No unreviewed trigger on `main`.**

### Regulatory freshness — `pnpm checkup`

Every other checkup row passes; the ledger is the sole failure. **3 overdue by 2 days**, named:

| Entry | Overdue | Interval |
|---|---|---|
| `regz-1026-36d2-dual-compensation` | 2 d (last verified 2026-08-04) | 14 d |
| `regz-1026-32b1-points-and-fees-floor` | 2 d (last verified 2026-08-04) | 14 d |
| `trid-1026-19e3-fee-tolerance` | 2 d (last verified 2026-08-04) | 14 d |

**6 more due within 3 days:** `regz-1026-36d2-consumer-paid-platform-fees`,
`regz-1026-36d1-referral-commission-payout`, `fcra-1681s2-furnisher-accuracy`,
`regv-1022-43-dispute-response`, `cdia-metro2-base-segment-layout`, `croa-1679b-advance-payment`.

All three overdue entries carry the **2026-08-04 blocked-network condition** in their notes and all
three cite `ecfr.gov`. Per `CLAUDE.md`, reachability here **has already flipped once** and is a thing
to test, not assert — **re-probing is the first step**, and I did not probe (this seat edits
nothing and clearing a ledger row is not its call). `cdia-metro2-base-segment-layout` is
**procurement, not a fetch**: the CDIA manual is licensed and not downloadable.

### Platform floor

- **GitHub Actions minutes — FAILING.** See ⛔ 1. This is the platform bill that matters, consistent
  with the 2026-08-18 finding that Railway is ~$3/month (#536).
- **Railway — alive and current.** `GET /api/health` on **both** hosts returns
  `commit: b799b91da401edd92a7d6af8c76a2b1743f271d1` == `origin/main` tip. Latest deployment
  `b9da904d` **SUCCESS**, 2026-08-19T14:12Z, service `Homiquity`; `homiquity-pm-db` SUCCESS.
  **I could not read Railway's billing balance or remaining credit** — the MCP surface I have exposes
  projects, status and deployments, not billing. Not guessed. It remains the founder's standing item:
  when the credit runs out, dev and prod both stop.
- **Prod drift: none** — and per this seat's rails that is reported as a fact, not a gate.

---

## Proposed tickets — for Evening Triage, ranked by lanes unblocked

1. **Restore GitHub Actions billing, then `gh run rerun` the killed runs.** Unblocks **all four build
   lanes plus every human session** — nothing merges until this is done. `.github/workflows/ci.yml`
   is not at fault; expected behavior is a `gate` job that starts and runs ~3 m.
2. **Decide #608 (pause the prod pipeline) before Actions returns.** `ci.yml`'s `migrate-prod` and
   `verify-deploy` should either carry the pause the fleet documents, or the fleet's seat definitions
   should stop claiming a pause that does not exist. Expected behavior: one answer, in the repo.
3. **Land #612 so `CHARTER.md` matches the fleet actually running.** Expected behavior:
   `knowledge-base/routines/CHARTER.md` §3 lists Trunk Health, not Launch Gate.
4. **Give #542 a disposition with its content recorded first** (CHARTER §5, >7 days). Expected
   behavior: a ledger row or named branch carrying the 13 compliance commits, *then* a close.
5. **Rebase #596 off `main`** — `CONFLICTING`, and a conflicted PR gets no check-run scheduled at
   all, so it will still be invisible after billing is fixed.
6. **Raise the timeout on `tests/statusVocabulary.test.ts:447`** (or scope its source scan). Expected
   behavior: the test cannot time out under full-suite contention — it needs 2.3 s of work and has a
   15 s ceiling it crossed at 15.649 s. Unblocks all four lanes from a random red they would each
   otherwise pay a run to diagnose.
7. **Re-probe the three overdue Reg Z / TRID ledger entries** (`data/regulatory/regulatory-ledger.json`).
   Expected behavior: `pnpm checkup` green, or each row re-dated with the probe result — never an
   asserted reading, since `docs/reg-z/` holds no authoritative text.

---

STATUS: WARN
