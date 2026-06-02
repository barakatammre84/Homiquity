---
name: MISMO co-applicant data model
description: How borrower vs co-applicant URLA data is shaped and scored
---
URLA tables (urla_personal_info, employment_history, urla_assets,
urla_liabilities, borrower_declarations) are effectively single-row-per-
application and were NOT originally per-borrower. A `borrower_sequence_number`
column (default 1 = primary, 2+ = co-applicants) is the minimal discriminator
added to enable co-applicant scoring; `urla_personal_info` also has
`is_primary_borrower`.

**Why:** Scoring co-applicants independently required a per-borrower key without
restructuring the whole URLA schema.

**How to apply:** The validator scores sequence 1 into the main `sections` (keeps
existing consumers stable) and sequences >1 into `coApplicants[]`. When an app
indicates a co-borrower but no seq>1 rows exist, surface `coApplicantLimitation`
rather than silently scoring nothing. Existing upsert helpers still write the single
primary row; the new read accessors are read-only.

**hmda_demographics discriminator:** every demographics row (primary AND co) is
written with `borrowerId = application.userId` — borrowerId is NOT a per-person key.
`borrowerSequenceNumber` is the ONLY valid discriminator between borrowers. Always
match a co-applicant's demographics by `borrowerSequenceNumber === seq` (e.g.
`coHmda.find(...)`), never by array position — sequence numbers can be sparse or
out of order (only a co-borrower #3, rows in any order).
