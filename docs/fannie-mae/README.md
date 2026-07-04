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

## Local inventory

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

### Other
- `Wire Instruction Reference ID_final_05202025.pdf`

## Maintenance

Keep original Fannie Mae filenames so versions/effective dates stay traceable. When Fannie Mae
publishes an updated edition (e.g. a new ULDD appendix version), replace the file, update this
inventory, and note the effective date in the commit message.
