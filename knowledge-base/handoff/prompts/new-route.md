# Loop template: new API route

> **Freshness:** last verified 2026-08-22 · review every 30 days

Read `_RAILS.md` now, and again at the top of every iteration. Then read `$SCRATCH/loop-log.md`
if it exists; append to it before each iteration ends.

```
TASK:   <one sentence: METHOD /api/<path>, who may call it (role or object-level rule), what it returns>
WRITE:  server/routes/<domain>/<file>.ts           (existing group file; or a new file appended to that
                                                    group's index.ts — at the END of the list)
        server/storage/<domain>.ts                 (if a storage method is needed)
        tests/<name>.test.ts   (node lane globs — no config line)  (pure logic)
        tests/<name>.test.ts + vitest.integration.config.ts  (HTTP behaviour, incl. the 401/403 cases)
NEVER:  server/routes.ts (unless the domain is new — then one appended registrar line, last before the 404);
        server/auth.ts; RESPONSE_BODY_LOG_ALLOWLIST in server/app.ts; hand-back files; package.json
PROOF:  the integration test, written BEFORE the route, asserts the happy path AND the denied paths
        (wrong role → 403, signed-out → 401, other borrower's application → 404/403) — the happy
        path red (404) before and green after; the denied paths pasted AFTER the route lands, since
        a 401 from a route that does not exist is vacuous
MAX_ITER: 8
```

## Iteration procedure

0. **T-1** + claim + the R1b baseline.
1. **Write the integration test before the route**, with all four cases: the happy path; signed-out
   → 401; wrong role → 403; another borrower's application → 404/403. Send
   `X-Forwarded-Proto: https` and `Origin: <BASE_URL>` on every request, log in via
   `POST /api/test-login` with `<role>@test.com` and `DEV_TEST_PASSWORD`, and cache the session
   cookie per file (the auth limiter trips otherwise — `tests/roleSeparation.test.ts`). Add the
   file to `vitest.integration.config.ts`. Then run it against the **unchanged** worktree server
   (`PORT=5002 pnpm dev`, `TEST_BASE_URL=http://localhost:5002`): the happy path is **RED** (404 —
   there is no route), paste it; the three denied paths are green **vacuously** — a 401 from a
   route that does not exist proves nothing about your gate — so they count only when re-run in
   step 4. A happy path that is not red here means the route already exists: stop, `claimed`.
2. Copy the shape of `server/routes/lending/applications.ts`: Zod `safeParse` → `400 {error}`;
   the gate from this table; storage call; `logAudit(req, "<entity>.<verb>", ...)` on any
   mutation; typed JSON out.

   | Caller | Gate |
   |---|---|
   | anyone | none — and the route must not leak per-user data |
   | any signed-in user | `isAuthenticated` (re-reads the role from the DB each request) |
   | a fixed role set | `requireRole("admin", "underwriter", …)` |
   | the application's owner / its deal team | `storage.getLoanApplicationWithAccess(id, user.id, user.role)` |
   | internal staff incl. the file's LO | `verifyInternalStaffApplicationAccess(storage, id, user.id, user.role)` |
   | a cron job | `Authorization: Bearer <CRON_SECRET>` via `isCronRequest` in `server/routes/jobs.ts` |
   | a vendor webhook | under `/api/webhooks/` (CSRF carve-out) + the vendor's signature check |

3. Batch reads with `inArray` (never a query in a loop); multi-table writes in
   `db.transaction`; status changes only through `updatePipelineStage`.
4. Restart the worktree server on the new code and **re-run the step-1 file**: the happy path
   goes green, and the three denied paths are now green *against a route that exists* — paste all
   four again; the second paste is the proof, the first was the reproduction.
5. **T0** → **T1** → commit → **T2** (a new `requireRole(`/`isAdmin(` line is a §9 trigger by
   design — expect a draft PR + ⛔) → **T3** (the integration lane is the proof for a route).
6. If the client will call it: the query key belongs in the factories of
   `client/src/lib/queryClient.ts` (a separate `ui-page.md` loop), and the payload shape follows
   `knowledge-base/handbook/app-guide/12-api-contract.md` (absent / value / `null` are three
   different wire states).
7. Territory check; push; PR body from `_REPORT_FORMAT.md`. Five failed rounds →
   `STATUS: STOPPED(attempt-cap)`.

## What this loop must not do

Trust a client-supplied user id · return an unmasked SSN or account number · add a response path
to the body-log allowlist · insert a registrar in the middle of a group · skip the denied-path
test.

Finish with the LOOP REPORT, then the promise.
