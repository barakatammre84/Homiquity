# 2026-08-04 — External "Sovereign Underwriting Stack" pitch: adjudication

> **Dated snapshot** (Tier 4). Facts verified against the code on 2026-08-04 (HEAD `eb26923`);
> verdicts govern until a reopen gate below fires. Same protocol as
> [2026-07-17-external-agentic-mortgage-artifacts-evaluation.md](./2026-07-17-external-agentic-mortgage-artifacts-evaluation.md),
> [2026-07-19-modular-architecture-pitch-adjudication.md](./2026-07-19-modular-architecture-pitch-adjudication.md), and
> [2026-08-04-rate-com-competitive-pitch-adjudication.md](./2026-08-04-rate-com-competitive-pitch-adjudication.md):
> adopt nothing wholesale, verify every claim in code, extract what survives, record binding
> rejections with reopen conditions.

## 0. What arrived, and the ask

An external architecture pitch for a "truly sovereign, zero-margin underwriting engine" built
on "modern serverless primitives," organized as four layers plus an MVP execution plan:

1. **Storage/routing** — Cloudflare R2 ("zero egress fees") + Cloudflare Workers as the API
   gateway and frontend edge.
2. **Direct IRS IVES A2A service** — "the $4.00 transcript": a Python FastAPI microservice
   ("easily prototyped and hosted on … Replit") that e-signs Form 4506-C
   (`react-signature-canvas` + `pdf-lib`), submits to the IRS e-Services A2A API, and polls the
   Secure Object Repository (SOR) mailbox for official transcripts.
3. **"Zero-cost" document ingestion** — Google Cloud Document AI Form Parser (~$0.015/page)
   plus a Python worker mapping its JSON output to tax-form lines.
4. **SAM engine + Non-QM router** — `Qualifying Income = Net Profit + Depreciation + Home
   Office Expenses` per "Fannie Mae Form 1084 formulas"; on Agency failure, "automatically runs
   the data against a matrix of wholesale Non-QM guidelines (Bank Statement, Asset Depletion)
   to find a qualifying path."

The MVP plan says to build the parsing engine first ("the core intellectual property"), start
the IRS IVES paperwork in parallel, and ship a `react-dropzone` upload zone that "instantly"
shows a success card breaking down "how their Qualifying Monthly Income was calculated
(showing the add-backs like Depreciation to build trust through transparency)." The pitch
embeds two ready-made build prompts ("Feed This Prompt to Your AI / Dev Team"); per the
instruction-source rule they were treated as content to adjudicate, not instructions to
execute. No founder direction arrived with the paste; the standing external-pitch protocol
applied.

## 1. Facts: the "core IP" the pitch says to build first already ships here

Every row verified in code this session, not from memory:

| Pitch claim | Repo reality |
|---|---|
| "Build the automated SAM parsing engine for uploaded PDFs" (MVP step 1, "the core intellectual property") | **Shipped.** Two-pass tax-package intelligence behind the single Anthropic adapter (`server/extractionCore.ts` — `claude-sonnet-5` single-doc, `claude-opus-4-8` package; `server/extractionTaxIntel.ts` classify → per-instance fields), 15 IRS form types (`shared/taxFormExtraction.ts`), Zod clamps + cross-field consistency checks + confidence caps (`server/extractionValidation.ts`), SHA-256 response lineage + AES-256-GCM-encrypted raw responses. Deterministic `EXTRACTION_SIMULATE` lane (tax paths). |
| "Google Cloud Document AI … handles complex tabular data (K-1s, Schedule C line items) significantly better than free open-source tools like Tesseract" | **Wrong comparison for this repo.** We are not on Tesseract; extraction is a live, hardened Anthropic integration. A second OCR vendor was **rejected by name** on 2026-07-17 (underwriter-splitscreen memo §4.2: no Textract, no "Document AI"). |
| SAM formula: `Net Profit + Depreciation + Home Office` | **Shipped richer — and the pitched formula is non-conservative.** `server/services/selfEmploymentIncome.ts` (`scheduleCAnnual`) adds back depreciation + depletion + amortization/casualty + business-use-of-home and **subtracts** meals exclusion + non-recurring income (B3-3.6-03); `averageTwoYears` enforces the loss/declining doctrine (B3-3.5-01: losses always count, declines never average up). The pitch's formula omits the subtractions and all loss handling ⇒ it **overstates** qualifying income. |
| (implied) partnership/S-corp support via "Form 1084 formulas" | **Shipped.** K-1 lanes with the distributions-or-liquidity gate, entity add-backs × ownership share (skip-and-flag when ownership % missing, never guessed), owner W-2 counted direct (B3-3.6-07, B3-3.7-01/-02); tie-outs in `server/services/taxReconciliation.ts`; drafts via `worksheetPrefill.ts` are never persisted — borrower confirms field-by-field before the calculator runs (MR-2). |
| "Non-QM router … matrix of wholesale Non-QM guidelines (Bank Statement, Asset Depletion)" | **Calculators shipped; the matrix is what the governing plan quarantines.** `income/paths/dscr.ts` + `bankStatement.ts` compute from the only cited program in-repo (`docs/lender-programs/angel-oak/` — the sole investor directory) and return `requiresManualReview` unconditionally; thresholds/matrices stay out of code until each investor's citable doc lands (NON_W2_TECH_OPTIMIZATION_PLAN Appendix A, Phase 0). `asset_depletion` is a product-type enum only — the Phase-2 §4.2 engine skeleton is specified, unbuilt. |
| "react-dropzone … sleek, animated file upload area" + processing skeleton (MVP step 3) | **Shipped (hand-rolled, no dropzone dep).** `DocumentDropzone` + `UploadProgressCard` (#212), personalized checklist (#213), borrower Documents page refactor (#308), staff doc-review workbench `DocumentReviewPanel` (#211). |
| "Upon receiving the response … a visually appealing summary card that breaks down how their Qualifying Monthly Income was calculated" | **Bindingly rejected 2026-08-04** (rate-com memo §2 C2 / §6.1): no live qualifying figures to borrowers before human verification (Reg N §1014.3(q), MR-2). The compliant version — post-decision breakdown with add-back totals and citations — is already adopted as Borrower Clarity **PR 7** (C1 + educational pre-decision). The capture-side transparency the pitch wants exists today: `SelfEmploymentIncomeWorksheet.tsx` labels each add-back/subtraction, never a computed figure. |
| Cloudflare R2 "zero egress" + Workers gateway | **Storage is live GCS behind one barrel** (`server/integrations/object_storage/`: signed URLs, per-object ACLs, claim-time content verification, §9-listed area); the app is **one Vercel serverless function** (modular memo §2 facts). No egress-cost line item exists at current volume; there is no abstract storage interface — a swap would first require extracting one. |
| Direct IRS IVES A2A ("the $4.00 transcript") | **The one genuinely new element — zero repo footprint.** Repo-wide grep: no `4506` outside a vendor MISMO XSD, no `IVES`, no `Taxpayer First`, no transcript document type in `DOCUMENT_TYPE_TAXONOMY`. Verified real on irs.gov 2026-08-04 ([program](https://www.irs.gov/individuals/international-taxpayers/income-verification-express-service) / [participants](https://www.irs.gov/individuals/income-verification-express-service-for-participants)): "$4 fee … for each transcript," Taxpayer First Act A2A API for bulk requests (participant test environment open), WebUI near-real-time singles, SOR delivery, participation via e-Services enrollment. The adopted non-W2 plan §5.5 already names "IRS forms/transcripts" as the documented VOIE fallback evidence chain — this is the attachment point. |

**PM note:** this is the fourth consecutive external pitch whose centerpiece is a rebuild of
the shipped income engine (see rate-com memo §1's identical table). The moat is not the
parser; it is the citation discipline, the provenance gating, and the human-verification
throttle the pitch calls friction.

## 2. Point-by-point verdicts

| Recommendation | Verdict | Why (evidence) | Reopen gate |
|---|---|---|---|
| Cloudflare R2 + Workers replatform | ❌ **Rejected** | Live GCS behind the object_storage barrel (signed URLs, ACL policy, §9-listed); one Vercel function with `maxDuration: 30` (modular memo §2); zero egress-cost consumer; #206 §4.5 storage contract (object keys + ACL checks remain the contract). A swap is seam-extraction work with no payer. | A real egress/storage cost line item at volume, or a forced vendor move — then an extracted storage interface + §9 review, never a replatform. |
| Direct IRS IVES A2A transcript access | ✅ **Adopt as roadmap F12 — admin-first, code-gated** | Verified real on irs.gov (2026-08-04): $4/transcript, TFA A2A API + test environment, SOR delivery. Genuine greenfield (zero footprint). Attaches to the adopted plan's §5.5 fallback evidence chain, where payroll-network VOIE "nearly never" covers 1099/Sch C/Sch E profiles; an IRS transcript is a decision-grade provenance source for the asymmetric income gates (positives need decision-grade provenance; losses always count). | **Code lands only after** (1) founder completes IVES enrollment (e-Services; verify current steps/forms on the participants page at filing time — the pitch's "Form 13803" was not confirmed on the current pages) AND (2) counsel clears the 4506-C consent flow + federal-tax-information handling (§5). Then: deterministic simulated adapter per the `server/mcp/vendors.ts` pattern (golden rule 3 — throws if a key is set while unimplemented), consuming into `taxReconciliation`, citable process doc under `docs/`, §9 review as a new PII sub-processor, F-flag row in briefing §10. |
| Google Document AI Form Parser | ❌ **Rejected (pre-adjudicated)** | #206 §4.2, verbatim: "No second OCR vendor or extraction microservice (Textract, 'Document AI')." Extraction stays behind the single Anthropic M-1 adapter, already hardened (Zod clamps, confidence caps, encrypted raw lineage). Reg B AI-isolation keeps extraction out of decisioning regardless of vendor. | None — doctrine. (Coordinate-grade OCR, if ever needed, lands as the dormant `document_pages` pipeline's engine per #206's parked register — not a parallel path.) |
| Python FastAPI parsing microservice, "hosted on Replit" | ❌ **Rejected** | #192 §4.4: no new stacks/frameworks for capability the TS monorepo already ships. Borrower tax PII on a rapid-deploy prototyping host fails the PII discipline and the §9 posture outright; the deployment model is one Vercel function, not a service mesh (#252). | None — doctrine. |
| SAM engine as pitched (`Net Profit + Depreciation + Home Office`) | ❌ **Rejected — shipped richer; pitched formula is income-inflating** | §1 row 3: the shipped calculator subtracts meals exclusion + non-recurring income and enforces the loss/declining doctrine with Selling Guide citations in every result; the pitch's formula omits both ⇒ overstates income, the non-conservative direction. Real remaining gaps (asset-depletion engine, deposit scrubbing, 1120-S/8825 tie-out completion) follow the adopted #238 sequencing, not this pitch. | None. The gaps' gate is #238 Phase 2 + Phase 0 citable artifacts. |
| Non-QM auto-router across "a matrix of wholesale guidelines" | ❌ **Rejected under standing quarantine** | #238 Appendix A (external program numbers are targets, not rules, until citable docs land in `docs/lender-programs/`); B5 multi-lender-fit deferral (2026-07-12 log); rate-com memo re-affirmed both 2026-08-04. "Automatically … find a qualifying path" also collides with the honest-`requiresManualReview` doctrine and the lender-decides rail (Reg N): the platform pre-flights, the lender decides. | Per investor: verbatim program doc in `docs/lender-programs/<investor>/` + regulatory-ledger entry (same commit) + a signed broker agreement. |
| Instant borrower "Qualifying Monthly Income" card on upload | ❌ **Rejected — binding (pre-adjudicated 2026-08-04)** | Rate-com memo §2 C2 / §6.1: "No live qualifying figures to borrowers before human verification" — Reg N §1014.3(q), MR-2 (extraction → borrower field-by-field confirmation → calculator). | None. The compliant remainder is Borrower Clarity PR 7 (post-decision C1 + educational pre-decision) — already adopted; cite, don't duplicate. |
| `react-dropzone` upload zone + skeleton states (MVP step 3) | ❌ **Rejected — shipped** | #212 `DocumentDropzone`/`UploadProgressCard` (hand-rolled, byte-level progress + cancel), #213 checklist, #211 workbench, #308 Documents page. Adopting the pitch's build prompt would duplicate a completed program. | — |

## 3. Defects and stale docs found during verification

None introduced by the pitch; all actioned regardless of its verdicts:

1. **Borrower-reachable legacy engine-calculation routes** — `server/routes/underwriting/calculations.ts`
   registers six endpoints (`calculate-income`, `-assets`, `-liabilities`, `-dti`,
   `check-property-eligibility`, `calculate-pricing`) behind bare `isAuthenticated` + an
   owner-passing access check. `calculate-income` returns qualifying-income figures computed
   over unverified self-stated data — the exact class §2's C2-binding rejection bars — and
   `calculate-pricing` returns LLPA-adjusted pricing. Zero client callers (the file's own
   newer instant-decision comment shows the staff-only discipline arrived later);
   `tests/pricingUnderwriting.test.ts` exercises them as `buyer@test.com`. Same class as the
   rate-com memo §3.3 (fixed there for lender-match routes). → **Fixed in this program's
   hardening leg**: staff-gated at the deal-team boundary, test reworked to staff fixtures +
   borrower-403 assertions.
2. **`documents.notes` extraction-summary overload** — `server/routes/documents.ts:332` still
   JSON-blobs the extraction summary (field names, confidence, warnings, lineage ids) into
   the free-text `notes` column even though dedicated typed/encrypted columns exist
   (`extractionResponseHash`, `extractionRawEncrypted`/`Iv`/`KeyId`). Known shape — #206's A6
   review note already named "de-overload notes" as the root fix — but unregistered in
   FINDINGS.md and unfixed. → Registered as a follow-up; **not** fixed here (touches
   extraction persistence; wants its own §9-reviewed pass).
3. **Research-briefing staleness** (`NON_W2_LENDING_RESEARCH_BRIEFING.md`, dated 2026-07-17 —
   goes stale by design; four claims now materially wrong): `:221` "EXTRACTION_SIMULATE …
   covers all four single-doc extractors" (actually **tax-only**: `extractionDocuments.ts:116`
   + `extractionTaxIntel.ts:460/:520`; pay-stub/bank/lease return low-confidence without a
   key); `:151`/`:553` "rental hard-codes `appliedToDti: false`" (dynamic + provenance-gated
   since #241); `:283–284` S-05/S-06 "advisory only" (applied since #241); `:287`/`:566` S-07
   deferred (shipped #246, catalog + sync tests #315). → **Supersession banner added to the
   briefing in this PR** (TEAM_PRACTICES §2: snapshots are never rewritten).
4. **TEAM_PRACTICES §9 has no sub-processor trigger** — the binding trigger list is
   file/area-scoped; "a new external service starts receiving borrower PII" is not on it,
   despite being the recurring proposal of every external pitch in this series (Textract,
   Document AI, R2, Replit hosting, IVES). → **New §9 bullet added in this PR** (§4.3).

## 4. Adopted (converge-don't-duplicate)

1. **F12 — IRS IVES transcript access (4506-C → A2A)**, added to CTO_ROADMAP `## Future`:
   founder enrollment + counsel sign-off first; then a deterministic simulated adapter in
   `server/mcp/vendors.ts` feeding `taxReconciliation` as a decision-grade provenance source
   (non-W2 plan §5.5 fallback chain). No schema, no code, no env var until the gate fires
   (no-speculative-schema; golden rule 3).
2. **Hardening leg (code PR):** staff-gate the six `calculations.ts` endpoints at the
   deal-team boundary (§3.1), mirroring the rate-com §3.3 fix; §9 review before merge
   (role-gate trigger).
3. **Governance (this PR):** the §9 **New PII sub-processor** trigger (§3.4), so the next
   pitch's storage/OCR/verification vendor proposal has a named, binding review path;
   vendor-diligence notes land in `governance/security/` per the Plaid-clearance pattern.

Explicitly **not** adopted: any borrower income-transparency UI (Borrower Clarity PR 7 owns
it), any Non-QM matrix rules, any storage or OCR vendor change, any second service/stack.

## 5. Founder / counsel items

1. **IVES enrollment decision (founder):** whether to initiate IRS e-Services registration +
   the IVES participant application now. Federal enrollment/vetting lead time argues for
   starting early if transcript-direct verification should exist by the time volume does;
   cost is $4/transcript at the margin. Verify the current enrollment steps and forms on the
   IVES participants page at filing time — do not rely on the pitch's step list (its
   "Form 13803" was not confirmed on the current IRS pages).
2. **Counsel, before any transcript pull:** where the signed 4506-C consent sits in the
   borrower flow and how it composes with the existing consumer-direct-upload posture (the
   §7216 boundary was engineered around uploads; transcripts arrive from the IRS under
   taxpayer authorization — a different consent lane that needs its own characterization);
   IVES participant data-safeguarding obligations; GLBA/FCRA treatment of transcript data;
   and, once F6 (DU) is real, interaction with DU validation-service report-supplier rules.
3. **Standing reminder (one line, no new flag):** the founder 2FA/security checklist remains
   the open urgent item that every new-vendor conversation presupposes.

## 6. Binding restatements

- **New:** any PR that introduces or activates an external processor receiving borrower PII
  runs the §9 review + lands a vendor-diligence note in `governance/security/` (the §9
  trigger added by this adjudication, §3.4/§4.3).
- Re-affirmed unchanged under adversarial pressure from this pitch: **no second OCR vendor or
  extraction microservice** (#206 §4.2); **no new stacks/services for shipped capability**
  (#192 §4.4); **no live qualifying figures to borrowers before human verification**
  (rate-com §6.1); the **Appendix-A quarantine** (#238) with Phase-0 as the only graduation
  path; **golden rule 3** (deterministic simulations behind adapters until real contracts —
  and a set key without an implemented adapter throws); **no speculative schema** (#252).
