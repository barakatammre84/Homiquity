# Midday Lender Liquidity — 2026-07-04

**STATUS: OK** — F1 (NMLS licensing) still PENDING as expected, so this block stays in
preparation mode; all three prep lanes (Target-5, scenario translation, MISMO gate) advanced
cleanly with no uncited rules, no broken validation, and nothing aging past 48h.

## Human actions (founder)

⛔ = gated on F1 (NMLS licensing, currently PENDING in `server/config/company.ts`) — do not act
on these until licensing clears.

**Target-5 desk research gaps** (new file: [kb/my-research/wholesale-lender-shortlist-2026-07-04.md](../../research/my-research/wholesale-lender-shortlist-2026-07-04.md)):
- [ ] Manually read Plaza Home Mortgage's [Wholesale Broker Guide PDF](https://www.plazahomemortgage.com/documents/becomeanapproved/wholesale-broker-guide.pdf) — automated fetch couldn't parse its stream encoding; it's the most detailed public doc of the five and likely has the actual net-worth/bond/FHA-rider numbers.
- [ ] Confirm whether UWM (BOLT) and Rocket Pro TPO pricing is consumable by a Lender Price/Mortech PPE feed or is portal-only — affects F11 PPE middleware scope.
- [ ] Angel Oak and Newrez have no public approval-checklist detail; automated search hit a wall on both. Lowest priority unless non-QM becomes a near-term product goal.
- ⛔ Do not email any of the five lenders — application/AE contact is founder-only, post-F1.

**Scenario translation:**
- [ ] No founder action needed this run — no new lender quirks appeared in `kb/UNDERWRITING_SCENARIOS.md` in the last 24h; S-07 (next in backlog) already has a full citation and is correctly waiting for engineering (needs a new intake field, so it's not a same-day auto-implement).

**MISMO gate:**
- [ ] No founder action needed — validator and generator both pass; XML is saved to scratchpad and ready to attach to the first real submission once credentials exist.

## Summary

F1 (NMLS licensing) is still `"PENDING"` in `server/config/company.ts` — no change since the last
check, so lender liquidity work stays in the preparation phase, which is legitimate daily progress
rather than idle waiting. The Target-5 wholesale-lender shortlist didn't exist in `kb/my-research/`
before this run, so I built it from scratch (UWM, Rocket Pro TPO, Plaza Home Mortgage, Angel Oak
Mortgage Solutions, Newrez Wholesale) with cited public sources for what we know and explicit
gaps for what's missing — Plaza has the deepest public documentation, Angel Oak and Newrez the
thinnest. Scenario translation found no new lender-specific quirks added to
`kb/UNDERWRITING_SCENARIOS.md` in the last day (only a same-day sha-reference correction after a
rebase); S-07 is next in the backlog but requires a new intake field, so it correctly stays in
the spec for the guardian loop rather than being auto-implemented today. The MISMO export/validation
gate is healthy: `generateMISMO34XML` + `validateULDDCompliance` ran clean on a dummy borrower
profile (0 errors, 1 expected warning for the still-unconfigured MERS Org ID), and all 105 tests
across the three standing acceptance-gate files pass.

## Checks run → results → evidence

**1. F1 gate check**
- `grep -n -i "nmls\|licens" server/config/company.ts` → `nmlsId: "PENDING"` ([server/config/company.ts:4](../../../server/config/company.ts)). Unchanged from prior runs — no correction needed.

**2. Target-5 pipeline**
- `ls kb/my-research/` before this run: only `README.md`, a `.docx`, and a screenshots folder — no lender shortlist existed. Created [kb/my-research/wholesale-lender-shortlist-2026-07-04.md](../../research/my-research/wholesale-lender-shortlist-2026-07-04.md) covering 5 lenders with per-lender "what we have / what's missing" and a founder checklist. Desk research only (WebSearch/WebFetch against public lender sites and trade press) — zero outbound contact.

**3. Scenario translation**
- `git log -p --since="1 day ago" -- kb/UNDERWRITING_SCENARIOS.md` → one commit (`4c1f0bb`, "fix S-06 commit reference after rebase") — a housekeeping sha correction, not a new quirk. No unprocessed lender-specific rule found.
- Confirmed S-06 (multi-unit subject property rental income) is fully implemented per the registry, and S-07 (rental income conversion) is next in the backlog, already cited (Fannie Mae Selling Guide B3-3.1-08) — but its own spec notes intake doesn't yet collect the property-disposition field it needs ([kb/UNDERWRITING_SCENARIOS.md:132](../../compliance/UNDERWRITING_SCENARIOS.md)), so it's a schema+UI change, not a same-day isolated-worktree implement. Left in the backlog for the guardian loop, per the task's "small and unambiguous" bar.

**4. MISMO export gate**
- Acceptance-gate tests: `npx vitest run tests/mismoExport.test.ts tests/mismoValidation.test.ts tests/mismoMersMin.test.ts` → **3 files, 105 tests, all passed.**
- Generated a dummy-borrower MISMO 3.4 XML via `generateMISMO34XML` ([server/mismo.ts:915](../../../server/mismo.ts)) and validated it via `validateULDDCompliance` ([server/mismo.ts:1071](../../../server/mismo.ts)):
  - `DataVersionIdentifier` confirmed `3.4.0` (deliberate — matches doctrine, not chasing 3.6).
  - Validation result: `valid: true`, `errors: []`, `warnings: ["MERS Org ID is not configured; a MERS MIN cannot be generated for loan delivery"]`, `phase5Ready: false`.
  - The one warning is expected and correct: `mersOrgId` is also `"PENDING"` in `server/config/company.ts` — same F1-adjacent gate, not a bug.
  - Generated XML saved to scratchpad: `/private/tmp/claude-501/-Users-ammrebarakat-Developer-MortgageStream/77ec4237-0deb-4874-bd3a-8bc20953eaae/scratchpad/dummy-mismo-export-2026-07-04.xml` (5,424 bytes) — ready to attach to a real submission the day credentials land. Throwaway generator script (not committed) lived alongside it in the same scratchpad directory.

## Corrections table

| Doctrine/memory claim | Verified reality | Divergence |
|---|---|---|
| F1 status: PENDING (per memory) | `nmlsId: "PENDING"` in `server/config/company.ts:4` | None — confirmed unchanged. |
| Target-5 shortlist should exist in `kb/my-research/` | Directory had no lender-shortlist file before this run | Stale/missing, not divergent doctrine — now created. |
| S-07 next in backlog (memory: "S-07 next") | Confirmed — still `Status: Proposed`, cited, but needs a new intake field per its own spec | None — matches expectation that it needs engineering, not a citation gap. |

## Remediation tickets

No new P0/P1 engineering tickets this run — nothing surfaced that isn't already tracked. The
five gaps in the Target-5 shortlist (Plaza PDF manual read, UWM/Rocket pricing-feed format
confirmation, Angel Oak/Newrez thin documentation) are founder desk-research/call items already
listed above, not engineering work, and don't belong on `CTO_ROADMAP.md`. S-07's intake-field
requirement will become a ticket when it's actually drafted for implementation (per the routine's
own "small and unambiguous" gate) — premature to add it now. `CTO_ROADMAP.md` "Do next" and
"Future" sections were left untouched this run.

STATUS: OK
