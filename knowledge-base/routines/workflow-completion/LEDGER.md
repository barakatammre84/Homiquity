# Workflow Completion Engine — cross-run ledger

One row per run. **Rotate**: pick the workflow with the oldest `last driven` date below,
unless a peer report from the last 24 h names a seam that blocks a client outright.

Workflows are numbered as in [`../../feature-review/WORKFLOWS.md`](../../feature-review/WORKFLOWS.md).

## Rotation state

| # | Workflow | Last driven by this routine | Step reached |
|---|---|---|---|
| 1 | Pre-approval / instant decision | never | — |
| 2 | Intake → AUS → lender package | never | — |
| 3 | GSE loan-delivery readiness | never | — (⚠️ WORKFLOWS.md D-014: do not re-run until the script gains an "emitted value == stored value" leg) |
| 4 | Document upload → extraction → qualification | **2026-08-20** | step 3 — seam found and fixed |
| 5 | Credit consent → pull → denial → adverse action | never | — |
| 6 | Verification-driven provenance promotion | never | — |
| 7 | Lifecycle / evergreen re-engagement | never | — (cron-only; no client-drivable surface) |

## Runs

### 2026-08-20 — Workflow 4, step 3

- **Driven:** steps 1–3 live against a worktree dev server (see the port note below). Steps 4–5 not
  driven — reported as **not driven**, not inferred.
- **Seam:** extraction reaches a document by two routes — the staff `POST /api/documents/:id/extract`
  and the fire-and-forget branch inside `POST /api/documents/upload`. Only the second is reachable
  from the borrower UI (`DocumentReviewPanel.tsx` is the sole caller of the first). F-028
  (`persistDocumentFacts`) and F-030 (`wireExtractionToReadiness`) were wired into the staff route
  and never into the borrower's, so a borrower's pay stub was read by the model and its values
  discarded — the exact gap `server/services/documentFacts.ts`'s own docblock says it closes.
  Lineage (`modelId`, `promptVersion`, `rawResponseHash`, the encrypted raw response) was dropped on
  that path too, which WORKFLOWS.md §4 step 3 requires.
- **Shipped:** `server/services/extractionPersistence.ts` — post-extraction behaviour now exists once
  and both routes call it. Mutation-proven.
- **Refused:** nothing. No rail blocked the fix; `detectTriggers()` returned `[]`.
- **Left undone:** steps 4–5 of the workflow; the two findings below.

**Findings raised, not fixed** (out of this run's one-seam scope):

- **WFC-0820-01** — `EXTRACTION_SIMULATE=true` simulates **tax returns only**
  (`server/extractionDocuments.ts:116`). `extractPayStubData`, `extractBankStatementData` and
  `extractLeaseData` have no simulation branch and return `confidence:"low"` with zero fields when
  no Anthropic key is present. Those three are *exactly* the types the borrower's upload
  auto-extracts, so the borrower-reachable extraction path cannot be exercised locally or in CI at
  all. That is a plausible reason this divergence survived: the path had no cheap way to be seen.
- **WFC-0820-02** — `server/routes/lending/documents.ts` was absent from
  `FEATURE_MAP.md` area 11 and from `hq-documents-owner`'s scope. Corrected in this PR; the general
  hazard is that a route can be unowned while the service it calls is owned.
