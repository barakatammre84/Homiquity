# Backend → UI Optimization Audit

> **STATUS: SPRINT EXECUTED 2026-07-02.** All nine items below were implemented
> the same night (193 unit + 50 integration tests green). See "Sprint results"
> at the bottom for what shipped, extra bugs found during implementation, and
> the one production follow-up (run `scripts/migrate-status-vocabulary.ts
> --apply` against the production database at deploy time).

**Date:** 2026-07-02 (overnight cycle)
**Scope:** server/ workflow logic, state management, validation, and API shapes, audited for their effect on UI clarity.
**Method:** eight sequential passes (workflow mapping, smart defaults, conditional logic, validation consistency, state machine, API responses, UI consistency, performance) over the borrower funnel, pipeline engine, lifecycle engine, and dashboard surfaces.

---

## The one-sentence diagnosis

Homiquity has **three overlapping state systems and four independent client-side copies of stage semantics**, and every confusing UI state found in this audit traces back to one of those two facts.

The three state systems:

| System | Vocabulary | Enforced? | Drives UI? |
|---|---|---|---|
| `loanApplications.status` (free varchar, `shared/schema/lending.ts:31`) | `draft, submitted, analyzing, pre_approved, doc_collection, processing, underwriting, conditional, clear_to_close, closing, funded, denied, withdrawn` + endpoint-specific extras | **No** — no enum, no transition guard | **Yes** — this is what every screen renders |
| `borrowerStateHistory` state machine (`server/services/borrowerStateMachine.ts`) | 16 formal states, typed transitions, triggers | Yes (typed + guarded) | Barely — only `routes/intelligence.ts` reads it |
| `updatePipelineStage` (`server/pipelineEngine.ts:413`) | Accepts **any string**; switch handles 9 known stages | No validation of transitions | Indirectly (writes system 1) |

The formal state machine — the one with validation, history, duration analytics, and `getStateMetadata()` progress percentages ready-made for the UI — is ornamental. The un-validated varchar is what the UI lives on.

---

## 1. Prioritized backend fixes (highest UI impact first)

### P0-1 — Status vocabulary split-brain between the two staff endpoints

`PATCH /api/loan-applications/:id/status` (`server/routes/lending.ts:1186`) accepts:
`submitted, in_review, underwriting, conditional_approval, pre_approved, approved, denied, suspended, withdrawn`

`POST /api/loan-applications/:id/advance-stage` (`server/routes/underwriting.ts:480`) accepts the pipeline vocabulary:
`pre_approved, doc_collection, processing, underwriting, conditional, clear_to_close, closing, funded, denied`

The borrower Dashboard (`client/src/pages/borrower/Dashboard.tsx:172-195, 347-385`) renders **only the pipeline vocabulary**. Consequences visible to a borrower today:

- Staff sets `conditional_approval` via the status endpoint → Dashboard's `status === "conditional"` never matches → borrower sees the generic "being reviewed" fallback instead of "Clear remaining conditions", and the conditions CTA never appears.
- `in_review`, `approved`, `suspended` also fall through to the fallback — three of the nine staff statuses produce a blank/generic borrower experience.
- Dashboard checks `"declined"` and `"closed"` (`Dashboard.tsx:377, 825, 830`) — statuses **no backend path ever writes** (backend writes `denied` and `funded`). `hasClosedLoan` is permanently false, so the closed-loan UI branch is dead code.

### P0-2 — The status PATCH endpoint bypasses the entire workflow engine

`updatePipelineStage` is the only path that: stamps milestones, sets HMDA action-taken codes on `funded`, emits Task Engine workflow events, and **graduates the loan into the Homeowner Hub** (`pipelineEngine.ts:448-459`). The `PATCH /status` endpoint writes the row directly (`lending.ts:1266`), so a status change made there:

- creates no milestone timestamps (milestone timeline UI shows gaps),
- fires no `STAGE_*` task-engine events (borrower task list silently stops updating),
- and if it ever gains a `funded` option, would never create the homeowner profile.

Two doors into the same room, one wired to the lights.

### P0-3 — Borrower withdraw path skips HMDA and everything else

`POST /:applicationId/withdraw` (`server/routes/borrower.ts:1848`) writes `status: "withdrawn"` directly. The staff status endpoint maps `withdrawn → hmdaActionTaken "4"` (`lending.ts:1180-1183`); the borrower-initiated path **does not**, so borrower withdrawals are missing their Reg C LAR action-taken code. It also skips state-machine sync and task events. (Compliance-relevant, not just UI.)

### P1-4 — State machine sync happens exactly once, then drifts forever

`syncApplicationStatusToStateMachine` (`server/services/optimizationEngine.ts:113`) is called only from the creation flow in `lending.ts:574, 597`. Neither `updatePipelineStage`, nor the status PATCH, nor withdraw call it. Result: `borrowerStateHistory` — and everything Intelligence builds on it — is frozen at pre-qualification for any loan that progresses. Any UI reading state-machine data (journey progress, duration analytics) shows stale phase after the first stage advance.

### P1-5 — Client/server validation split-brain on the funnel payload

Client validates with shared `preApprovalFormSchema` (`shared/schema/lending.ts:751-818`); the server re-validates with a **private, different** `loanApplicationInputSchema` (`server/routes/lending.ts:77-114`):

| Field | Client rule | Server rule |
|---|---|---|
| creditScore | must be one of `760/720/680/640/600/not_sure` | any number, **silently clamped** to 300–850; `not_sure → 680` |
| employmentYears | required, 0–80, errors outside | optional, `NaN → 0`, silently clamped |
| employmentType | required enum | optional |
| propertyState | required | optional |

The server never *errors* where the client does — it silently coerces. Any non-funnel caller (staff-assisted entry, future API, invites flow) can create applications with silently-manufactured data the UI then renders as fact. Note also `lending.ts:86`: the `.refine(v => v >= 300 && v <= 850)` after the clamp is dead code — it can never fail.

### P1-6 — "0" as a smart default poisons downstream displays

Both creation and update coerce empty financials to `"0"` (`lending.ts:481-488, 1144-1151`). A borrower who skipped income shows `$0 annual income` in every staff view and produces a divide-happy DTI. "Unknown" and "zero" are different facts; the DB columns are nullable — use null.

### P2-7 — Navigation checks statuses that don't exist

`client/src/components/Navigation.tsx:146-148`: the "Resume application" banner triggers on `submitted | under_review | pending`. `under_review` and `pending` are never written for loan applications, and the actual resumable state — `draft` — is **not** checked. The banner shows for already-submitted apps ("Resume" a submitted app?) and never for real drafts. Backend fix that makes this class of bug impossible: export one canonical status enum from shared (see §4).

### P2-8 — Lifecycle sweep's in-flight list misses the staff-endpoint statuses

`IN_FLIGHT_STATUSES` (`server/services/lifecycleEngine.ts:129`) lists pipeline vocabulary only. Files moved to `in_review` / `conditional_approval` via the status PATCH fall out of the document-freshness sweep — those borrowers never get the 25-day re-upload nudge.

### P2-9 — Fourth copy of stage→next-action semantics

The "what should the borrower do next" mapping exists in four places: `Dashboard.tsx getDominantAction`, `Dashboard.tsx` greeting switch, `borrowerGraph.ts:838-852 suggestedNextAction`, and `borrowerStateMachine.ts getStateMetadata`. They already disagree (borrowerGraph knows `doc_collection`; the greeting switch doesn't know `approved`). Next-action should be computed **once, server-side**, and returned as data.

---

## 2. Exact backend refactors

### Refactor A — Single canonical status enum + transition table (fixes P0-1, P2-7, foundation for all others)

Add to `shared/schema/lending.ts` (client and server both import from here — client switch statements become exhaustive-checkable):

```ts
export const LOAN_APP_STATUSES = [
  "draft", "submitted", "analyzing", "pre_approved",
  "doc_collection", "processing", "underwriting", "conditional",
  "clear_to_close", "closing", "funded",
  "denied", "withdrawn", "suspended", "expired",
] as const;
export type LoanAppStatus = (typeof LOAN_APP_STATUSES)[number];

// One transition table. UI can render "what's next" directly from this.
export const LOAN_APP_TRANSITIONS: Record<LoanAppStatus, LoanAppStatus[]> = {
  draft:            ["submitted", "withdrawn"],
  submitted:        ["analyzing", "withdrawn"],
  analyzing:        ["pre_approved", "denied", "suspended", "withdrawn"],
  pre_approved:     ["doc_collection", "expired", "withdrawn", "denied"],
  doc_collection:   ["processing", "suspended", "withdrawn", "denied"],
  processing:       ["underwriting", "suspended", "withdrawn", "denied"],
  underwriting:     ["conditional", "clear_to_close", "denied", "suspended", "withdrawn"],
  conditional:      ["clear_to_close", "denied", "withdrawn"],
  clear_to_close:   ["closing", "withdrawn"],
  closing:          ["funded", "withdrawn"],
  funded:           [],
  denied:           [],
  withdrawn:        [],
  suspended:        ["doc_collection", "processing", "underwriting", "withdrawn", "denied"],
  expired:          ["submitted"],
};
```

Migration note: `in_review → processing`, `conditional_approval → conditional`, `approved → clear_to_close` (or drop; pick with an underwriter). One-time data migration for existing rows, then tighten `staffStatusSchema` to `z.enum(LOAN_APP_STATUSES)`.

### Refactor B — One door: everything goes through `updatePipelineStage` (fixes P0-2, P0-3, P1-4)

```ts
// pipelineEngine.ts
export async function updatePipelineStage(
  applicationId: string,
  newStage: LoanAppStatus,                       // was: string
  options?: { denialReasons?: string[]; performedBy?: string },
): Promise<void> {
  const application = await storage.getLoanApplication(applicationId);
  if (!application) throw new PipelineError("not_found");

  const from = application.status as LoanAppStatus;
  if (from === newStage) return;                 // idempotent
  if (!LOAN_APP_TRANSITIONS[from]?.includes(newStage)) {
    throw new PipelineError("invalid_transition", { from, to: newStage,
      allowed: LOAN_APP_TRANSITIONS[from] });
  }

  // ...existing milestone + HMDA + status write + task-event logic...

  // NEW: keep the borrower state machine in lockstep (best-effort)
  try {
    const { syncApplicationStatusToStateMachine } = await import("./services/optimizationEngine");
    await syncApplicationStatusToStateMachine(application.userId, applicationId, newStage);
  } catch (err) {
    console.warn("[pipeline] state-machine sync failed (non-fatal):", err);
  }
}
```

Then:
- `PATCH /:id/status` keeps its role/verification/HMDA-denial guards but replaces `storage.updateLoanApplication(id, statusUpdate)` with `updatePipelineStage(id, status, ...)`.
- The withdraw endpoint replaces its direct write with `updatePipelineStage(applicationId, "withdrawn")` — HMDA code 4, task events, and state sync come along free.
- Add `withdrawn: "4"` handling inside `updatePipelineStage`'s HMDA block so all callers get it.
- Extend `APP_STATUS_TO_STATE_MAP` (`optimizationEngine.ts:113`) to cover the full pipeline: `doc_collection/processing → underwriting? no — map: pre_approved→pre_approval, underwriting→underwriting, conditional→conditional_approval, clear_to_close→clear_to_close, closing→closing, funded→funded` etc., so sync stops being lossy after pre-approval.

### Refactor C — One validation source of truth (fixes P1-5, P1-6)

Derive the server schema from the shared one instead of hand-rolling a second:

```ts
// shared/schema/lending.ts
export const loanApplicationIntakeSchema = preApprovalFormBaseSchema.extend({
  softPullConsentAccepted: z.boolean().optional(),
}).transform((d) => ({
  ...d,
  // explicit, named default — not a silent clamp buried in a transform
  creditScore: d.creditScore === "not_sure" ? CREDIT_SCORE_UNKNOWN_DEFAULT : Number(d.creditScore),
}));
export const CREDIT_SCORE_UNKNOWN_DEFAULT = 680;
```

And stop manufacturing zeros:

```ts
// lending.ts creation/update — preserve "unknown" as null
annualIncome: formData.annualIncome ?? null,   // was: formData.annualIncome || "0"
monthlyDebts: formData.monthlyDebts ?? null,
```

Where a default is genuinely wanted (credit score for soft-pull sizing), record it: set `financialDataProvenance` stays `self_reported` (already exists — good), and add `creditScoreIsEstimated: boolean` or store the band rather than a fake point value. The UI can then say "estimated" instead of asserting a number the borrower never gave.

### Refactor D — Server-computed `nextAction` (fixes P2-9, shrinks Dashboard.tsx)

Add to the `/api/dashboard` response (the data all four copies need already lives server-side):

```ts
interface NextAction {
  kind: "resume_draft" | "upload_documents" | "complete_tasks" | "clear_conditions"
      | "renew_preapproval" | "read_messages" | "browse_homes" | "contact_team"
      | "talk_to_coach" | "none";
  title: string;
  description: string;
  href: string;
  count?: number;          // e.g. documents needed
  urgency?: "normal" | "urgent" | "expired";
}
```

Compute it in one function in `borrowerGraph.ts` (it already has every input: status, preUwFlags, pending tasks, unread messages, expiration). Dashboard's 190-line `getDominantAction` and the greeting switch collapse into renderers of `nextAction.kind`. Navigation's banner becomes `nextAction.kind === "resume_draft"` — the phantom-status bug class disappears.

### Refactor E — Lifecycle sweep derives in-flight from the enum (fixes P2-8)

```ts
// lifecycleEngine.ts — derive, don't duplicate
const TERMINAL: LoanAppStatus[] = ["funded", "denied", "withdrawn", "expired"];
const IN_FLIGHT_STATUSES = LOAN_APP_STATUSES.filter(
  (s) => !TERMINAL.includes(s) && s !== "draft",
);
```

---

## 3. Workflow diagram (target state)

```
                      ┌─────────────────────────────────────────────┐
                      │      ONE canonical enum + transition table   │
                      │        shared/schema/lending.ts              │
                      └──────────────────┬──────────────────────────┘
                                         │ imported by everyone
        ┌────────────────────────────────┼────────────────────────────────┐
        │                                │                                │
  PATCH /status              POST /advance-stage              POST /withdraw
  (role guards,              (readiness blockers,             (ownership guards)
   HMDA denial rules)         stage-role policy)
        └────────────────┬───────────────┴────────────────┬───────────────┘
                         ▼                                 ▼
              ┌─────────────────────────────────────────────────┐
              │   updatePipelineStage()  — THE ONLY STATUS WRITER │
              │   1. validate transition (table above)           │
              │   2. milestones          4. task-engine events   │
              │   3. HMDA codes          5. state-machine sync   │
              │                          6. funded → graduation  │
              └────────────────────────┬────────────────────────┘
                                       ▼
                        loanApplications.status (enum)
                                       │
              ┌────────────────────────┼──────────────────────┐
              ▼                        ▼                      ▼
      /api/dashboard          borrowerStateHistory      lifecycle sweep
      (+ nextAction,          (always in lockstep)      (in-flight derived
       computed once)                                    from enum)
```

Current state, for contrast: three writers (PATCH /status, withdraw, direct storage calls) skip the box in the middle, and the state machine is synced only at creation.

---

## 4. Unified validation & error handling

**Already good (keep):** error payload shape is uniformly `{ error: string, details? }` — 1,040 uses, zero `{ message }` variants. `assertVerifiedForDecisioning` returning 422 vs validation 400 is a clean distinction. Shared zod schemas exist and the funnel machine (`client/src/funnel/preApprovalMachine.ts`) is a genuinely clean pure-function design.

**To unify:**
1. **One schema per payload, defined in `shared/`, imported by both sides** (Refactor C). Server may `extend` for server-only fields, never redefine field rules.
2. **Coercion policy: server rejects what the client rejects.** Silent clamping (`creditScore`, `employmentYears`) turns validation errors into fabricated data. Reserve transforms for format normalization (strip `$,`), not value invention.
3. **Machine-readable error codes.** Add `code` alongside `error`: `{ error: "Cannot advance stage", code: "stage_blocked", blockers: [...] }`. The UI currently string-matches or shows raw messages; codes let it render purpose-built states (e.g., the blockers list already returned by advance-stage deserves a real checklist UI, which needs a stable discriminator).
4. **Invalid transition errors return the allowed set** (Refactor B) so staff UIs can grey out impossible moves instead of letting users discover them by 400.

---

## 5. API response cleanup plan

1. **`/api/dashboard` is already well-batched** (two parallel waves, `inArray` per table — the 8+13N problem was fixed). Leave the query strategy alone.
2. **Add `nextAction` + `statusMeta` to `/api/dashboard`** (Refactor D). `getStateMetadata()`-style `{ label, description, progressPercent, phase }` should ride on each application object so five client files stop maintaining their own label/progress maps.
3. **Collapse the Dashboard's satellite queries.** `Dashboard.tsx` fires 5 queries on mount (`/api/dashboard`, `/api/coach/conversations`, `/api/homeownership-goal`, `/api/user-activity-summary`, `/api/borrower-graph`). `/api/borrower-graph` already *contains* goal, activity, and coach-derived data. Either fold the three small ones into `/api/dashboard`'s response or have Dashboard read them from the graph payload it already fetches. Target: 2 requests (dashboard + graph).
4. **Trim `recentOptions`/`activities` duplication:** the dashboard returns `activities` (flattened top-10) — fine — but full `loanOptions` rows for `recentOptions` where the cards render ~6 fields. Select the card fields only; these rows carry pricing-grid JSON that inflates the payload.
5. **`buildBorrowerGraph` sequential tail:** after its main `Promise.all` it runs 4+ sequential awaits (coach messages, property activities, milestones, employment history). Move them into the initial `Promise.all` — same data, one round-trip wave. This endpoint backs the dashboard's hero section; its latency is user-visible.

---

## 6. 24-hour sprint plan

| # | Task | Fixes | Est. | Risk |
|---|---|---|---|---|
| 1 | Add `LOAN_APP_STATUSES` + `LOAN_APP_TRANSITIONS` to shared; migrate `in_review`/`conditional_approval`/`approved` rows; tighten `staffStatusSchema` | P0-1 | 2h | Low — data migration is a 3-value UPDATE |
| 2 | Transition validation + state-machine sync inside `updatePipelineStage`; route PATCH `/status` and withdraw through it | P0-2, P0-3, P1-4 | 3h | Medium — touch the withdraw guard tests |
| 3 | Fix client phantom statuses: Dashboard `declined/closed`, Navigation `under_review/pending` → enum imports | P0-1, P2-7 | 1h | Low |
| 4 | Extend `APP_STATUS_TO_STATE_MAP` to full pipeline vocabulary | P1-4 | 1h | Low |
| 5 | Replace `loanApplicationInputSchema` with shared-derived intake schema; kill silent clamps; `|| "0"` → `?? null` (audit staff views for null-rendering) | P1-5, P1-6 | 3h | Medium — staff screens must show "—" not NaN |
| 6 | Server-side `nextAction` in dashboard payload; collapse `getDominantAction` | P2-9 | 3h | Low — pure addition, client migrates behind it |
| 7 | Derive `IN_FLIGHT_STATUSES` from enum in lifecycleEngine | P2-8 | 30m | Low |
| 8 | Parallelize `buildBorrowerGraph` tail queries; slim `recentOptions` selects | perf | 2h | Low |
| 9 | Invariant test: every status literal written anywhere in server/ ∈ `LOAN_APP_STATUSES` (grep-based vitest, same pattern as the scenario-registry invariants) | regression guard | 1.5h | Low |

Suggested order: 1 → 3 → 2 → 4 → 7 → 9 (state correctness first, guarded by the invariant test), then 5 → 6 → 8.

---

## Explicitly checked and found healthy

- Error payload shape (uniform `{ error }`).
- `/api/dashboard` query batching (recently optimized, comment documents the before/after).
- Funnel step machine — pure-function routing, shared schema, localStorage autosave with sound rationale.
- Approval-locus guards (`assertVerifiedForDecisioning`, `PROTECTED_CREDIT_DECISION_STATUSES`, `STAGE_TRANSITION_ROLES`) are consistently applied on both staff endpoints.
- Lifecycle sweep idempotency (daily snapshot window, threshold-crossing checks).

---

## Sprint results (executed overnight 2026-07-02)

All nine items shipped. Verification: `tsc` clean, **193 unit tests** (10 files) and **50 integration tests** (4 files, against the live dev server) all passing.

### What shipped

| # | Item | Where |
|---|---|---|
| 1 | Canonical `LOAN_APP_STATUSES` (15 values), `LOAN_APP_TRANSITIONS` table, `LOAN_APP_STATUS_META` (labels/progress/badge per status), approved-grade + terminal helper sets | `shared/schema/lending.ts` |
| 2 | `updatePipelineStage` is the single status writer: transition validation (409 + allowed set via `PipelineTransitionError`), state-machine sync, HMDA codes (incl. code 4 on withdraw; code 3 only with denial reasons so the auto-analysis path can't fabricate LAR rows). PATCH `/status`, borrower withdraw, creation flow, and analysis rollback all route through it. Admin-only `force` escape hatch. | `server/pipelineEngine.ts`, `routes/lending.ts`, `routes/borrower.ts`, `routes/underwriting.ts` |
| 3 | Client phantom statuses fixed; `ApplicationSwitcher` badge map collapsed onto `getLoanAppStatusMeta`; Navigation resume banner keys on `draft` | 8 client files |
| 4 | `APP_STATUS_TO_STATE_MAP` covers the full pipeline; journey machine accepts pipeline-driven jumps (off-platform contract/search) | `optimizationEngine.ts`, `borrowerStateMachine.ts` |
| 5 | `IN_FLIGHT_STATUSES` derived from the enum (excludes terminal, draft, closing-track) | `lifecycleEngine.ts` |
| 6 | Invariant tests: phantom-literal scan, single-writer scan, transition-table integrity (reachability, terminal states, happy path, meta coverage) | `tests/statusVocabulary.test.ts` |
| 7 | Server intake validation derived from the funnel's shared schema (`loanApplicationIntakeSchema` + partial update variant): silent clamps removed, `not_sure` → named `CREDIT_SCORE_UNKNOWN_DEFAULT`, no more `\|\| "0"` fabricated figures; borrower PATCH restricted to drafts (was resetting ANY application to draft) | `shared/schema/lending.ts`, `routes/lending.ts`, `tests/intakeSchema.test.ts` |
| 8 | Server-computed `nextAction` (+ `activitySummary`) on `/api/dashboard`; Dashboard's 190-line `getDominantAction` deleted; borrowerGraph's `suggestedNextAction` delegates to the same service; 2 fewer client queries on dashboard mount | `server/services/nextAction.ts`, `services/activitySummary.ts` |
| 9 | borrowerGraph tail queries parallelized into a second `Promise.allSettled` wave (4 round-trips → 1); `recentOptions` slimmed to card fields | `borrowerGraph.ts`, `routes/lending.ts` |

### Extra bugs found & fixed during implementation (beyond the audit)

- **Admin `approvalRate` was permanently 0** — counted `status === "approved"`, which nothing writes (`storage.ts`).
- **Broker closed-loan stats were permanently 0** — `closedStatuses = ["closed"]` phantom (`storage.ts`).
- **`hasRateLocked` was permanently false** — read `rateLockedAt`, a column that doesn't exist (`lockedAt` is real) (`routes/lending.ts`).
- **Borrower PATCH reset any application to `draft`** — a borrower editing figures mid-underwriting silently pulled the file out of the pipeline; now 409 `not_editable` for non-drafts.
- **MISMO underwriting-decision block** keyed on phantom `approved`; now approved-grade set (`server/mismo.ts`).
- **Goal-personalized greeting was dead code** — `"buying_first_home"` etc. exist only in Dashboard.tsx; the endpoint returns an object where the client expected a string. Dead branches removed; re-implement properly if goal personalization is wanted.
- **Loan-estimate integration test** was failing pre-sprint (consent gate added after the test); now accepts the e-disclosure via `POST /api/consents` like the real UI.

### Production follow-up (one item)

Run the idempotent data migration against production at deploy time:
`npx tsx scripts/migrate-status-vocabulary.ts` (dry run) then `--apply`.
Locally it normalized 4 seed rows (`closed`→`funded`, `under_review`→`processing`). The transition guard tolerates unknown legacy statuses (skips validation from them), so deploy order is safe either way.
