# Launch Gate — 2026-08-17

STATUS: WARN — main is clean and prod is current, but there is **no one-step rollback** (Railway's
72 h image retention lapsed ~42 h ago) and the routine suite has produced **no report in five days**.

```
RELEASABLE: yes · main 1f520b1 · prod 1f520b1 · drift 0 commits · gates ✓ · rollback ✗
```

---

## ⛔ Human actions

1. **KTLO-1 — Railway billing. Time-bound, and it is now the closest thing to a deadline in this
   repo.** `CTO_ROADMAP.md:37` recorded "~30 days / ~$4.97 of credit left" on **2026-08-07**
   (`git log -S "Railway trial expiry"` → `8d96917`, 2026-08-07). That puts exhaustion around
   **2026-09-06 — roughly 20 days out**. When it runs out **production stops serving**. Railway →
   project `Homiquity` → Settings → Billing. I cannot verify the remaining balance: the Railway MCP
   exposes projects/services/deployments, not billing. **Founder-held.**

2. **`rollback ✗` — escalate to `CTO_ROADMAP.md` §0.** Prod's live image is **113.9 h old** and the
   previous deployment is **114.3 h old**; Hobby retention is **72 h**, so there is no image to roll
   back to. Every prior deployment reports `status: "REMOVED"`. A bad deploy today can only be undone
   by `git revert <sha>` + push and a full rebuild (CHARTER §8), which is minutes, not seconds. This
   is a **consequence of KTLO-1**, not an independent item — leaving Hobby fixes both.

3. **The suite has been dark since 2026-08-12.** `knowledge-base/routines/reports/` holds exactly one
   report (`2026-08-12-wiring-audit.md`). Eight routines × 5 days should have produced far more. This
   is the §0 failure mode the charter exists to catch — *"a routine that cannot be shown to have run
   is not a control."* Most likely cause is benign (CHARTER §3: scheduled tasks only run while the app
   is open, and this very run was suspended mid-flight for ~4.5 days — see Coverage). It still needs a
   deliberate confirm-or-fix rather than an assumption. **Founder-held.**

---

## Summary

`origin/main` is `1f520b1` and every gate is green on that exact SHA — `tsc` clean, 2,714 node +
509 client tests passing, all seven `guard:*` green — and prod's `/api/health` reports the same
commit, so drift is zero and the silent-stale-deploy failure mode is not present. The real exposure
is operational, not code: Railway's 72 h image retention lapsed ~42 h ago, so there is no one-step
rollback, and that traces directly back to the unpaid Hobby plan in KTLO-1. Nothing has merged to
`main` in **4.7 days** while **17 PRs sit open** (none with auto-merge armed — checked), and the
routine suite has written no report since 2026-08-12; GitHub Actions itself is healthy, so this is a
queue that stopped being drained, not a broken gate. The security delta is clean: no secrets in the
window, no PII interpolated into server logs, `ssnVault` still the only SSN persistence path, and the
one client/server role-gate pair I traced matches. `pnpm checkup` exits non-zero on **dependency
vulnerabilities** — 1 low + 4 moderate, **zero critical/high**, all unreachable in this deployment
(detail below), which means checkup is now a permanently-red check, and a permanently-red check is a
dead check.

---

## Evidence

### Releasable verdict

| Field | Value | Source |
|---|---|---|
| main | `1f520b152fd762fbefb6d97e2f29c351120ed473` | `git rev-parse origin/main` |
| prod | `1f520b152fd762fbefb6d97e2f29c351120ed473` | `GET /api/health` |
| drift | 0 | `git rev-list --count 1f520b1..origin/main` → `0` |
| gates | ✓ | below |
| rollback | ✗ | below |

```
$ curl -s https://www.homiquity.com/api/health
{"status":"ok","timestamp":"2026-08-17T16:21:00.616Z",
 "commit":"1f520b152fd762fbefb6d97e2f29c351120ed473",
 "email":{"configured":true,"providers":["sendgrid"]}}
```

Prod matches `origin/main`. Per CHARTER §2 this `commit` field is the only proof of a deploy, and it
is the proof here — not a green check.

### Gates — all green on `1f520b1`

Run in a throwaway detached worktree pinned to `1f520b1` (see Coverage for why), after
`pnpm install --frozen-lockfile` on that tree.

```
$ pnpm check
> tsc
(no output — clean)

$ pnpm test
 Test Files  191 passed (191)
      Tests  2714 passed (2714)     # node lane
 Test Files   71 passed (71)
      Tests   509 passed (509)      # client lane
```

`tests/complianceInvariants.test.ts` is present in the node lane's explicit allowlist
(`vitest.config.ts:115`) and is inside the 191 passing files — the ECOA/Reg B invariants ran and
passed. No compliance incident.

The `security-review-guard: FAIL — CHANGED_FILES is empty` lines in the test output are that guard's
own tests exercising its failure paths, not a failing gate; the file count and totals above are the
verdict.

```
design-token-guard: 0 raw palette color occurrences (at baseline, no regression). ✅
design-token-guard: 97 bare white/black literal occurrences (at baseline, no regression). ✅
✅ guard:reachability — OK (every /api invalidation matches a real fetch key)
guard:transport — OK (no hand-written queryFn; every key derives its own URL)
schema-migration-guard: OK — every schema column is migrated or baselined (29 legacy exempt).
migration-ledger-guard: OK — 57 migrations, contiguous idx 0..56, every entry has its file and every file is journalled.
delivery-stack-freeze-guard: 1482 lines across 4 files (baseline 1482). Frozen, no growth. ✅
KB index OK: 135 docs, all indexed; no dead links.
doc-freshness-guard: 6 living docs verified within interval. ✅
```

Before treating any of this as "main is broken" I confirmed CI independently (CHARTER §10):

```
$ gh run list --branch main --workflow CI --limit 3
completed  success  fix(address): a failed geocode left a complete-looking address…  CI  main  push  2026-08-12T22:53:54Z
completed  success  chore(routines): rent-reporting-watch — the gate-erosion watchdog…  CI  main  push  2026-08-12T22:28:19Z
completed  success  docs(routine): release the claim, record the completed queryClient…  CI  main  push  2026-08-12T22:27:48Z
```

Actions is **not** in an outage — `cron-jobs` ran successfully at 14:16Z today and three Dependabot
PRs built green at 14:00–14:01Z. Main simply has not received a merge since 2026-08-12.

### `rollback ✗` — the retention window lapsed

```
now UTC          : 2026-08-17T16:49:12+00:00
current deploy   : 2026-08-12T22:53:53+00:00 -> 113.9 h old   (SUCCESS, 1f520b1)
previous deploy  : 2026-08-12T22:28:18+00:00 -> 114.3 h old   (REMOVED,  0922545)
```

Source: Railway MCP `list-deployments`, project `605689d2-0dbf-4c7d-99cb-ad67779f58d1`. The ten most
recent deployments are one `SUCCESS` and nine `REMOVED`, all created 2026-08-12T21:44–22:53Z.
Retention on Hobby is 72 h (`CTO_ROADMAP.md:37`, `knowledge-base/runbooks/ROLLBACK.md` §1), so every
rollback target is ~42 h past expiry. Mitigation that still works: `git revert <sha>` + push, which
triggers a rebuild (CHARTER §8).

### Security delta

Baseline: there is no prior Launch Gate report, so the window is **every commit on `main` since
2026-08-12 00:00** — 35 commits, 274 files, 21,220 changed lines. That is wider than the routine's
nominal 24 h and deliberately so; a 24 h window today is empty.

**(a) Dependency vulnerabilities — `pnpm audit --prod`: 1 low, 4 moderate, 0 critical, 0 high.**
All five are transitive under one path:

```
Paths  .>@modelcontextprotocol/sdk>@hono/node-server   (GHSA-frvp-7c67-39w9)
Paths  .>@modelcontextprotocol/sdk>hono                (GHSA-79qm-7rj5-m7r9)
```

Classification checked before proposing anything (the `vitest`-in-`dependencies` lesson):
`@modelcontextprotocol/sdk ^1.30.0` is in `dependencies` **correctly** — `server/mcp/` is a shipped
runtime feature, not tooling. And the vulnerable code is **not reachable in this deployment**: both
advisories are in the SDK's HTTP transport, while `server/mcp/index.ts:6,565` uses
`StdioServerTransport` and nothing else. `hono` is not a direct dependency. **No override proposed
and none warranted** — the correct fix is an SDK bump when upstream ships one, or a recorded accepted
risk. See ticket LG-3.

**(b) Secrets in the window — none.** Scanned all 35 commits' added lines for `sk-…`, `api_key=…`,
`password=…`, `BEGIN … PRIVATE KEY`, `postgres://user:pass@`. Zero hits. (No value would be printed
here even if there were — file:line only.)

**(c) PII in logs — none.** No `console.*` or `logger.*` call under `server/` interpolates `ssn`,
`dob`, `dateOfBirth`, `creditScore`, `accountNumber`, or `routingNumber`. SSN persistence remains
confined to `server/services/ssnVault.ts`; the only other referents are `server/storage/urla.ts`
(imports `resolveSsnInput`/`decryptSsnFromRow` from the vault — `server/storage/urla.ts:8`),
`server/services/piiVault.ts`, and the backfill script. No new persistence path.

**(d) §9 triggers — audited by _running_ `detectTriggers()`, not by reading the list** (CHARTER §10).
Over the 274-file change set:

```
consumer-data furnishing (CRA)      server/services/rentFurnishing.ts
PII encryption call site            server/storage/leases.ts: const e = encryptSensitiveData(value);
role/permission gates               server/routes/rate-sheets.ts: requireRole("admin") on /api/wholesale-lenders
PII / consent column in shared/schema  shared/schema/rent.ts: landlordEmailEncrypted
```

The first, second and fourth all belong to **#488** (lease capture), whose PR body carries a
`## Security review` heading — the gate was satisfied. Standing caveat, restated because it matters:
that proves the review was **written down**, never that it was **correct**.

Routes changed in the window: 12 files under `server/routes/`. I traced the one gate the trigger
named. `SubmissionReadinessDialog.tsx:113` fetches `/api/wholesale-lenders`, and `rate-sheets.ts:21`
documents that the collection `GET` is deliberately registered elsewhere; the live handler is
`server/routes/underwriting/submissions.ts:68` with
`requireRole("admin","lo","loa","processor","underwriter","closer")`. The dialog is reached from the
LO Command Center (`client/src/pages/staff/loCommandCenter/ActionsRail.tsx`). **Client gating matches
the server gate — no drift on this pair.** The other eleven route files were not individually traced
(see Coverage).

### Regulatory freshness

```
$ pnpm checkup
PASS  regulatory ledger fresh
```

**No overdue ledger entries.** Two checks in `checkup` do fail, neither of them a gate result:

- `FAIL in sync with origin/main` — an **artifact of my detached gate worktree**, which is pinned to
  `1f520b1` (= `origin/main`) but has no upstream-tracking branch. Not a finding.
- `FAIL dependency vulnerabilities` — the five advisories above; zero critical/high.

### Launch distance — `CTO_ROADMAP.md` §0–§5

| Section | Open |
|---|---|
| §0 keep-the-lights-on | **3** (KTLO-1 Railway billing · KTLO-2 Actions capacity · KTLO-3 Neon cold starts) |
| §1 founder-held, blocks go-live | **10** (0 checked) |
| §2 engineering, launch-blocking | **3** (2.1 land/close #446 · 2.2 uploads end-to-end · 2.3 prod acceptance test) |

Verified rather than trusted:

- **NMLS** — `shared/companyIdentity.ts:16` → `nmlsId: "427468"`. F1 is cleared; lender outreach
  (§1.3) is live, unworked work, not gated work.
- **Prelaunch gate** — probed, not read off a checkbox: `GET /` → 200, `GET /api/rates` → 200, and
  the served HTML contains no `prelaunch` / `coming soon` / `beta access` / `waitlist` marker. This is
  **consistent with §1.1's flip already being done in production**, while `CTO_ROADMAP.md:59` still
  carries it unchecked. Evening Triage should reconcile that box. Caveat: a 200 on `/` is weaker
  evidence than the `/api/rates` 200, since an SPA could gate client-side.
- **KTLO-2 is stale as written** — it describes Actions queueing 30+ min and runs failing, observed
  2026-08-06. Today Actions is healthy (evidence above). The item may still be live as a *billing*
  question, but its symptom description no longer matches reality.

### The most important unblock today

**KTLO-1 (Railway billing).** It is §0, it is time-bound at ~20 days, it is the only item whose
lapse stops production outright, and it is simultaneously the cause of the `rollback ✗` in today's
headline. Nothing in §1 or §2 is worth starting ahead of it.

The most important **engineering** unblock is different and worth naming separately: **drain the PR
queue.** 17 PRs are open, 13 of them created 2026-08-12 or earlier, and `main` has not moved in 4.7
days. Among them are fixes for exactly the silent-success defect class this repo keeps rediscovering
(#509 "five mutations failed in silence", #511 "two OPTIONAL verifications reported the file as fully
verified", #512 "Print did nothing"), plus #519 "a stacked PR got zero checks and still read as
CLEAN" — a gate defect, which should go first because it governs the trustworthiness of the rest.

Checked and clean: **no open PR has auto-merge armed** (`gh pr list --json autoMergeRequest` → all
`no`), so there is no armed `--auto` waiting to fire (CHARTER §8).

---

## Coverage and gaps — what this run did *not* prove

- **This is `pnpm audit` + `tsc` + tests + greps. It is not SAST or DAST.** No taint analysis, no
  fuzzing, no authenticated endpoint sweep. "No critical/high" is a statement about published
  advisories in the dependency tree, not about this codebase's own vulnerabilities.
- **No dev server was started and no browser verification happened.** Unattended run; every claim
  above is from static inspection, the test suites, or an HTTP probe of production.
- **This run straddled two multi-day host suspensions.** It began 2026-08-12 17:35 CDT, the machine
  slept, and it resumed and completed 2026-08-17. My first gate pass ran against `0922545` and is
  discarded; **everything reported here was re-run against `1f520b1`**, current `origin/main` at
  16:49Z today. This is also the most likely explanation for the five-day gap in `reports/` —
  CHARTER §3's "scheduled tasks only run while the app is open" — but I am reporting it as unconfirmed
  rather than assuming it.
- **The primary checkout was dirty on arrival** (`knowledge-base/feature-review/FINDINGS.md`,
  `DOMAINS.md` — a peer QA-sweep session's uncommitted work). Per CHARTER §5 I did not touch it; the
  gates ran in a separate worktree instead, which is why `checkup`'s sync check reads FAIL.
- **11 of the 12 changed route files were not individually gate-traced** — only the pair
  `detectTriggers()` named. A full route-by-route authorization audit is a QA Sweep job, not a gate.
- **No REGISTER.md claim was taken.** Launch Gate's territory is "nothing" (CHARTER §6); this report
  is its only write.

---

## Proposed tickets — for Evening Triage to land

| id | rank | item |
|---|---|---|
| **LG-1** | §0 | **Leave Railway Hobby / add a payment method.** Closes KTLO-1 *and* restores a one-step rollback (72 h retention is a Hobby limit). Today both are broken by the same cause. Founder-held, ~20 days of runway. Neither A nor B directly — it is the precondition for both. |
| **LG-2** | §0 | **Record `rollback ✗` explicitly in `CTO_ROADMAP.md` §0** with today's measurement (113.9 h since deploy vs 72 h retention) so it is a tracked item and not a line in one report. Per the routine's own step 3 this is a §0 escalation. |
| **LG-3** | B | **Resolve the permanently-red `pnpm checkup` dependency check.** 1 low + 4 moderate, all transitive under `@modelcontextprotocol/sdk` → `hono` / `@hono/node-server`, all in an HTTP transport `server/mcp/` never loads (stdio only). Either bump the SDK when upstream patches, or record an accepted-risk exception the check can read. Leaving it red trains everyone to ignore `checkup` — the same "control that isn't a control" failure as CHARTER §0. **No `pnpm.overrides` floor**: classification is already correct and an override would hide a real path if the transport ever changed. |
| **LG-4** | A/B | **Drain the PR queue, starting with [#519](https://github.com/barakatammre84/Homiquity/pull/519)** ("a stacked PR got zero checks and still read as CLEAN"). A gate that can read CLEAN without running governs the trustworthiness of the other 16 merges, so it goes first. Then the silent-success fixes (#509, #511, #512) — question B, and the defect class this repo keeps rediscovering. |
| **LG-5** | — | **Reconcile `CTO_ROADMAP.md:59` §1.1.** Probed prod suggests the prelaunch flip is already done (`/api/rates` 200, no gate markers served); the box is still unchecked. Confirm in Railway → Variables, then check it. Cheap, and it removes a false launch blocker from the founder's list. |
| **LG-6** | — | **Confirm or fix the five-day reports gap.** Only `2026-08-12-wiring-audit.md` exists. If it was the laptop being shut (likely, given this run's own suspensions), say so in the register so the next Launch Gate does not re-raise it; if the scheduler lost registrations, that is CHARTER §11 and a fossil in the making. |

---

STATUS: WARN
