# Workflow Completion Engine — 2026-08-20

`STATUS: OK` — Workflow 4 driven to step 3; the seam there is that the borrower's own upload
extracts their pay stub and throws the values away. Fixed and mutation-proven in PR #628.

## ⛔ Human actions

1. **Review and merge [PR #628](https://github.com/barakatammre84/Homiquity/pull/628).** Merging is
   L3 (CHARTER §1b) and a merge to `main` is a production deploy.
2. **Note the prod-impact line in the PR body**: the borrower's upload path now *writes* the
   already-encrypted raw model response (`extraction_raw_encrypted`/`_iv`/`_key_id`) and the
   response hash, where before it wrote neither. No new plaintext, no new column, no migration —
   the ciphertext is produced upstream by `rawLineage()` → `encryptSensitiveData()`
   (`server/extractionValidation.ts:256`) and the staff route already persisted it. `detectTriggers()`
   over the diff returned `[]`; this is flagged because a §9 gate proves a review was *written down*,
   never that it was correct (CHARTER §10).

## Summary

Workflow 4 (document upload → extraction → qualification) was the oldest actually-driven workflow —
last verified 2026-07-12, five weeks ago — so the rotation took it. Steps 1 and 2 pass live: the
presigned-only gate holds, multipart is refused, and a registered document lands with the right
owner and ACL. Step 3 fails for a borrower: extraction reaches a document by two separate routes,
and the value-persistence fixes (F-028) and readiness wiring (F-030) had been wired into the
staff-only route while the borrower's own upload path — the only one reachable from the borrower
UI — kept writing field *names* and discarding the numbers, which is precisely the gap
`server/services/documentFacts.ts` was written to close. The fix puts the post-extraction behaviour
in one place both routes call, so they cannot drift again. Steps 4 and 5 were **not driven** and are
reported as such.

## Evidence

### Environment (both staleness traps checked)

```
$ curl -s http://localhost:5012/api/health
{"status":"ok","timestamp":"2026-08-20T14:59:13.910Z","commit":null,...}
```

`commit: null` is the local-dev signature. Server process start `Thu Aug 20 11:33:58 2026` local vs
`origin/main` tip `53044804` dated `Thu Aug 20 09:01:48 2026 -0500` — the server is **newer than the
code under review**, so no stale-process finding. Worktree cwd verified as `wfc-wt`, not the primary
checkout.

**Port deviation, stated rather than hidden:** the charter's worktree port is 5002. Starting there
died `EADDRINUSE` in a race with a peer session's dev server (PID 8684, worktree `wt-fix`), so this
run used **5012**. Nothing else about the run differs.

### Step 1 — presigned-only [gate] · PASS

```
$ POST /api/uploads/request-url  {"name":"1040-2024.pdf","contentType":"application/pdf"}
200 {"uploadURL":"/api/uploads/local/31c926c8…","objectPath":"/objects/31c926c8…"}

$ POST /api/documents/upload  (multipart/form-data)
400 {"error":"Multipart uploads are not supported. Request a presigned URL from
     POST /api/uploads/request-url, PUT the file there, then register it here as JSON."}
```

### Step 2 — upload + register · PASS

```
$ PUT /api/uploads/local/31c926c8…      200 {"ok":true}
$ POST /api/documents/upload            201 {"id":"62a35834…","status":"uploaded", …}
```
Magic-byte guard confirmed live at `server/routes/documents.ts:135`.

### Step 3 — extraction · **FAIL (the seam)**

Two paths reach extraction, and only one of them is a borrower's:

| | staff path | borrower path |
|---|---|---|
| route | `POST /api/documents/:id/extract` (`server/routes/documents.ts:278`) | auto-extract inside `POST /api/documents/upload` (`server/routes/lending/documents.ts:316`) |
| only caller | `client/src/components/staff/DocumentReviewPanel.tsx:134` | the borrower's own upload |
| `persistDocumentFacts` (F-028) | ✅ | ❌ |
| `wireExtractionToReadiness` (F-030) | ✅ | ❌ |
| `modelId` / `promptVersion` / `responseHash` | ✅ | ❌ |
| encrypted raw response | ✅ | ❌ |

`grep` is unambiguous — each fix had exactly one call site, and it was the staff one:

```
$ grep -rn "persistDocumentFacts" server --include="*.ts" | grep -v services/documentFacts.ts
server/routes/documents.ts:397,398          # ← the only caller

$ grep -rn "wireExtractionToReadiness" server --include="*.ts" | grep -v optimizationEngine
server/routes/documents.ts:416              # ← the only caller

$ grep -rn "/extract" client/src
client/src/components/staff/DocumentReviewPanel.tsx:134   # ← the only client trigger
```

Dated, per CHARTER §10 — this is not a re-report of a closed row:

```
$ git log --oneline -S "persistDocumentFacts" -- server/routes/documents.ts server/routes/lending/documents.ts
5868b117 Close the audit's pricing-policy findings, and make uploaded documents
         actually reduce the ask (#447)
```
One commit, touching the staff route only. The borrower's path has never had it.

The consequence is stated by the fixed file itself, `server/services/documentFacts.ts:5-9`:
*"A borrower uploads a pay stub. A model reads it. The numbers are then discarded … the platform
kept asking for figures it had already been shown."* `buildDocumentFacts` handles exactly `pay_stub`
and `bank_statement` — two of the three types the borrower's upload auto-extracts — and
`borrowerGraph.ts:427` is the consumer that went hungry.

**Live, before the fix** — a borrower pay-stub upload, notes carrying names and no lineage:

```json
{"extractedAt":"2026-08-20T15:48:53.689Z","extractedFields":[],"confidence":"low",
 "humanReviewRequired":true,"warnings":["Failed to extract data from pay stub"]}
extractionResponseHash: null
```

**Live, after the fix** — same upload, same server, lineage now recorded:

```
status                : uploaded
notes.modelId         : claude-sonnet-5
notes.promptVersion   : 2026-07-v3
notes.confidence      : low
```

⚠️ **Honest limit on the live half.** Both live runs read `confidence:"low"`, because the fixture is
a synthetic PDF rather than a genuine pay stub and **pay stubs have no local simulation** (see
WFC-0820-01). So the live evidence proves the *lineage* half of the fix and nothing more; the facts
and readiness half is proven by test, below, not by the running server.

### The fix, proven by reintroduction

`tests/extractionPersistence.test.ts` drives the **real** upload route on an ephemeral port (the
harness pattern from `tests/documentUploadTerminalGuard.test.ts`) with a stubbed extractor.

```
before the fix      3 failed | 2 passed (5)
  × persists the extracted VALUES, not just the field names
      → "expected vi.fn() to be called 1 times, but got 0 times"
  × credits the readiness fields the values support
  × records model and prompt lineage on the document, as the staff path does
      → "expected undefined to be 'sha256:deadbeef'"

after the fix       5 passed (5)

bug reintroduced    3 failed | 2 passed (5)   ← the same three, and only those
restored            5 passed (5)
```

The two that stay green throughout are the gates this change must **not** move: extraction still
cannot self-verify (MR-2 — the highest status it may reach is `verifying`), and a low-confidence
read still persists no facts. Tightening only; nothing weakened.

### Gate

```
pnpm check          0 errors
node lane           207 files · 3020 passed | 1 skipped
client lane         110 files · 714 passed
guard:tokens        OK      guard:querykeys   OK
guard:schema        OK      guard:migrations  OK
guard:kb            OK      guard:docs        OK
guard:security      OK      guard:citations   OK
pnpm build          OK  →   guard:bundle      OK (server-only diff; 0 client bytes)
detectTriggers()    []
```

`tests/extractionPersistence.test.ts` was added to `vitest.config.ts`'s `include` and its filename
was confirmed in the run output — an unlisted `tests/**` file never runs.

**The gate above was re-run after merging `origin/main`.** Main moved **10 commits** during this run
(#587, #589, #597, #599, #611, #612, #614, #616, #618, #621), so the first green gate was against a
base that no longer existed. `pnpm install --frozen-lockfile` was re-run after the merge — a
worktree resolves `node_modules` upward without it and reports the primary checkout's state.

**One thing I reverted deliberately:** `pnpm guard:bundle` rewrote
`scripts/bundle-size-baseline.json` from 523,791 → 523,682. That improvement is not mine — this diff
touches no client file — so carrying it here would misattribute someone else's landed work. Reverted;
it will be absorbed by the next client-side PR.

## Steps not driven

Reported as **not driven**, never inferred:

- **Step 4** (self-employment qualification consumes the extraction; 2-year tax-return condition
  logic) — reaching it needs an application with materialized conditions and a high-confidence
  tax-return read on an *attached* file. Out of one-seam scope once step 3 failed.
- **Step 5** (`[gate]` another borrower's session cannot fetch the document) — not exercised. The ACL
  code was read (`server/routes/documents.ts:151-182`) and looks correct, which is **not** a
  verification and is not recorded as one.

## Proposed tickets

For Evening Triage to land — not edited into the roadmap here.

1. **WFC-0820-01 (P2) — the borrower's extraction path cannot be exercised without a live vendor key.**
   `EXTRACTION_SIMULATE=true` has a simulation branch for tax returns only
   (`server/extractionDocuments.ts:116`); `extractPayStubData`, `extractBankStatementData` and
   `extractLeaseData` return `confidence:"low"` with zero fields when no key is present. Those three
   are exactly the types the borrower's upload auto-extracts. A deterministic simulation for them —
   matching the tax-return one already there — would make this whole path locally drivable, and is
   the most likely reason today's seam went unseen for as long as it did.
2. **WFC-0820-02 (P3) — a route can be unowned while the service it calls is owned.**
   `server/routes/lending/documents.ts` was in no `FEATURE_MAP.md` area while
   `server/services/documentFacts.ts` sat in area 11. Corrected in this PR for this one file; worth a
   sweep asking which other `server/routes/**` files appear in no area at all.
3. **WFC-0820-03 (P3) — WORKFLOWS.md §4 should name which extraction path each step means.** Step 3
   reads as one thing and is two, and the script would have passed against the staff route while the
   borrower's was broken — the same "the script itself is the finding" pattern D-014 and D-0818-03
   already record for workflows 3 and 6.

STATUS: OK
