# Core capabilities inside Homiquity

Founder direction, 2026-09-04: the existing Homiquity application remains the product host. Bring Core capabilities into that application, preserving useful existing journeys and infrastructure. This replaces the earlier proposal to rebuild every surrounding feature in a separate app. It does not waive data-access, financial-policy, human-review, or deployment controls.

This implements the L1 borrower-to-officer loop under the L2 provenance, deterministic analysis and human-decision invariants. No Selling Guide policy asserted or altered: the first integration records internal review progress without changing eligibility, income calculations, credit decisions or lender delivery.

## One application and one identity

Existing users, sessions, deal-team membership, loan applications and document storage remain authoritative. Core is a source of focused modules and tests. Do not copy its authentication tables, application tables or migration journal into this repository. No second login, background dual-write system, duplicated application, or borrower re-upload is required by the review integration.

## First integration: review checkpoints

The officer's existing Borrower File has a File review tab. It reads the application's summary, registered documents, application-scoped extracted forms and extracted fields from both extraction paths. It links to the existing document and income review tools.

An officer explicitly acknowledges the current file revision to save an append-only checkpoint. A checkpoint preserves section counts and one-way digests, reviewer identity and time. A later change to those records marks the earlier review out of date and identifies the affected sections. Stale submissions fail with a refresh action; retries do not duplicate review history. Changes to an extracted value and changes to a document's acceptance are tracked separately.

Scope matters: a checkpoint records review progress, including outstanding items. It does not approve the loan, confirm every extracted value, change existing document decisions, compute qualifying income, or assert lender readiness. It covers the application-summary record and evidence records named above, not every URLA, condition or financial-analysis table. It is not a frozen file archive: document-byte versioning and reproducible historical evidence packages remain separate integration work. The UI must not imply otherwise.

Access uses the existing internal-staff roles and active deal-team membership (admin retains existing platform access). Only existing document-review roles may save. Checkpoints and their audit event commit together. Browser responses exclude raw extraction output, encryption fields, storage paths and copied borrower values. Stored checkpoints contain counts and digests, not borrower values or filenames.

The Borrower File header counts its actual uploaded documents and accepted documents. Condition counts use the existing pipeline response's nested condition totals. Neither count represents the complete evidence required for lender submission.

## Second integration: document lineage and ownership

Every newly registered application document now records a server-calculated content fingerprint, an evidence subject and a stable lineage/version. A replacement keeps the original borrower, business, property or whole-file subject and reporting period, while preserving each earlier version for review history. Existing documents remain usable and receive a legacy lineage only when they are first replaced; the officer can assign their subject and period from File Review.

The borrower document journey uses the existing rejected-document and replace actions. A successful replacement becomes the single current version across the borrower dashboard, document checklist, application detail and File Review, even when a loan officer supplied the new version. Superseded extracted values leave the current review, and a prior checkpoint identifies the affected evidence lineage as changed. Pending-document counts resolve the current lineage before testing status.

Internal staff with active file access may replace evidence on the file. Assigned brokers and lenders may add documents and replace only documents they supplied; they cannot supersede borrower-owned evidence. Production upload URLs bind the accepted content type and a create-only object-storage condition. The browser sends the signed condition, so a URL that completed its first upload cannot overwrite the bytes later fingerprinted by the server.

This slice records evidence identity and history. It does not decide whether a document satisfies a lender rule, verify its contents, or turn a review checkpoint into underwriting approval.

## Third integration: financial workpapers and cited memo

The existing Borrower File now has one Financial review path for wage and self-employment income, business liquidity, rental cash flow, assets and liabilities. Each workpaper freezes the safe financial inputs, deterministic output, current accepted document versions, verified extracted-fact identifiers and approved dependency versions that the officer reviewed. Source-file byte fingerprints come from document lineage; extraction-response hashes remain separate provenance and are never relabeled as file hashes.

Preparation and freshness checks read every application, financial and evidence record through one database snapshot. A changed input, document version, verified fact or dependency makes the affected version stale. Workpaper and memo reviews are append-only in the application and database layers. Business evidence explicitly assigned to one entity cannot satisfy another entity's workpaper, and business bank statements cannot satisfy a household-asset reconciliation.

After all current workpapers are approved, the officer can build and approve a versioned credit memo. Its sections cite exact workpaper, document and verified-fact identifiers. Complex-income lender readiness now requires that current approved memo, and income-package version 2 embeds its immutable snapshot. Package assembly occurs before the lender handoff and labels machine extraction, human confirmation and source-file fingerprints independently.

The reference acceptance journey passes with an S-corporation owner, own-business W-2/K-1 income, distributions and liquidity, plus a wage-earning co-borrower, rental property, household assets and liabilities. It covers two-business evidence isolation, dependency order, idempotent retries, stale-input detection, exact memo references and internal access boundaries. This is an internal broker analysis and does not represent lender approval.

## Deployment and rollback

Migration `0060_file_review_checkpoints.sql` adds one table with application/reviewer references and a unique application/version constraint. It changes no existing records and introduces no environment variables or external providers. Deploy through the existing migration and application release gates. To roll back the feature, restore the previous application build and retain the additive table and checkpoint records; dropping review history is not part of rollback.

Migration `0061_document_lineage.sql` adds the application-scoped lineage table, replacement/version constraints and lookup indexes. It changes no existing document rows and introduces no environment variables or providers. Rollback restores the previous application build while retaining the additive lineage table and its audit history. Production object storage must permit the signed `Content-Type` and `x-goog-if-generation-match` request headers already returned by the upload-target endpoint.

Migration [0062_financial_workpapers_memo.sql](../../migrations/0062_financial_workpapers_memo.sql) adds immutable workpaper versions, workpaper reviews, memo versions and memo reviews with application/reviewer references, unique version constraints, fingerprint checks and database append-only triggers. It changes no existing rows and introduces no environment variables or providers. Rollback restores the previous build while retaining the additive financial-review history; dropping reviewed financial records is not part of rollback.

## Reuse record

Source: `barakatammre84/Homiquity-Core`, commit `e8ebf5b9522137e3d5adf8ce8176e728d60047e0`.

| Core unit | Treatment in Homiquity | Contract |
|---|---|---|
| [Core review validity source](https://github.com/barakatammre84/Homiquity-Core/blob/e8ebf5b9522137e3d5adf8ce8176e728d60047e0/shared/analysis-validity.ts) | `validityFromReasons` ported into [reviewValidity.ts](../../shared/core/reviewValidity.ts) | Deduplicate reasons; historical review stays recorded when current validity changes. The Core ruleset-policy function is not imported. |
| Core package-review/workpaper version and freshness pattern | Adapted through [fileReview.ts](../../shared/fileReview.ts) and [fileReview.ts service](../../server/services/fileReview.ts) | Fingerprint existing application/evidence records; append review checkpoints; reject stale writes. No Core database or policy constants imported. |
| [Core workpaper contracts](https://github.com/barakatammre84/Homiquity-Core/blob/e8ebf5b9522137e3d5adf8ce8176e728d60047e0/shared/workpapers.ts) and workpaper service | Adapted through [financialReview.ts](../../shared/financialReview.ts) and [financial review service](../../server/services/financialReview.ts) | Reuse version, dependency, exact-subject, freshness and one-decision invariants against Homiquity's existing income, asset, liability and evidence records. Existing Homiquity financial calculators remain authoritative. |
| Core memo/reference pattern | Adapted into `credit_memo_versions`, exact reference indexes and income-package version 2 | Only current approved workpaper versions enter the memo; complex-income lender submission requires the current approved memo. |
| Core auth, evidence storage and whole application shell | Deferred | Existing Homiquity identity and storage remain in use; any future port must preserve application scoping and document ownership. |

## Integration sequence and acceptance gates

1. ✅ **Officer review checkpoints:** existing application → existing documents → explicit checkpoint → document/value change → changed-review warning → fresh checkpoint. Persistence, role boundaries, concurrent saves and browser interaction pass.
2. ✅ **Document lineage and ownership:** immutable byte fingerprints/version references, subject/period mapping and explicit borrower/business/property associations use the existing application and entity records. Replacement evidence invalidates the affected review, preserves history and remains attributable to its source.
3. ✅ **Financial workpapers and memo:** Core's dependency, review and memo controls now bridge the existing financial calculators, reviewed documents and lender package. The supported complex borrower scenario reproduces reviewed calculations and a cited memo from immutable versions; stale or wrong-business evidence fails closed.
4. **Next — borrower correction loop:** connect officer requests, borrower corrections and document replacements through the existing portal. Exit: one login, one application, preserved answers and no duplicate upload requests.
5. **Retire overlap:** retire a redundant implementation only after the same fictional borrower journey passes through its replacement, rollback is rehearsed, and existing records reconcile. Keep real lender acceptance as a separate external gate.

The reference journey is an S-corporation owner with W-2/K-1 income, distributions, business liquidity, a co-borrower and rental property. Measure repeat questions, repeat uploads, officer corrections and time to reviewed evidence. Implementation and test completion are not evidence of a working lender relationship.
