# Frontend Wiring Audit — 2026-08-12

STATUS: WARN — five capture-path defects found and fixed, plus the first 12 of the singleton-`queryClient` migration; one launch-blocking claim proved stale, and the branch carrying all of it has no PR.

## ⛔ Human actions

1. **Merge or close [PR #490](https://github.com/barakatammre84/Homiquity/pull/490)** (green, auto-merge deliberately not armed) — it carries three of the fixes.
2. **The other eight commits are on `claude/frontend-standardization-2` with NO PR.** This session's loop instruction said not to push, which conflicts with CHARTER §9 ("routines commit on a branch and open a PR"). Per [[cross-session-coordination]], *a branch with no PR is invisible to `gh pr list`* — the exact shape of the nine-audit collision. Flagging rather than resolving unilaterally; say the word and it goes up.
3. **`WORKFLOWS.md:31` still carries WF2-F4** as an open launch-blocker. It is closed (evidence below). A peer corrected `CHARTER.md` §1 and the memory in `f41f2d5`; `WORKFLOWS.md` is Evening Triage's territory under §6, so this routine did not edit it.

## Summary

Traced the borrower capture path end to end — calculators → `/apply` → auth gate → draft → URLA → submit. Five defects, all invisible from either end alone and every one with green guards: a credit band handed over in the wrong vocabulary, a URLA save that mutates the loan application row while invalidating only URLA, four public signup forms rendering success on a rejected POST, an invite attribution whose storage tier expired before the submit it accompanies, and a 500 that told staff their valid invite code was invalid. All five are fixed with regression tests that were each verified to fail against the previous code. The structural finding — 83 files bound to a module-singleton `queryClient`, making every post-mutation refresh unobservable in tests — is now 12 files smaller, starting with the tested ones.

## Evidence

**1. Calculator → funnel wrote a credit band the schema rejects** *(fixed, PR #490)*
`PreApproval.tsx` mapped the slider score to `"excellent"/"good"/"fair"/"poor"` — the leads vocabulary (`server/routes/leads.ts:49`). The funnel accepts only `CREDIT_SCORE_BAND_VALUES` (`shared/preApprovalForm.ts:247`). No per-step gate covers that step (`preApprovalMachine.ts stepGate` handles `downPayment`, `incomeSources`, `final` only), so rejection landed at the final step *after* the FCRA soft-pull consent. `"fair"` being non-empty also locked `coachPrefill` out, since its gap-fill tests blankness.

**2. `POST /api/urla/:id/save` mutates the loan application row** *(fixed, PR #490)*
`server/services/trid.ts:160-190` writes `tridTriggeredAt` + a deal activity once the six pieces are on file (Reg Z §1026.2(a)(3)). Served under `loanApplicationKeys.detail`; read by `LoanPipeline.tsx:78` and `CreditConsent.tsx:94`, both borrower surfaces. Trigger fires at an intermediate *silent* save, so the invalidation must not be gated on `!silent`.

**3. Four public signup forms showed success on a rejected POST** *(fixed, PR #490)*
`await` on the fetch primitive only rejects on network errors. `EmailCaptureModal.tsx` and `Waitlist.tsx` had no `res.ok` check; `/api/email-capture` answers 400 (Zod) and 429 (`emailCaptureLimiter`, 5/15min/IP, `server/app.ts:273`). `Waitlist` is `/` while `PRELAUNCH_GATED`. `Waitlist.test.tsx`: **5 of 7 cases fail against the previous code** (verified by reverting).

**4. Invite attribution expired with the tab** *(fixed, this branch — `84382bb`)*
`ApplyInvite.tsx:91` wrote `sessionStorage["inviteId"]`; the draft, pending-submit marker and both sibling attribution codes are all `localStorage` (`lib/pendingAttribution.ts`). `server/routes/lending/applications.ts:208-236` uses it to flip the invite to `applied` and set `referringBrokerId`, which routes the file to the referring LO. Legacy key still read and cleared, never written.

**5. CHARTER §1 standing blocker — CLOSED, chain verified and DATED**
`urla/PropertySection.tsx:180` Select → `onLoanDetailsChange` → `URLAForm.tsx:602 setLoanDetails` → `:205` state → `:336 buildPayload` includes `loanDetails` → `server/routes/borrower/urla.ts:587-599` → `storage.updateLoanApplication(applicationId, parsedLoanDetails.data)`.

The whole path landed in **`6407119` (#400), 2026-08-05** — *"fix(launch): pre-flight fix wave B — engine decidability + URLA section-4 write path"*. Dated with `git log -S "loanDetailsChanged" -- server/routes/borrower/urla.ts` and `git log -S "loanDetails," -- client/src/pages/borrower/URLAForm.tsx`; both point only at that commit. WF2-F4 was recorded the **same day**, so it was written before the fix merged and never re-checked. **It has been closed for a week while three documents asserted it** (`WORKFLOWS.md:31`, `CHARTER.md §1`, and the `routine-suite` memory). Peer `homiquity-37` notified with the evidence; the memory file is corrected. `WORKFLOWS.md` and `CHARTER.md` are Evening Triage's territory under §6, so this routine did not edit them.

**7. A transient 500 told staff their good invite was invalid** *(fixed, this branch — `dfb7b77`)*
`GET /api/staff-invites/validate/:code` answers 500 with `{ error }` and no `valid` field (`server/routes/staff-invites.ts:77`). `RedeemInvite.tsx` set that straight into `validation` with no `res.ok` check, so `validation.valid` was `undefined` — which rendered the destructive invalid-code panel *and* disabled Redeem (`validation !== null && !validation.valid`), locking a valid invite out for the session and printing a 5xx internal string on a public page. A 404 is the server's answer and still sets `validation`; anything else now leaves it null with a neutral retry note. `RedeemInvite.test.tsx`: 3 of 7 cases fail against the previous code.

**6. The singleton `queryClient` — 12 of 83 migrated** *(`384ab1a`)*
83 client files imported the module singleton (163 `.invalidateQueries` call sites); 8 used `useQueryClient()`. Tests render under their own `new QueryClient()`, so invalidations landed on a cache no test observed. Migrated the 12 with a `.test.tsx` sibling, where the fix pays the same day; **72 remain**, unclaimed.

`SubmissionLifecycleControl.test.tsx` gains the assertion that was previously impossible — spy on the client the component was *rendered under*, require both invalidations to reach it. Verified honest: it **fails** when that component is put back on the singleton.

`TestLogin.test.tsx` had been rendering the page with **no `QueryClientProvider` at all** and passing, purely because the singleton needs no provider. `useQueryClient()` throws there — the truthful answer, since the test was rendering the component in a tree it never runs in. Now wrapped, as the app does.

**Gate output** (this branch, rebased on `4789008`, reinstalled after the rebase):
`pnpm check` exit 0 · `pnpm test` **2,647 node + 485 client**, exit 0 · `guard:querykeys` exit 0 · `guard:tokens` exit 0 (baseline 97, no regression) · `clientSchemaImports` exit 0 · `apiRequestConvergence` exit 0 (allowlist honest in both directions) · `detectTriggers()` over the 14 changed files → `[]`.

**Not verified:** no browser check — dev servers cannot start in an unattended run (CHARTER §10). This is test-and-typecheck evidence only.

## Proposed tickets

1. **Migrate the remaining 72 singleton `queryClient` importers to `useQueryClient()`** — the 12 with a test sibling are done (`384ab1a`). Take the rest in batches; `tsc` catches a misplaced hook because the import is gone, which makes the mechanical edit safe to script.
2. **Correct CHARTER §1's standing evidence** — WF2-F4 is closed; leaving it in makes every routine re-report a fixed blocker.
3. ~~Merge #493~~ — **done**; the register is live and this run claimed and released through it.
4. **Finish the transport sweep** — `RedeemInvite` is done (`dfb7b77`). Still open: `AddressInput` (2 public GETs from a debounced input handler; both *do* check `res.ok`, so this is a shape question — `getPublicQueryFn` + a params-object key — not a defect) and `RentCard` (multipart; `apiRequest` JSON-stringifies its body and cannot send `FormData`, so it needs either an `apiRequest` extension or a documented raw exception). Keep the allowlist honest — it fails on stale entries.
5. **`Messages.tsx` runs three uncoordinated polls** (`:47` 30s, `:59` 5s, `:66` 3s ≈ 32 req/min/tab) with no backoff, while every other live surface was consolidated onto `useShellBadges` or SSE.
6. **Do not "clean up" `URLAForm.tsx`** — `knowledge-base/handbook/URLA_FORM_REFACTOR_TRAP.md` (landed today, #486) refutes eight extraction proposals; the worst writes a co-applicant's PII into the primary borrower's rows.

STATUS: WARN

---

## Addendum — iteration 5 (queryClient migration complete)

**#504 merged and verified in prod** (`/api/health` → `634cdcf`, polled to confirm; probes 1–3 returned a peer's deploy mid-rollout, which is why a single probe is not proof).

The remaining **71** singleton importers now use `useQueryClient()`. The migration is **complete**: `client/src/lib/logout.ts` is the only module-singleton consumer left, deliberately, and now carries a comment saying so — `logout()` is a plain async function called from click handlers, not a render, so a hook there breaks the Rules of Hooks; and `clear()` wiping the app's own cache is exactly the case where the singleton is right.

Two custom hooks (`useAdminCrudMutations`, `useTaskOperations`) migrated cleanly — `useQueryClient()` is legal inside a hook.

**Process finding worth keeping.** The repo squash-merges (11 of the last 12 main commits), which breaks any branch stacked on an open PR: once the base squashes, the stacked branch's copies become duplicates and `git rebase origin/main` conflicts on the first one. The fix is `git rebase --onto origin/main <base-tip> <branch>`. That needs a force-push, **which is denied in this session** — so #497 was closed and reopened as #501 from a fresh branch. When main moved again under #504, the answer was `git merge origin/main` (no force required) rather than another rebase. One real conflict, in `Verification.tsx`: #505 added `useEffect, useRef` while this branch removed the singleton import; both kept.

STATUS: OK
