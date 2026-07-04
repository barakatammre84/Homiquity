# Fannie Mae loan delivery reference documents

Authoritative reference material for all ULDD / UCD / URLA / MISMO work in this repo.
Per [CLAUDE.md](../../CLAUDE.md), any change touching Fannie Mae loan delivery must be
verified against these documents and the official Loan Delivery job aid — MISMO field
names, enumerations, edit codes, and Special Feature Codes are never invented.

## Online source of truth

- **Loan Delivery job aid** (searchable, current terminology, edit codes, data points):
  <https://singlefamily.fanniemae.com/job-aid/loan-delivery>
- **Hierarchy:** the Fannie Mae *Selling Guide* and *Servicing Guide* are the official policy
  statements. If a job aid or any file in this directory disagrees with the Guides, the Guides
  control. Escalate discrepancies rather than picking a side.

## Expected local inventory

Copy the reference files (currently held in the claude.ai project knowledge) into this
directory so Claude Code can read them while implementing:

- **ULDD Phase 5 specification** — Appendix D / ULDD data point spreadsheets (XLSX)
- **UCD (Uniform Closing Dataset) job aids** (PDF)
- **URLA / Form 1003 documents** — rendering document, field mapping (PDF)
- **Special Feature Codes list** (PDF/XLSX)

Keep original Fannie Mae filenames where possible so versions/effective dates stay traceable.
When Fannie Mae publishes an updated edition (e.g. a new ULDD appendix version), replace the
file and note the effective date in the commit message.

> Status: directory scaffolded 2026-07-04; reference files not yet copied in.
