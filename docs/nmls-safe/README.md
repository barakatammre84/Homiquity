# NMLS / SAFE Act licensing references

Authoritative reference material for MLO licensing and originator-conduct compliance.
Added 2026-07-04 alongside the founder's NMLS licensing work (roadmap F1). Same rule as
[docs/fannie-mae/](../fannie-mae/README.md): verify against these documents, never from
memory; statutes/regulations control over any summary here.

## Local inventory

- `SAFENationalTestOutline.pdf` — the official SAFE MLO National Test content outline
  (125 items: Federal Mortgage-related Laws 23%, General Mortgage Knowledge 23%,
  Origination Activities 25%, Ethics 16%, Uniform State Content 13%), including the
  full reference list of statutes/regulations the test draws from (pp. 16–17).

The **NMLS Policy Guidebook for Licensees (2026-03-31)** — licensure records,
sponsorship, renewal, unique-identifier and disclosure obligations — lives at
[docs/nmls/](../nmls/) (vendored separately with a chapter map; PR #47).

## Why these live in the repo

1. **Platform compliance checklist** — the SAFE outline's federal-law section is a
   de-facto enumeration of every consumer-protection regime a mortgage platform must
   respect. The honest map of outline topic → what Homiquity implements (or deliberately
   defers) is maintained at [kb/SAFE_MLO_COMPLIANCE_MAP.md](../../kb/SAFE_MLO_COMPLIANCE_MAP.md).
2. **Founder licensing prep** — the test outline + guidebook are the primary study/process
   references for F1 (company + MLO licensing), which the founder is handling personally.
3. **Reg H / unique-identifier plumbing** — the Uniform State Content section codifies the
   requirement to display the NMLS unique identifier on websites, advertisements, and loan
   documents. The engineering plumbing for that is ticketed in CTO_ROADMAP.md (#33) so it
   lights up the day F1 clears.

## Maintenance

Keep original filenames/editions traceable. When NMLS publishes a new guidebook edition or
test outline, replace the file, update this inventory, and re-verify the crosswalk claims
in kb/SAFE_MLO_COMPLIANCE_MAP.md.
