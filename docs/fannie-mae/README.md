# Fannie Mae loan delivery reference documents

Authoritative reference material for all ULDD / UCD / URLA / MISMO work in this repo.
Per [CLAUDE.md](../../CLAUDE.md), any change touching Fannie Mae loan delivery must be
verified against these documents and the official Loan Delivery job aid — MISMO field
names, enumerations, edit codes, and Special Feature Codes are never invented.

## Source of truth

- **Selling Guide, edition 08-05-2026 — LOCAL, and the top of the hierarchy.**
  `selling-guide/Selling-Guide_08-05-2026.pdf`, with a greppable text extraction and a
  section index beside it. See [`selling-guide/`](selling-guide/) for how to query it.
  Conformance findings live in
  [knowledge-base/compliance/SELLING_GUIDE_CONFORMANCE.md](../../knowledge-base/compliance/SELLING_GUIDE_CONFORMANCE.md).
- **Loan Delivery job aid** (searchable, current terminology, edit codes, data points):
  <https://singlefamily.fanniemae.com/job-aid/loan-delivery> — **returns 403 from this
  environment**; it is not a path you can execute in-session. Use the local Selling Guide and
  the job-aid PDFs below instead, and say so rather than answering from memory.
- **Hierarchy:** the Fannie Mae *Selling Guide* and *Servicing Guide* are the official policy
  statements. If a job aid or any file in this directory disagrees with the Guides, the Guides
  control. Escalate discrepancies rather than picking a side. The Selling Guide half of that
  rule is now checkable locally; the *Servicing* Guide is still absent.

## Local inventory

### Selling Guide (`selling-guide/`, added 2026-08-20)

- `Selling-Guide_08-05-2026.pdf` — the full Guide, 1,185 pages, as published 08-05-2026.
  The source PDF carries 175 highlight annotations; in this edition they mark the sections
  **revised in that release**.
- `selling-guide-text.txt` — full text, every page prefixed `[[PAGE n | <section>]]` so a
  plain `grep -n` identifies the governing section. No tooling needed to read it.
  ⚠️ Use `grep -F` for phrases containing `$` — BSD grep reads it as an anchor and reports
  zero matches on text that is verbatim present. Lines wrap mid-sentence; grep a fragment.
- `section-index.tsv` — all 554 TOC entries mapped to PDF page.
- `highlights.json` — the annotations, extracted.

Regenerate all three after replacing the PDF: `python3 scripts/extract-selling-guide.py`.

### ULDD (Uniform Loan Delivery Dataset)
- `uldd-implementation-guide.pdf` — ULDD implementation guide
- `ULDD Phase 5 (5.2.0) Specification Release Notes 05-26-26.pdf`
- `ULDD Phase 5 Implementation Considerations.pdf`
- `ULDD Phase 5 Resources - April 2025 update.pdf`

### Loan Delivery edits & Special Feature Codes
- `Fannie Mae Connect Job Aid - Loan Delivery Edit Dashboard.pdf`
- `Loan Delivery Qualified Mortgage (QM) Edits Job Aid 2026 Update.pdf`
- `Special Feature Codes updated 05-06-26.pdf`

### UCD (Uniform Closing Dataset)
- `Numbered Closing Disclosure updated 06-30-2025.pdf` — CD with UCD field numbering
- `UCD Job Aid Taxes and Other Government Fees updated 09-06-23.pdf`
- `UCD Joint GSE Job Aid Guide Fees updated 09-06-23.pdf`
- `UCD Joint GSE Job Aid QM Short Reset ARM APR Percent_04112023.pdf`
- `UCD Phase 3 Critical Edits Job Aid - Escrows.pdf`
- `UCD Phase 3 Critical Edits Job Aid - Loan Discount Points and Lender Credits.pdf`
- `UCD Phase 3 Critical Edits Job Aid -Prepaids.pdf`
- `UCDPhase 4 Job Aid LPQIRP April 2026.pdf` — Phase 4 LPQIRP (April 2026)

### URLA / Form 1003
- `URLA_2020_Borrower_Numbered 04142020 Secured.pdf` — borrower form, numbered
- `URLA_2019_Addl_Borrower_v28.pdf` — additional borrower form
- `URLA_2020_Lender_Numbered 04142020 Secured.pdf` — lender loan information
- `URLA_2020_Unmarried_Numbered 04142020 Secured.pdf` — unmarried addendum
- `URLA Rendering Design Options updated 6-29-21.pdf` — rendering/design guidance

### EarlyCheck
- `EarlyCheck ULAD Edit Changes 06-30-20.xlsx` — EarlyCheck edit changes from the ULAD
  rollout; the "MISMO 3.4" tab lists edits applicable to MISMO 3.0/3.4 files
  (144/1700 mortgage funder name, 1209/1224 project valid values)

### Machine-validatable schemas & mappings (`schemas/`, added 2026-07-04)

These resolve the earlier gap note that "no ULDD XLSX appendices / schemas were available
locally" — they now are. They unlock **XSD validation of our MISMO 3.4 export** as a test
gate (see the roadmap ticket) instead of relying solely on the hand-built validator.

- `schemas/uldd-phase5-extension/` — official ULDD Phase 5 extension files (May 26 2026):
  `ULDD_Phase_5_Extension.xsd`, `ULDD_Phase_5_Extension_Visual.xlsx`, `MISMO_3_0.xsd`
  (base MISMO reference model the extension imports), `xlink.xsd`
- `schemas/ucd-v2/` — UCD v2.0 production schema (07/2025): `UCD.xsd`, `UCD_Wrapper.xsd`,
  `ReadMe for UCD Production Schema.pdf`
- `schemas/ucd-v2-samples/` — official UCD v2.0 sample XML files (Purchase/Refi ×
  Fixed/ARM) + `UCD v2.0 Use Case Matrix 09-29-25.xlsx` — golden files for conformance
  comparison
- `schemas/ulad-mapping-document.xlsx` — official ULAD mapping (URLA form fields →
  MISMO/ULDD data points) — the authority to audit `shared/mismo.ts` field mapping against
- `schemas/UCD v2.0 Critical_Edits_Matrix_v1.4 as of 4 2 2026.xlsx` — UCD critical edits
  matrix (v1.4, 2026-04-02)

### Self-employment income (Income Assessment, Chapter B3-3)
- `self-employment-income-reference.md` — verified capture of the current Selling Guide
  self-employment sections (**B3-3.5** Self-Employment Income + **B3-3.6** Self-Employment
  Documentation), including the 03/04/2026 Income-Assessment reorganization that moved SE income
  off the old "B3-3.2/B3-3.4" numbering. Grounds the deterministic SE income calculator
  (`server/services/selfEmploymentIncome.ts`). Records two artifacts still to be **downloaded
  manually** (Cloudflare blocks scripted fetch): **Form 1084 (Cash Flow Analysis)** and the
  business-return analysis subsections — see that file's "Missing artifacts" section.

### Rental income (Income Assessment, Chapter B3-3)
- `rental-income-reference.md` — verified capture of the current Selling Guide rental-income
  sections, including the 2026-07-17 renumbering check. Grounds the deterministic rental
  calculators (`server/services/underwritingNuance.ts`,
  `server/services/income/paths/rental.ts`) and their DTI application in
  `server/services/income/orchestrator.ts` / `server/services/decisionEngine.ts`.
  *(Present on disk since it was written; this inventory row was missing until 2026-08-06 — an
  uninventoried reference is one a future session will not know it can cite.)*

### Other
- `Wire Instruction Reference ID_final_05202025.pdf`

## Where these documents are implemented

| Document | Code |
|---|---|
| QM Edits Job Aid (2026) — threshold tables | `shared/fannieMae/qmThresholds.ts` |
| QM Edits Job Aid + UCD Phase 3/3a/4 job aids + EarlyCheck workbook — edits | `shared/fannieMae/loanDeliveryEdits.ts` |
| Guide Fees job aid appendix — fee/prepaid/escrow enumerations by CD section | `shared/fannieMae/ucdFeeEnumerations.ts` |
| Taxes & Other Government Fees job aid — recording fee / transfer tax edits | `shared/fannieMae/loanDeliveryEdits.ts` |
| Special Feature Codes (05-06-26) | `shared/fannieMae/specialFeatureCodes.ts` |
| ULDD Implementation Guide — delivery LOAN states (Table 5), no ASSET container (Table 4) | `server/mismo.ts` (`purpose: "loanDelivery"`) |
| Combined pre-delivery workflow | `server/services/loanDeliveryReadiness.ts` |
| Self-employment income (B3-3.5 / B3-3.6) — Schedule C add-backs, K-1 distributions/liquidity, 2-yr averaging | `server/services/selfEmploymentIncome.ts` _(planned)_, `server/underwriting.ts` (`qualifyIncome`) |

Reviewed with no code impact: the **Loan Delivery Edit Dashboard** job aid (Fannie Mae
Connect navigation), **ULDD Phase 5 Resources** (link index), **URLA Rendering Design
Options** (form-rendering guidance; URLA UI already built), the **Numbered Closing
Disclosure** (CD field-numbering reference), and the **Wire Instruction Reference
Identifier** job aid (SID 398.3 applies to standard MBS pools only — Homiquity delivers
whole loans today; revisit if MBS execution is added. Mismatched wire nicknames fire
fatal edit 2022 in Loan Delivery).

When Fannie Mae publishes new threshold years or SFC editions, update the data in those
modules from the replacement document — never from memory — and update the pinned values
in `tests/qmThresholds.test.ts` / `tests/specialFeatureCodes.test.ts` in the same commit.

## Reading these files (humans and Claude sessions)

Every file in this directory is readable locally — nothing requires an external service:

- **PDF** — Claude's Read tool renders them directly; scripted extraction uses `pypdf`
  (installed `--user` on this machine; `pymupdf` for page rendering).
- **XLSX** (the ULAD mapping workbook, UCD matrices, ULDD Phase 5 visual) — not readable
  raw; use `openpyxl` (installed `--user`):
  ```bash
  python3 -c "import openpyxl; wb = openpyxl.load_workbook('docs/fannie-mae/schemas/ulad-mapping-document.xlsx', read_only=True); print(wb.sheetnames)"
  ```
- **XSD / XML** — plain text; open directly. `MISMO_3_0.xsd` is 1.9 MB — read it in slices
  or grep for the element you need rather than loading it whole.
- **Filenames contain spaces** (official Fannie Mae names, kept deliberately — see
  Maintenance below): always quote paths in shell commands.

## Maintenance

Keep original Fannie Mae filenames so versions/effective dates stay traceable. When Fannie Mae
publishes an updated edition (e.g. a new ULDD appendix version), replace the file, update this
inventory, and note the effective date in the commit message.
