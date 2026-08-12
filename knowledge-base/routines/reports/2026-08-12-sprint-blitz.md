# Sprint Blitz — 2026-08-12

STATUS: OK — one PR shipped ([#514](https://github.com/barakatammre84/Homiquity/pull/514), CTO_ROADMAP §3.2), all gates green, claim released.

## ⛔ Human actions

1. **Merge or close [PR #514](https://github.com/barakatammre84/Homiquity/pull/514).** Auto-merge deliberately not armed (CHARTER §8). Nothing in it needs a decision from you first.
2. **Roadmap §2.1 is stale: [#446](https://github.com/barakatammre84/Homiquity/pull/446) is MERGED** (`state: MERGED`, gate SUCCESS 2026-08-07T03:07Z) but still sits unchecked as launch-blocking engineering. This is Evening Triage's territory under CHARTER §6, so this run did not edit `CTO_ROADMAP.md` — proposed as a ticket below.
3. **Today's Launch Gate report is missing** (`reports/` holds only `2026-08-12-wiring-audit.md`). Per §1 this routine ran `pnpm check` and `pnpm test` on `origin/main` itself — both green, so no fix-first mandate. Whether the gate was skipped (laptop shut) or broke is for Evening Triage to distinguish.

## Summary

Today's Launch Gate report was absent, so I ran the gates on `origin/main` myself: `pnpm check` exit 0 and `pnpm test` 2,692 node + 504 client, all passing — main is releasable, no fix-first item. §0 and §1 are entirely founder-held; §2's three items turned out to be one already-merged PR and two blocked purely on Railway variables (I verified §2.2's code half by tracing all seven `useUpload` consumers — every one handles failure honestly), which left §3.2, "the last N+1 loop," as the highest-ranked eligible engineering item. Shipped it: the compliance dashboard called a validator that makes 15 storage reads per file, once per in-flight file, so I split the validator's loading from its scoring and gave the list view a batched `inArray` loader — 15N+1 reads become a flat 4, and the verdicts are identical by construction because both entry points now call the same pure scorer. The claim was taken and released through REGISTER.md, which held no competing claims at either end.

## Evidence

**Preconditions.** `git fetch` put `origin/main` at `a58bea5` (4 commits ahead of the primary checkout's `adaa826`). Fresh worktree `.claude/worktrees/blitz-0812` off `origin/main`, `pnpm install --frozen-lockfile` re-run after the rebase per CHARTER §5.1.

**Main was green before I touched it** — `pnpm check` exit 0; `pnpm test` **189 files / 2,692 node** + **70 files / 504 client**, exit 0.

**Peers observed.** `ListAgents` showed five interactive sessions: `homiquity-88`, `homiquity-f1`, `homiquity-8e`, `homiquity-37`, and `pensive-noether-5232f2-ce`. The last one holds the worktree `.claude/worktrees/pensive-noether-5232f2` on branch `claude/queryclient-migration-batch2` — i.e. the Wiring Audit's proposed ticket #1 (the remaining 72 singleton `queryClient` importers) **is being worked right now**, though no REGISTER.md row was filed for it. REGISTER.md's active table was empty on arrival and is empty again on exit.

**Why §3.2 and not something in §2.** Ranked per CHARTER §1:

- **§0** — KTLO-1/2/3 all founder-held (Railway billing, Actions capacity, Neon compute). No engineering item.
- **§2.1** — `gh pr view 446` returns `"state":"MERGED"`. The item is done, not blocked; nothing to build.
- **§2.2** — the code half is genuinely complete. `/api/uploads/request-url` returns an honest enveloped 503 (`server/routes/documents.ts:77-93`), and **all seven** `useUpload` consumers check for failure rather than rendering success on it: `UploadDocumentDialog.tsx:157`, `DocumentUploadButton.tsx:50`, `TaxReturnInsightCard.tsx:104`, `TaskDetail.tsx:86`, `Tasks.tsx:150`, `Documents.tsx:162`, and the hook itself returns `null` on failure (`use-upload.ts:155-158`). What remains is `GCS_SERVICE_ACCOUNT_KEY` + `PRIVATE_OBJECT_DIR` — founder-held. *(Checked because the silent-success class is this repo's dominant defect; it is clean here.)*
- **§2.3** — gated on §1.1/§1.2.
- **§3** — most items need a product or founder decision (3.4, 3.6, 3.7, 3.8, 3.10), citable authority this repo does not hold (3.1's escalations, 3.9's VA tables), or speculative schema for personas that do not exist yet (3.5, which `3.11` itself defers). **3.2 is engineering-only, unblocked, needs no schema and no new dependency.**

**The defect, measured.** `server/routes/underwriting/compliance.ts` mapped every active application through `getApplicationValidationSummary`, and `validateMISMOCompleteness` (`server/services/mismoValidation.ts:590-599`) issues 15 storage reads per call — `getCompleteUrlaData` alone is 11 (`server/storage/urla.ts:533-545`), plus application, conditions, documents, borrower profile. 100 in-flight files ⇒ ~1,500 concurrent queries. The application re-read was pure waste: the route already held the rows. Only this one route looped; the four other validator callers (`aus.ts:194`, `underwriting/submissions.ts:31`, `loanDeliveryReadiness.ts:216`, `brokerSubmissionReadiness.ts:264`) are all single-application and unchanged.

`getBatchValidationStatus` had **zero callers** and was itself the N+1 spelling — rebuilt on the batch path rather than left for the next caller to adopt.

**Gates on the branch** (`d7338ff`, rebased on `a58bea5`, reinstalled after the rebase):

| gate | result |
|---|---|
| `pnpm check` | exit 0 |
| `pnpm test` | **2,718 node** (was 2,692; +26) + **504 client**, exit 0 |
| `pnpm guard:schema` / `:tokens` / `:channel` / `:docs` / `:querykeys` / `:migrations` / `:kb` | all exit 0 |
| `pnpm build` | exit 0 |
| `detectTriggers()` over all 10 changed files | `[]` |

§9 was audited by **running** `detectTriggers()` from `scripts/security-review-guard.cjs`, not by reading the trigger list (CHARTER §10). No trigger fired. `server/storage/urla.ts` does handle PII, so the SSN presenter on the batched personal-info rows is called out explicitly in the PR and pinned by a source guard.

**Test honesty.** `tests/mismoValidationBatch.test.ts` — 18 cases, confirmed registered in the node `include:` array by `vitest list` (CHARTER §10's "assert your new test appears by name"). Verified by **reintroducing the bugs**: mis-keying the borrower-profile map by `applicationId` → 1 failure; treating a co-applicant row as primary → 1 failure; skipping files with no `personalInfo` → 4 failures. A fourth mutation — making the URLA buckets sparse instead of dense — **did not fail**, because the consumer falls back with `?? []`. The comment asserting denseness was load-bearing for scoring was corrected rather than left overstated; denseness is kept as the storage boundary's contract and the test now says what it actually proves.

**Not verified.** No browser check — dev servers do not start in an unattended run (CHARTER §10); a peer's server already occupies the primary port. The batched SQL itself is not exercised by a hermetic test: the per-application split was extracted to `server/storage/urlaBatch.ts` (pure, no `db` import) so it *could* be, and the queries around it are pinned by source guards in `tests/nPlusOneBatching.test.ts`.

## Proposed tickets

For Evening Triage to land — none edited into the roadmap directly.

1. **Delete §2.1 from `CTO_ROADMAP.md`** — [#446](https://github.com/barakatammre84/Homiquity/pull/446) is merged; append it to the archive ledger per the roadmap's own maintenance rule 2. Leaving it makes §2 look like it has three open engineering items when it has zero.
2. **Rewrite §2.2 as founder-held.** Its code half is verified complete (evidence above); as written, "Fix uploads end-to-end" reads as engineering work and will keep drawing routines into re-verifying it. The residue is two Railway variables, already listed in §1.2.
3. **Tick §3.2 closed** once #514 merges.
4. **§3 is nearly out of engineering-eligible work.** Of thirteen items, ten need a founder/product decision or authority this repo does not hold. If the Blitz is to keep shipping daily, the queue needs either those decisions or new engineering items — otherwise the honest outcome on most days is "queue empty," which is a governance signal, not a scheduling accident.
5. **A peer is migrating the remaining 72 singleton `queryClient` importers** on `claude/queryclient-migration-batch2` **without a REGISTER.md row.** The register only works if every writer files one; worth a nudge rather than a rule change.
6. **`server/storage/{batchGroup,urlaBatch}.ts` are now shared ground** for the next batching job — grouping helpers with the ordering/denseness contract documented. Use them rather than hand-rolling another group-by.

## Eligible queue after today

**§0/§1:** nothing engineering-eligible (all founder-held). **§2:** empty once 2.1 and 2.2 are corrected. **§3:** 3.3 (internal data-lineage view) and 3.14 (platform fee income on receipt — schema-touching, needs a migration) are the only unblocked engineering items left that need no outside decision; both rank LOW on CHARTER §1's two questions.

STATUS: OK
