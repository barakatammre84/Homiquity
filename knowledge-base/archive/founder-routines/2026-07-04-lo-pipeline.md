# Morning LO Pipeline Handoff — 2026-07-04

> **⛔ ARCHIVED 2026-07-08 — launch-era snapshot (2026-07-02 → 07-06), superseded. Do not act on this document.** Current truth lives in the 🚀 Launch sprint of [CTO_ROADMAP.md](../../../CTO_ROADMAP.md); see the [archive rationale](../README.md). Retained for history only; its dated findings are preserved as written.

**STATUS: WARN** — no live stalled file exists to be silently ignored today (there are no live LO borrower files at all — this ran against seed data as a drill), and every shipped No-Stall surface (fileHealth, LO Command Center, deal-team scoping, MISMO export gate) verified working on current `main`. WARN, not OK, because the doc-request one-click-approve automation the ping workflow depends on still doesn't exist — pre-launch, not a regression.

**No-Stall verdict: Can we honestly promise "no file goes stale silently" today? YES, conditionally.** No file is currently stale (all seed-data rows show `daysIdle: 0`, one `withdrawn` file is a correct terminal red, not a stall), and the automation that would catch a stale file — `fileHealth.ts`'s 48h rule surfaced live on the queue — is verified working. The unmet piece is forward-looking: once real files exist, the founder can be *notified* of a stall (fileHealth/Command Center works), but cannot yet forward an LO a ready-to-approve document request — that step is still manual. That gap doesn't break the promise itself, only the polished pitch of it.

---

## Human actions

**Ping-ready checklist:** None today — no live borrower files exist yet, so there is nothing to ping an LO about. This section will populate the next time this routine finds a real file idle ≥48h.

**⛔ Items:**
- None blocking. One gap flagged for the backlog (see LO-M17 below) — not urgent, not a live incident.

---

## Summary

This is a pre-launch drill: the platform has zero live LO borrower files, so triage ran against the 38 seed-data rows in `/api/pipeline/queue`, none of which are idle or stalled (all show `daysIdle: 0`; the single red row is a correctly-terminal `withdrawn` file, not a stall). The three No-Stall surfaces shipped in PR #33 — `fileHealth.ts`, the LO Command Center, and per-row MISMO export — were verified against current `main`, not memory, and all work correctly. The MISMO export access gate (H8) is fixed and tested; a same-day audit finding that appeared to say otherwise turned out to be checking a commit from two hours before the fix landed (see Corrections table). The one real gap is that the "request is already generated, click Approve" ping language from the routine's own template isn't true yet — no code auto-drafts a document request from a fileHealth blocking reason — so that wording is intentionally withheld from today's (empty) ping list and instead logged as a roadmap item.

---

## Checks run → results → evidence

### 1. Pipeline triage (SEED DATA — pre-launch drill)

Queried `GET /api/pipeline/queue` as `admin@test.com` against the local dev server (port 5001). Result: 38 applications, `byPriority: {urgent: 0, high: 33, normal: 5}`.

| Stage | Count | Idle files (≥48h) | Health lights |
|---|---|---|---|
| pre_approved | 33 | 0 | all yellow, reason = "N conditions outstanding" (5–14 conditions each; expected for a fresh pre-approval, not a stall) |
| analyzing | 1 | 0 | green |
| processing | 3 | 0 | green |
| withdrawn | 1 | 0 | red — "File is withdrawn" (correct: terminal status, not a stall) |

No row has `daysIdle >= 2` (the `STALL_DAYS` threshold) and no row exceeds `daysInPipeline > 30`. Borrower names in every row (`Active Buyer`, `Uma`, `Noor`, `Grace`, `S06 Verify`, `Rental Verify`, `Aspiring Owner`) are seed/test fixtures, and `lastActivityAt` timestamps cluster at today's early-morning seed run — confirming this is drill data, not a live pipeline with a gap in it.

Document-confidence flags (`server/services/documentConfidence.ts`) are a separate extraction-quality signal (`humanReviewRequired`), not part of `fileHealth`'s inputs by design (staleness vs. accuracy are different questions) — no low-confidence documents were queried directly (no live files to check), consistent with the drill framing.

### 2. Shipped No-Stall surface verification (against current `main`, HEAD `6bac843`)

- **`tests/fileHealth.test.ts`** (unit config, `vitest.config.ts`): **15/15 passed.**
- **`tests/loCommandCenter.test.ts`** (integration config, `vitest.integration.config.ts`): **failed on first attempt, then passed (5/5).** Root cause was environmental, not a code defect: `tests/setup.ts:1` defaults `BASE_URL` to `http://localhost:5000`, but this repo's local convention (per `LOCAL_DEV.md` / memory) runs the dev server on **5001** — port 5000 is macOS ControlCenter/AirPlay on this machine, which returns a bare 403 to the test-login POST. Running with `TEST_BASE_URL=http://localhost:5001` passed cleanly, including the assertion that `lo@test.com` only sees deal-team-scoped queue rows.
- **`tests/mismoExportAccess.test.ts`** (integration config): same port issue, then **4/4 passed** with the correct `TEST_BASE_URL`. Confirms broker/lender/borrower-client all get 403 before any data fetch, and internal staff (admin) still receives the full GSE XML with real SSN — the H8 fix (PR #26) is live and correctly gated to internal-staff-only roles (`admin, lo, loa, processor, underwriter, closer` — `server/routes/lending.ts:863`), and `lo` counts as internal staff via `isInternalStaffRole` (`shared/roles.ts:81`) with no guard widening needed, per this routine's standing instruction.
- **Per-row one-click MISMO export** — present in the queue endpoint's per-application data and gated by the same route verified above.

**H8 access decision: RESOLVED, not re-opened.** Confirmed current `server/routes/lending.ts:859-864` restricts `mismo-export` to internal-staff roles only, with an inline comment citing GLBA/Reg B data minimization. Per standing instruction, this decision stands and was not re-litigated.

### 3. Doc-request automation gap (confirmed still open)

Searched `server/routes/borrower.ts:2588-2727` (the only `document_request` message pathway) and `client/src/pages/staff/LoCommandCenter.tsx` (346 lines) for any auto-draft-from-fileHealth-reason logic. None exists — the only document-request path is a manual staff-composed message with staff-supplied `documentRequestData`. No code turns a fileHealth blocking reason ("8 conditions outstanding", "no activity for N days") into a pre-filled, LO-approvable draft. This confirms the gap flagged by the routine's own instructions and is why the human-actions ping list above uses no wording claiming a request is "already generated."

### 4. Cross-reference with 9:07 AM LO product audit (`kb/lo-audit/2026-07-04.md`)

That report's HIGH findings: H1–H7 confirmed fixed on `main`; H9 is an uncommitted-WIP note (S-06 decision-engine gap, already tracked in the scenario-engine memory, not a pipeline/doc-collection item). Its **H8** ("MISMO export leaks SSN+DOB to broker/lender") looked like a live, unresolved pipeline/doc-collection-adjacent finding worth pulling in — but verification below shows it's stale, not live. Its MEDIUM findings M11–M16 are pricing/DTI/UI items already captured as `LO-M11`/`LO-M16` in `CTO_ROADMAP.md`; none of the doc-collection-flavored mediums (M14: silent auto-generated doc requirements) changes today's triage since there are no live files to notify about yet.

---

## Corrections table

| Source said | Verified reality |
|---|---|
| `kb/lo-audit/2026-07-04.md`'s H8 finding: MISMO export `requireRole` "explicitly includes `broker`, `lender`" — live SSN/DOB leak on `main` | **Stale, already fixed.** That audit verified against commit `7052cdb` (2026-07-04 02:18). PR #26 (`99c795f`, merged 04:26 the same morning — 2h08m later) restricted the route to internal-staff roles only. Current `main` (`6bac843`) has the fix; `tests/mismoExportAccess.test.ts` (4/4) confirms it live. Not re-opened, per standing instruction — this entry exists only to correct the record, since the audit's own commit citation made the timing checkable. |
| Task template's example ping copy ("the request is already generated, click Approve") | **Not true yet for any file** — no auto-draft-from-fileHealth code exists (see check 3). No ping used this wording; the gap is logged as `LO-M17` instead. |
| `tests/loCommandCenter.test.ts` / `tests/mismoExportAccess.test.ts` — assumed to "just pass" per task template | Both **initially failed** against the default `BASE_URL` (port 5000, a macOS system service on this machine) — not a code regression. Passed once pointed at port 5001, this repo's documented local convention. Worth fixing `tests/setup.ts`'s default so future routine runs don't need to rediscover this (see LO-M18 below, not added to roadmap as it's a minor DX fix — flagging here instead since it's routine-internal, not product-facing). |

---

## Remediation tickets

1. **LO-M17 — Build one-click doc-request generation from a fileHealth blocking reason.** Owner: Claude (automatable, ~4-6h). Appended to `CTO_ROADMAP.md` "Do next → LO workflow correctness" in this commit. Blocks the polished version of the No-Stall ping pitch, not the underlying promise.
2. **Minor DX gap (not roadmap-worthy):** `tests/setup.ts:1`'s default `TEST_BASE_URL` (port 5000) doesn't match this repo's documented local dev port (5001), causing integration tests to falsely appear broken unless run with an explicit override. Owner: Claude, ~10 min, whenever someone is next in `tests/setup.ts`. Not filed as a roadmap ticket — too small, flagged here for visibility only.

---

STATUS: WARN
