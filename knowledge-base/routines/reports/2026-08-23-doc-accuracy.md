# Doc Accuracy — 2026-08-23 (founder-directed session; the seat's first executed sweep)

STATUS: OK — the founding backlog is swept, the corpus is machine-neutral and re-verified at
`6377727e`, the three living charters are restructured, and everything rides one docs-only branch
awaiting the founder's review.

## ⛔ Human actions (hardest first, or `none`)

1. **Review the Feynman restructure of the three living charters** — the headline item.
   `routines/CHARTER.md` was rewritten into the teaching shape (885 → 1,112 lines, old §0–§11 →
   new §1–§21, crosswalk appendix at its end); `feature-review/CHARTER.md` and `SOP-000` got the
   scaled treatment. The content-preservation check: every non-heading line of the old routines
   charter survives modulo the section renumbering **except 10 lines, each a deliberate
   disambiguation** (bare "§9"/"§12"/"§14" spelled out as TEAM_PRACTICES / DESIGN_SYSTEM refs).
   85 living citing files were re-anchored; 31 dated-history citers were left untouched and
   resolve through the crosswalk. Rule semantics changed nowhere; this whole item is D8 founder
   territory executed at your direction and is yours to confirm.
2. **Decide the branch disposition.** `claude/homiquity-doc-accuracy-iv8ijz` **absorbs** the three
   in-flight lines rather than racing them: PR #700 (the seat refocus), PR #699 (the #670 corpus
   refresh), and the unPRed `docs/handoff-day1-and-scaffold-0823` (the first-morning enrichment +
   §11/§12 keys) are all contained in it, reconciled. Merging this branch supersedes all three
   (close #699/#700 as absorbed); merging them first instead means this branch rebases. #647
   (CONFLICTING, the 08-20 run) and #658 (the 08-22 run) are untouched and still open — #647's
   rebase was already assigned by you to the #700 session's follow-up.
3. **Install the seat prompt and clear the dead trigger.** The auditable prompt copy is now
   `knowledge-base/doc-accuracy/SEAT_PROMPT.md`; paste it into the scheduled task
   `doc-accuracy-daily` (§15: file and scheduler change together). And #700's open ⛔ read is
   answered: **`list_triggers` was read live this session — the old 6-hourly CCR trigger still
   exists, dormant** (`next_run_at` stuck at 2026-08-18); delete it, or it stays the two-truths
   hazard §8a records.
4. **The standing re-arm decision** — `main` still has 0 required status checks (F-44). The docs
   now say so honestly everywhere; only you can re-arm the check.
5. **Two code-lane items await you** (never this routine's edit): `chore/harness-tiers-0823`
   delivers DA-0823-15 (freshness-guard coverage for the corpus + generator extensions); and the
   nine `scripts/*.cjs` / `.githooks` comments citing the charter's pre-restructure section
   numbers need a one-line remap (listed in the charter's crosswalk appendix).

## Summary

A founder-directed session executed the seat's first real sweep and the full corpus refresh in
one branch: the 122-commit founding backlog `e3655d7..6377727e` was swept (clean — every
retired-term and pnpm-script hit is sanctioned history), every founder-machine absolute path in
the handoff corpus was neutralized so the corpus now runs on any machine, all eleven extractable
prove-it blocks were re-run at the tip with their drifted outputs fixed, and chapter 13 (day one
→ first PR) plus the §11–§13 answer keys closed the corpus's last coverage gap. The three living
charters were restructured into the Feynman shape at the founder's decision, with a
content-preservation check and a repo-wide citation re-anchor. Three concurrent work lines
(#699, #700, the day-1/scaffold branch) were absorbed and reconciled rather than raced.
`last-swept SHA` advanced for the first time since founding.

## Evidence

- **D5 docs-only:** `git diff --name-only origin/main...HEAD | grep -v '\.md$'` → empty, across
  86 changed files / 23 commits.
- **Dated history untouched:** the same diff contains zero paths under
  `knowledge-base/{logs,archive,routines/reports}/` (this report is the first).
- **Corpus gates:** `pnpm handoff:facts --cite` → "703 resolvable path:line citations … every
  citation lands inside its file ✅"; `--check` → every checkable row agrees except the two
  documented branch-dependent rows (F-21 229→231, F-31 1100→1114 — both measure `HEAD`; rail 6b
  keeps `main`'s values until merge).
- **Guards:** `guard:kb` "230 docs, all indexed; no dead links" · `guard:citations` "29
  unresolved (at baseline, no regression) ✅" · `guard:staleness` "3 old-repo-name / 1
  dead-Vercel (at baseline) ✅" · `guard:docs` "8 living docs verified within interval ✅".
- **Re-anchor completeness:** the letter-token scan (`§1a|§1b|§3a|§6a|§6b|§6c` over living md)
  returns only quoted-history rows explicitly marked pre-restructure, self-referential checklists
  (PLAID), and other docs' own §-systems (LOCAL_DEV's tables).
- **Portability:** `grep -rn "/Users/" knowledge-base/handoff/` → no living hits.
- **Trigger read:** `list_triggers` (Claude_Code_Remote MCP), 2026-08-23 — 15 triggers; "Doc
  Accuracy — 6-hourly knowledge-base steward" present, dormant, `next_run_at` 2026-08-18.
- **Protection:** FACTS F-44 (0 required checks, measured 2026-08-22); `gh` absent in this
  sandbox, so the value carries its measured date rather than a re-probe — stated in FACTS.
- **Prod probe:** blocked by this sandbox's proxy (stated in chapter 10 and the charter's §16
  receipts rather than asserted either way).

## Proposed tickets (for Evening Triage)

1. **app-guide/05 rewrite** (owner: the app-guide; HO-0822-16) — bannered stale this session;
   the walked replacement is handoff 04.
2. **Remap the nine charter-§ comments in `scripts/` and `.githooks`** (owner:
   `hq-ci-guards-owner`; code lane) — sites listed in the charter's crosswalk appendix.
3. **Review/merge `chore/harness-tiers-0823`** (code lane) — carries DA-0823-15 (freshness-guard
   coverage for the corpus).
4. **HO-0822-02 fossils** (code comments saying "174 Drizzle tables"; owners:
   `hq-pipeline-owner`, `hq-intake-funnel-owner`, `hq-ci-guards-owner`) — still open.
5. **HO-0822-05** (api-routes skill's `pgEnum` rule vs the code's `varchar + as const + z.enum`
   practice) — rule semantics, founder ruling still pending.

## Sanctioned deviations (charter: say so rather than follow the stale copy)

This ran as a founder-directed session, not the scheduled tick: the branch is the session's
designated `claude/homiquity-doc-accuracy-iv8ijz` (not `routine/doc-accuracy-<date>`); it is
pushed for review without opening a PR (the founder asked for the branch); rule-semantics edits
(the charter restructure, the skill's all-markdown charge, chapter authoring, the §§11–13 keys)
were made as the founder's pen and are ⛔-listed above rather than being propose-only; and the
sweep executed here counts as the seat's first, so `last-swept SHA` advanced. Two open routine
PRs existed (#647, #658) — a scheduled tick would have been `observe`; the founder's direction
supersedes D4 for this session only.

STATUS: OK
