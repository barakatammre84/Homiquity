# NMLS licensing reference documents

Authoritative reference material for all NMLS licensing work — company/branch/individual
licensure, MLO sponsorship, Mortgage Call Reports, surety bonds, and Temporary Authority.
This is the source of truth for the founder licensing critical path (NMLS company license)
and for any product feature that describes, tracks, or automates licensing state.

Do not answer NMLS policy questions from memory. Verify against the guidebook below (use
the page map to find the right chapter) or the NMLS Resource Center.

## Document hierarchy

1. **State statutes, rules, regulations, and direct regulator guidance control.** The
   guidebook is explicitly "FOR GUIDANCE ONLY" and does not supersede state law or
   state-specific licensing requirements. When the guidebook and a state requirement
   disagree, the state controls — escalate discrepancies rather than picking a side.
2. **NMLS Policy Guidebook** — system-of-record policy for how NMLS itself works (forms,
   filings, statuses, workflows).
3. **NMLS Resource Center** (online, current): <https://mortgage.nationwidelicensingsystem.org/>
   — state-specific checklists, form instructions, and updates published after this edition.

## Local inventory

- `NMLS Policy Guidebook for Licensees 2026.03.31.pdf` — NMLS Policy Guidebook,
  **updated March 31, 2026 edition**, 201 pages. Chapter map (PDF page numbers):

| Pages | Contents |
|---|---|
| 7–17 | Introduction; Chapter I — accounts, record creation, One Record rule, Consumer Access |
| 18–51 | Chapter II — **Company Form (MU1)**: business activities, license requests, identifying info, trade names, direct/indirect owners, control persons, qualifying individuals, disclosure questions, Advance Change Notice (ACN), attestation |
| 52–70 | Chapter III — **Individual Form (MU2)**: control-person disclosures, criminal background check, credit report |
| 71–88 | Chapter IV — **Branch Form (MU3)**: branch licensing, branch manager, books and records |
| 89–111 | Chapter V — **Individual License Form (MU4)**: MLO licensing, company relationships, work-remote status, sponsorship |
| 112–119 | Chapter VI — **Temporary Authority to Operate**: eligibility, TA period, loss of TA and effect on originated loans |
| 120–125 | Chapter VII — Financial Statement & Net Worth filing |
| 126–135 | Chapter VIII — **Call Reports**: Mortgage Call Report (MCR) — Financial Condition + RMLA components; MSB call report; UAAR |
| 136–142 | Chapter IX — Electronic Surety Bond (ESB) |
| 143–145 | Chapter X — Professional requirements: SAFE MLO test, license status definitions |
| 146–201 | Glossary; Appendices 1–7 |

## Why this matters to Homiquity

- **Founder critical path:** the company must obtain its NMLS company license (MU1) and
  sponsor MLO licenses (MU4) before taking applications as a licensed broker. Chapters
  II, V, and VI govern that path end-to-end.
- **Ongoing obligations once licensed:** quarterly Mortgage Call Report (Ch. VIII),
  financial statement filing (Ch. VII), surety bond maintenance (Ch. IX), and Advance
  Change Notice for company changes (Ch. II) — candidates for ops tooling later.
- **Product copy and compliance gates** that reference licensing status, NMLS IDs, or
  Consumer Access must match the definitions in this guidebook (e.g. license status
  definitions, Ch. X; Consumer Access publication rules, Ch. I).

No code implements this document yet — it is a policy/ops reference. If licensing-state
tracking is ever built into the product, record the mapping here (mirroring
`docs/fannie-mae/README.md`).

## Maintenance

Keep the original NMLS filename with the edition date so versions stay traceable. The
guidebook is a living document updated by NMLS regularly — when a new edition is
published, replace the file, update this inventory, and note the edition date in the
commit message.

Reading the PDF locally: page rendering tools (poppler) are not installed; extract text
with `python3` + `pypdf`, which is available.
