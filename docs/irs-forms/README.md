# IRS Form References — Tax Document Intelligence authority

Source PDFs downloaded from the IRS's official form library
(`https://www.irs.gov/pub/irs-pdf/<file>.pdf`), current revision as of the
download date (2026-07-11). These are the **authority documents** for the
Situation Identification Engine (UAL program P2b): the extraction field
catalog (`shared/taxFormExtraction.ts`) and the cross-form tie-out engine
(`server/services/taxReconciliation.ts`) may only reference form structure
that can be verified in these files.

**The contract (mirrors `docs/fannie-mae/`):**

1. **Never invent line numbers or carry relationships.** Every line-level
   citation in code or prompts is transcribed from these PDFs. If a form or
   line you need is not verifiable here, stop and flag it — do not proceed
   from memory (L2 I2: no citation, no implementation).
2. **Revisions drift.** The IRS re-issues forms annually; line numbers can
   move (the extraction catalog therefore keys on printed **label text**, not
   line numbers). When a new revision lands, re-download, re-verify the carry
   map below, and update this README in the same commit as any code change
   that depends on it.
3. **Instructions not yet in-repo.** Only the forms themselves are here; the
   per-form IRS *instructions* (i1040sc etc.) are not. A check that needs
   instruction-level semantics (e.g., what belongs in "other expenses") is
   blocked until its instruction PDF is added.

## Inventory

| File | Form |
|---|---|
| `f1040.pdf` | Form 1040 — U.S. Individual Income Tax Return |
| `f1040s1.pdf` | Schedule 1 (Form 1040) — Additional Income and Adjustments |
| `f1040sb.pdf` | Schedule B — Interest and Ordinary Dividends |
| `f1040sc.pdf` | Schedule C — Profit or Loss From Business |
| `f1040sd.pdf` | Schedule D — Capital Gains and Losses |
| `f1040se.pdf` | Schedule E — Supplemental Income and Loss |
| `f1065.pdf` | Form 1065 — U.S. Return of Partnership Income |
| `f1065sk1.pdf` | Schedule K-1 (Form 1065) — Partner's Share |
| `f1120s.pdf` | Form 1120-S — S Corporation Income Tax Return |
| `f1120ssk.pdf` | Schedule K-1 (Form 1120-S) — Shareholder's Share |
| `f1120.pdf` | Form 1120 — U.S. Corporation Income Tax Return |
| `f8825.pdf` | Form 8825 — Rental Real Estate of a Partnership/S Corp |
| `f4562.pdf` | Form 4562 — Depreciation and Amortization |

## Verified carry map (transcribed 2026-07-11 from the PDFs above)

The tie-out engine's cross-form checks are keyed to these printed
relationships. Each row was transcribed from the named form — verify against
the PDF before changing a check.

| # | Relationship | Transcribed from |
|---|---|---|
| C1 | Schedule C line 31 "Net profit or (loss)" → "enter on both Schedule 1 (Form 1040), line 3" | `f1040sc.pdf` p.1 |
| C2 | Schedule 1 line 3 "Business income or (loss). Attach Schedule C" | `f1040s1.pdf` p.1 |
| C3 | Schedule 1 line 5 "Rental real estate, royalties, partnerships, S corporations, trusts, etc. Attach Schedule E" | `f1040s1.pdf` p.1 |
| C4 | Schedule E line 26 "Total rental real estate and royalty income or (loss). Combine lines 24 and 25" (Part I total) | `f1040se.pdf` p.1 |
| C5 | Schedule E line 41 "Total income or (loss). Combine lines 26, 32, 37, 39, and 40" → carried to Schedule 1 (line 5). **Caveat:** line 41 combines Parts I–V; the extractor captures Part I (line 26) and Part II (line 32) only, so a Part I + Part II comparison against Schedule 1 line 5 can legitimately differ when royalties/estates/REMIC amounts exist. | `f1040se.pdf` p.2 |
| C6 | Schedule 1 line 10 "Combine lines 1 through 7 and 9. This is your additional income. Enter here and on Form 1040, line 8" | `f1040s1.pdf` p.1 |
| C7 | Form 1040 line 8 "Additional income from Schedule 1, line 10" | `f1040.pdf` p.1 |
| C8 | Form 1040 line 9 "Add lines 1z, 2b, 3b, 4b, 5b, 6b, 7a, and 8. This is your total income". **Caveat:** includes IRA/pension/Social Security components (4b, 5b, 6b) the extractor does not capture — captured components may legitimately sum to less than line 9, never more. | `f1040.pdf` p.1 |
| C9 | Form 1065 line 23 "Ordinary business income (loss). Subtract line 22 from line 8" (line 8 = total income, line 22 = total deductions); line 10 "Guaranteed payments to partners" | `f1065.pdf` p.1 |
| C10 | Schedule K-1 (1065) box 1 "Ordinary business income (loss)"; boxes 4a/4b/4c guaranteed payments ("4c Total guaranteed payments"); box 19 "Distributions" | `f1065sk1.pdf` p.1 |

Not yet transcribed (add a row before writing a check that needs them):
1120-S ↔ K-1 (1120-S) box map, Form 8825 ↔ 1065/1120-S rental carry,
Schedule B/D carries, Form 4562 ↔ Schedule C depreciation split.
