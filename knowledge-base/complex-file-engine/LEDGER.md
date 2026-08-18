# Complex File Engine — ledger

Cross-run memory for the [Complex File Engine](../../.claude/skills/complex-file-engine/SKILL.md)
routine (daily 10:40 local). Each run reads this **before** Phase 1 and appends to it in Phase 4.

Three sections, three different jobs:

- **§1 Findings** — the work queue. Ids are `CF-<MMDD>-<NN>` using the **run's own date**
  (CHARTER §5: date-qualified by construction, never a bare next-free integer — six sessions once
  minted six different `F-20`s).
- **§2 Verified-not-a-defect** — **append-only.** Things a run went looking for and found already
  correctly built. This section is the guard against the house's most expensive research failure:
  *"the backend is far smarter than the UI surfaces it — grep before building anything a doc calls
  missing."* A row here is never re-investigated from memory.
- **§3 Refusals** — **append-only.** Work deliberately not done, and the gate that would reopen it.
  A path refused for a missing program reference is never re-derived by a later run.

Seeded 2026-08-18 by the founder session that registered the routine. Every row below was verified
against the code in that session at `de3c44e1`, not carried over from a document.

---

## §1 Findings

| id | status | class | what | evidence | disposition |
|---|---|---|---|---|---|
| `CF-0818-01` | open | drift hazard | `INCOME_PATH_IDS` is declared **twice** — canonically in `shared/incomePaths.ts:30` and again in `shared/situationProfile.ts:31`. Both lists are identical today, and nothing guards that. A sixth path added to the canonical enum leaves the SituationProfile's `z.enum` silently rejecting it, so a newly-supported path would not appear in the profile that tells the LO which paths apply. | both files read 2026-08-18; ids identical (`agency_wage, self_employment, rental, dscr, bank_statement`); no drift test found | **shippable — not regulated math.** Collapse `situationProfile.ts` to re-export the canonical enum (by name, never `export *` — see the client-bundle rule), plus a test pinning the two in lockstep. One PR, C6-sized. |
| `CF-0818-02` | open | **C7 coverage gap** | Capital-gains income is *detected* (`server/services/situationClassifier.ts:180-185`) and *reconciled* (`server/services/taxReconciliation.ts:271`) but **no income path computes it** — `INCOME_PATH_IDS` has no capital-gains member, so a borrower whose income is substantially capital gains is flagged and then contributes nothing to qualifying income. This is the exact defect class the routine exists to find: detected, surfaced, and then dropped before it can qualify anybody. | `shared/situationProfile.ts` `SITUATION_FLAG_IDS` contains `capital_gains_present`; grep for `capitalGain` across `server/services` + `shared/incomePaths.ts` returns only the classifier and the reconciler | **PROPOSE ONLY — C2 + C3.** Capital-gains qualifying income is regulated math (Fannie Selling Guide B3-3.1-09: history and continuance requirements), and `docs/fannie-mae/` holds **no Selling Guide income authority for it** — the only income references in-repo are `self-employment-income-reference.md` and `rental-income-reference.md`. So this is a **procurement ask first** (transcribe B3-3.1-09 into a reference doc), then a ledger citation, then a path. No code until the doc lands. |
| `CF-0818-03` | standing ⛔ | authority gap | The `dscr` and `bank_statement` paths are hard-blocked `PROGRAM_REFERENCE_NOT_IN_REPO` — correctly. The blocking facts are the Angel Oak **DSCR minimums by LTV/FICO** and the **deposit-eligibility rules**, both portal-gated. | `server/services/income/paths/dscr.ts:128-132`, `paths/bankStatement.ts:142-147`; `docs/lender-programs/angel-oak/` holds the two transcribed references but not these matrices | **Founder action, restated every run.** Obtain from the Angel Oak AE. Until then the paths compute no figure — **never soften this (C4)**. |

## §2 Verified-not-a-defect (append-only)

| verified | claim that was tested | outcome |
|---|---|---|
| 2026-08-18 | "Declining self-employment income has no treatment — averaging would overstate it." | **FALSE — already built and cited.** `server/services/selfEmploymentIncome.ts:100-121` implements B3-3.5-01: on a year-over-year decline it uses the most recent (lower) year, never averages the decline up, and flags manual analysis. `trend` is a first-class field of the result. Do not re-report. |
| 2026-08-18 | "UAL P4's `fs` citation guard — asserting every enabled path's authority doc exists on disk — was never built." | **FALSE.** `tests/nonQmProgramGate.test.ts` exists and does exactly that. It is the mechanical form of "no citation, no implementation"; keep it green, do not rebuild it. |
| 2026-08-18 | "The P5 import boundary — no underwriting-side module may import `taxInsightService` — is documented but unenforced." | **FALSE.** `tests/accuracyLoop.test.ts:220` enforces it by reading sources. `taxInsightService` is imported only by `server/routes/documents.ts` and `server/routes/taxInsights.ts`. Keep it. |

## §3 Refusals (append-only)

| refused | what | why | reopens only if |
|---|---|---|---|
| 2026-08-18 | Computing any DSCR pass/fail verdict, or any bank-statement figure, from published/marketing sources or from the model's own knowledge. | C2/C4. A wrong non-QM number leaks into a lender package and cannot be recalled. The TPO portal matrix controls, and it is not in-repo. | The AE matrix is transcribed into `docs/lender-programs/angel-oak/` (founder action `CF-0818-03`). |
| 2026-08-18 | Editing `server/underwritingEngine.ts`, `server/services/decisionEngine.ts`, `server/services/ruleEngine.ts`. | C1 / CHARTER §6 + §1b: credit policy is L4, human-only — it is what the licensee is accountable for. | Never, for this routine. Engine changes are proposals in the report; the founder executes them. |
| 2026-08-18 | Writing to `data/regulatory/regulatory-ledger.json` to accompany a regulated-math change. | C3. CHARTER §6 puts `data/regulatory/**` off limits to every routine *and* requires a same-commit ledger citation for regulated math — together they mean this routine may not change regulated math at all. It drafts the entry verbatim in the report instead. | The founder amends CHARTER §6 knowingly (§1b: rails are never relaxed by a routine or by a session acting for one). The proposal is in the routine's registration report, 2026-08-18. |
