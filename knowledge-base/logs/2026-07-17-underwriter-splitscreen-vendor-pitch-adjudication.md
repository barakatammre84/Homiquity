# Underwriter split-screen vendor pitch — adjudication — 2026-07-17

> Dated, immutable snapshot (TEAM_PRACTICES §2). Never rewritten; supersession goes in a banner here.
> Authority: adjudicates an external artifact against **code** per the KB precedence rule ("code wins
> over any doc on a stale fact" — [L1 §7](../L1_VISION_AND_SCOPE.md)). Verdicts below cite code, not docs.
> House precedent: the [2026-07-17 agentic-artifacts evaluation](2026-07-17-external-agentic-mortgage-artifacts-evaluation.md)
> — its **§4 binding rejections control here** — and the
> [2026-07-12 external strategy adjudication](2026-07-12-external-strategy-adjudication.md).

A vendor/consultant pitch (received 2026-07-17; sales document, personalized to the founder) proposed
a four-part build: (1) an "underwriter split-screen" staff UI — conditions task list on the left, an
embedded PDF viewer with OCR bounding boxes on the right; (2) a prioritized broker queue with three
buckets (ready-for-verification / exception-flagged / stalled-missing-docs) plus an automated 48-hour
missing-docs follow-up; (3) a `loan_conditions` + `uploaded_documents` schema; (4) an architecture
recommendation — Amazon Textract or a "Document AI microservice" for OCR, WebSocket push to the broker
pane, built "on Replit". Every element was adjudicated against this repository the same day; every
claimed gap below was verified in code before being recorded.

## 1. Pitch-element verdicts

| Pitch element | Verdict | Why (evidence) |
|---|---|---|
| `loan_conditions` + `uploaded_documents` tables | **Reject — already shipped, richer** | `loan_conditions` exists with a fuller model than the pitch's 5-status enum: category/priority vocabularies, `requiredDocumentTypes[]`, task + lender-submission links, `clearedByUserId/At/Notes` (`shared/schema/underwritingConditions.ts:218-241`). Uploads: `documents` (`shared/schema/lendingCore.ts:444`) + `document_confidence_scores` (`shared/schema/intelligence.ts:746` — confidence, `humanReviewRequired/Completed/By/At`, accuracy accounting) + encrypted extraction lineage on the doc row. The pitch's `s3_bucket_url` and plaintext `ocr_payload JSONB` are both worse than shipped practice: we persist normalized `/objects/<id>` keys behind GCS ACL checks (`server/integrations/object_storage/`), and raw model output is AES-256-GCM encrypted at rest, never plaintext. Its `verified_by_user_id` column duplicates attribution we already carry in the audit log (`document.verified`/`document.rejected`) and the confidence row |
| OCR via Textract / "Document AI microservice" | **Reject — capability exists behind the M-1 adapter** | `server/extractionService.ts` (Anthropic-only, MRG inventory row M-1) already reads uploaded tax returns, pay stubs, bank statements, and leases, wired into upload auto-extract (`server/routes/lending/documents.ts:252-297`) with the untrusted-output discipline (Zod clamps, consistency checks, confidence caps, encrypted raw). A second OCR vendor is a new stack for a shipped capability — barred by precedent §4.4; the all-Anthropic doctrine (#146/#150, Gemini purged via migrations 0030/0031) applies |
| OCR bounding boxes in the viewer | **Park** (§5) | Extraction returns fields, not coordinates — Claude-vision output carries no trustworthy pixel geometry. The schema home for real boxes already exists dormant (`extracted_fields.boundingBox`, `document_pages` — `shared/schema/documents.ts`), waiting on rasterization infra that doesn't exist (`shared/schema/documents.ts:281-285`) |
| Split-screen staff document review UI | **Adopt — the pitch's one real find** (§2-A) | `POST /api/documents/:id/verify` has **zero client callers** (grep-verified); staff cannot view, download, or verify a borrower document from any UI |
| Prioritized broker queue (3 buckets) | **Mostly shipped; one bucket adopted** (§2-B) | Priority machinery is already three-layered: pipeline queue `priority`/`fileHealth`/`daysIdle` (`server/pipelineEngine.ts`), staff signals P1–P4 (`server/services/signalEngine.ts:22` — `preuw_flag`, `conditions_review`, `stalled` at 3+ days idle, `docs_expiring`), SLA sort (`client/src/lib/sla.ts`). "Exception flagged" is deterministic pre-UW flags today — the pitch's own large-deposit example is literally `LARGE_DEPOSIT_SOURCING` (`server/services/preUnderwriting.ts`), and OCR trouble already emits `DOCUMENT_OCR_ISSUE` task events. The genuinely missing bucket is "docs ready for review" → adopted as a signal type |
| 48-hour missing-docs follow-up | **Adopt, adapted** (§2-C) | No time-based nudge exists; adopted as a daily lifecycle pass (⇒ day granularity, not literal 48h), email + in-app only — no SMS sender exists (`smsCompliance.ts` rails are sender-less) |
| WebSocket push to the broker pane | **Reject — precedent §4.4 + platform reality** | The app is one Vercel serverless function, `maxDuration: 30` (`vercel.json`); realtime is SSE (coach, autopilot) + TanStack polling (30–60s staff surfaces). WS needs an external broker — a new stack for freshness polling already delivers |
| "Values perfectly match → single-click confirmation" | **Human half adopted; auto half rejected** | MR-2 doctrine (`knowledge-base/governance/MODEL_RISK_GOVERNANCE.md`, remediation table): extraction stages a doc at most to `"verifying"`; `"verified"` is reachable only via the human, role-gated, audit-logged verify route (`server/routes/documents.ts:303-308, 405-459`). A deterministic stated-vs-extracted **display badge** is fine triage; nothing model-derived may bind or feed M-2 decision inputs |
| "On Replit" | n/a | Platform is local + Vercel |

## 2. Homiquity gaps confirmed (each verified in code before being claimed)

**A. No staff document review surface — the core adoption.** The human-verify endpoint exists,
role-gated and audit-logged (`server/routes/documents.ts:405-459`), but no client code calls it; the
staff BorrowerFile "Documents" tab is a read-only list with no per-document download, view, or action
(`client/src/pages/staff/BorrowerFile.tsx`); the `"verifying"` staging status surfaces nowhere
staff-side. **Action: split-screen review workbench** on the BorrowerFile Documents tab — left:
grouped review list (needs-review / verified / rejected), extraction summary, verify / reject-with-reason;
right: a **safe in-app viewer** — pdfjs-dist canvas rasterization (`isEvalSupported: false`) and blob
`<img>` for images, fetched through the existing deal-team-gated download route. Never
`iframe`/`embed`/`object`: the attachment-only, no-execute posture (`server/routes/documents.ts:233-235`,
CSP `objectSrc 'none'`) is preserved — canvas rasterization never hands the bytes to a browser plugin.
Two sub-gaps found en route, fixed in the same PR: (i) `POST /api/documents/:id/extract` is
owner-or-admin only (`documents.ts:267`) — deal-team staff can't re-run extraction (widen to mirror the
verify gate; the route also writes no audit entry today); (ii) human verify never stamps
`document_confidence_scores.humanReviewCompleted/By/At`, starving the MR-6 accuracy loop.
**Data fact recorded for the design:** the current notes writers persist extraction field **names**
only, plus confidence/warnings/`humanReviewRequired` (`server/routes/documents.ts:309`,
`server/routes/lending/documents.ts:290`, autopilot orchestrator) — extracted **values** exist only in
a fresh `/extract` response and the encrypted raw. The stated-vs-extracted compare is therefore
**on-demand and ephemeral**; persisting plaintext values is a PII-posture change, parked (§5).

**B. No cross-file "docs awaiting review" signal.** The signal union
(`server/services/signalEngine.ts:22`) has nothing for documents sitting in `"verifying"` (or
`"uploaded"` with an open human-review requirement) — a doc staged by extraction waits invisibly until
someone happens to open that file. **Action: `docs_ready_for_review` signal**, priority 2 (peer of
`conditions_review`), grouped per application, deep-linking to the A-gap workbench tab.

**C. No missing-docs nudge.** `lifecycleEngine` nudges only for document *expiry* (the 25-day
freshness mark, `server/services/lifecycleEngine.ts:132-134`); autopilot follow-ups are
condition-creation-driven, not time-based (`server/services/autopilot/followUps.ts`); the `stalled`
signal is staff-facing. A borrower who never uploads is never reminded. **Action: daily lifecycle
pass** — outstanding `loan_conditions` with `requiredDocumentTypes`, aged into a one-day `[2d,3d)`
window (the existing dedup trick), no matching upload per the alias-aware `documentTypesMatch`
(`shared/documentTypes.ts`) → one in-app notification + one email. Copy stays inside the Reg N rails
(no approval/eligibility/decision language — `tests/complianceInvariants.test.ts` greps
`emailService.ts` for exactly this).

## 3. Validations — where the house doctrine held up against the pitch

- **MR-2 human-verify-only gate**: the pitch's auto-verification impulse ("values perfectly match →
  quick confirmation") is the exact failure mode the MR-2 remediation closed — model confidence
  stages, humans verify. The pitch's mock even shows "Verified by System" on an ID document; identity
  verification is a distinct consented flow (`verifications` table), never a template for financial docs.
- **No-execute download posture**: `Content-Disposition: attachment` + CSP survive the embedded-viewer
  requirement untouched — rasterize-to-canvas needs no inline serving.
- **Upload→condition auto-matching**: already live (`server/pipelineEngine.ts:405`,
  `outstanding→submitted`; clearing stays human) — the pitch's headline automation was shipped before
  the pitch arrived.
- **Confidence accounting**: per-extraction confidence with human-review thresholds and accuracy
  rollups already modeled (`document_confidence_scores`, `server/services/documentConfidence.ts`).
- **Queue prioritization**: three shipped layers (§1) vs the pitch's single sort — its buckets map
  onto existing vocabulary rather than replacing it.

## 4. Rejections (the 2026-07-17 memo §4 controls; applied to this pitch)

1. **No parallel conditions/documents schema.** `loan_conditions` / `documents` /
   `document_confidence_scores` are the system of record; duplicative tables are rejected outright.
2. **No second OCR vendor or extraction microservice** (Textract, "Document AI"). Extraction stays
   behind the single Anthropic M-1 adapter; if a real coordinate-grade OCR engine ever lands, it lands
   as the dormant page-pipeline's engine, not a parallel path.
3. **No WebSocket push infrastructure** (§4.4 — no new stacks). SSE + polling remain the realtime
   pattern on this platform.
4. **No auto-verification of financial documents** (§4.1 applied to verification). Model output may
   stage, never bind; the human click is the only path to `"verified"`, and extracted values never
   silently overwrite stated application data.
5. **No raw storage URLs on rows.** Object keys + ACL checks (`normalizeObjectEntityPath`,
   `objectAcl`) remain the storage contract.

## 5. Parked register (tracked, not drift — each with its reopen gate)

- **OCR bounding-box overlay** — reopen gate: rasterization infra for the dormant
  `document_uploads`/`document_pages`/`extracted_fields` pipeline (schema shipped; no rasterizer —
  `shared/schema/documents.ts:281-285`). Claude-vision extraction cannot supply trustworthy coordinates.
- **WebSocket / live push** — reopen gate: a platform move off the single serverless function, or an
  external-broker decision made on its own merits.
- **SMS nudge channel** — reopen gate: a real SMS sender. TCPA rails (STOP ledger, quiet hours,
  inbound webhook) exist sender-less in `server/services/smsCompliance.ts` + `quietHours.ts`.
- **Dedicated W-2 extractor** — `w2` is in `DOCUMENT_TYPE_TAXONOMY` with a review threshold, but
  `POST /extract` supports four types; W-2 wages arrive today via Form 1040 line 1a (`w2Wages`).
  Reopen when per-employer W-2 conditions become a real volume driver.
- **Persisting sanitized extracted values on the document row** — would let the workbench compare
  without a fresh model call. Reopen gate: a security-reviewed PII-posture decision (plaintext
  financial values at rest vs today's names-only notes + encrypted raw).

## 6. Actions

1. **This log's PR** (`claude/underwriter-splitscreen-adjudication`): this memo + KB index line +
   roadmap singles A6/A7/A8.
2. **Workbench PR** (`claude/staff-document-review-workbench`): gap A — split-screen review UI,
   safe viewer, extract-gate widening + audit entry, `humanReviewCompleted` stamping. New exact-pinned
   client dep `pdfjs-dist` (lazy staff-only chunk). **TEAM_PRACTICES §9 security review before merge**
   (uploads/document access/role gates).
3. **Signal PR** (`claude/docs-ready-signal`): gap B — `docs_ready_for_review`, after the workbench
   PR (deep-links its tab).
4. **Nudge PR** (`claude/missing-doc-nudge`): gap C — lifecycle pass + `missingDocumentsReminder`
   email template. **TEAM_PRACTICES §9 security review before merge** (outbound messaging).
