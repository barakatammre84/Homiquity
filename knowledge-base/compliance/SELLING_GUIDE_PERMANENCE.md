# Selling Guide permanence — the program that keeps the source of truth true

> **Freshness:** last verified 2026-08-23 · review every 30 days
> **Authority (L1/L2):** CLAUDE.md "Compliance first" ·
> [governance/TEAM_PRACTICES.md](../governance/TEAM_PRACTICES.md) §10 ·
> [routines/CHARTER.md](../routines/CHARTER.md) §3a/§6. This file is the program map;
> those files bind.

The Fannie Mae *Selling Guide* (edition **08-05-2026**) is the policy authority for every
conventional-loan rule this company builds — the founder's direction (2026-08-23) is that it
is the core foundation of everything built, everything already built, and everything that
will be built. A source of truth is only worth what its verification is worth, so the Guide
does not sit on a shelf here: it is **extracted, organized, gated, watched and taught**, and
every layer of that is a command you can run. Every claim below carries its receipt.

## The layers, each with its receipt

| Layer | What it guarantees | Receipt (run it) |
|---|---|---|
| **Extraction** | Any clone materializes the full corpus — 1,185 pages, 423 heading-anchored section files, page-marked stream — with no network: the PDF recovers from this repo's own git history, SHA-256-verified | `python3 scripts/extract-selling-guide.py` → `… sha256=✓ pages=1185 toc=554 sections=423 …` in ~3s |
| **Fact layer** | Titles, pages, dates, structure, links — tracked, machine-readable, no Guide prose (the repo is public; the Guide is copyrighted; the split is a founder decision) | `ls docs/fannie-mae/selling-guide/{section-index.tsv,toc.json,links.json,manifest.json,INDEX.md}` |
| **Link corpus** | Every link the Guide itself carries is a documented fact: 319 unique external URLs (295 probeable / 22 mailto / 2 corrupt-in-the-PDF), the 989-edge section-to-section citation graph, each section's canonical HTML-edition URL | `python3 -c "import json; print(json.load(open('docs/fannie-mae/selling-guide/links.json'))['summary'])"` |
| **Coherence gate** | The fact layer agrees with itself and with the extractor's pinned identity, on every PR, never skippable by the docs-are-inert classifier | `pnpm guard:corpus` → `ok — edition 08-05-2026, 554 TOC entries, 423 sections, 319 link URLs …`; the always-run property is pinned by `tests/ciTriggers.test.ts` |
| **Extraction proof (CI)** | Every PR re-proves recover→extract→verify at the pinned pymupdf, in a venv, from git history | ci.yml step "Selling Guide extraction proof (recover → extract → verify)" |
| **Coverage gate** | The 423-row map of sections-vs-code cannot drift silently from its status file | `pnpm guard:coverage` → `ok — 423 sections, map current.` |
| **Session hook** | Every Claude session starts with the corpus verified/materialized or a loud corpus-first directive — the hook informs, the gate blocks | `node scripts/selling-guide-session-hook.cjs` → `selling-guide corpus: ready — …` (exit 0 in every branch) |
| **Watch** | Editions (PDF byte-sha vs the manifest pin), amendments (SEL-YYYY-NN ids), the HTML edition, and all probeable links — probed honestly: rot is 404/410 only, a 403 is `denied` (the first seed run took the agent proxy's 403s for rot and emitted 293 false signals before that rule), a blocked host short-circuits in seconds | `pnpm sg:watch` (exit 0 complete / 2 signals / 3 incomplete-and-says-so) |
| **Watch liveness** | A silent watcher or an unacknowledged blocked host reds the checkup; acknowledged gaps WARN with their procurement path (the ratchet) | `node scripts/selling-guide-freshness.cjs` |
| **Daily steward** | The whole chain re-proven from a clean worktree every day at 05:30 UTC — before the rest of the fleet, corpus-first made literal; draft PRs only | [`.claude/skills/selling-guide-steward/SKILL.md`](../../.claude/skills/selling-guide-steward/SKILL.md); reports at `knowledge-base/routines/reports/<date>-selling-guide-steward.md` |
| **Authority gate** | Guide-governed code names its section; an unresolvable id fails anywhere in the diff | `pnpm guard:authority` (TEAM_PRACTICES §10) |
| **The teaching layer** | How the Guide touches every aspect of the build, in the handoff corpus's Feynman contract, with teach-back | [handoff chapter 13](../handoff/13-selling-guide-as-the-foundation.md) |

## The blocked-network truth (recorded, not asserted)

Measured 2026-08-23 from the Claude remote environment: **all 21 hosts** the Guide links to —
every fanniemae.com host included — are unreachable (the transparent agent proxy answers
HTTP 403; curl shows 000). Every one is carried in
`data/regulatory/selling-guide-watch-state.json` under `acknowledgedBlocked` with its
procurement path. **The founder-side unlock: allowlist `*.fanniemae.com` in the environment's
network settings** — the watch and the HTML edition then go live with no code change. Until
then, new editions arrive by founder-supplied PDF, the same path 08-05-2026 took.
Reachability is environment-dependent and has flipped before (CLAUDE.md's Reg Z lesson) —
the watch re-probes every run and records `lastRunEnvironment`, and never asserts either way.

## When the next edition or an amendment lands

- **Amendment (SEL announcement):** the watch signals the id; the steward reports it ⛔; the
  sections it revises are treated as unverified in the corpus until the next edition lands.
- **New edition:** the watch signals a PDF-sha mismatch; the steward stages the PDF
  (gitignored) and reports ⛔. The cutover itself is the founder-run runbook in
  [docs/fannie-mae/selling-guide/README.md](../../docs/fannie-mae/selling-guide/README.md)
  ("When the next edition lands"): update the pinned constants deliberately, regenerate the
  fact layer, diff `section-index.tsv` + `revised-sections.tsv` to scope the re-scrub,
  re-base the coverage edition (`guard:corpus` forces this in the same PR), and re-run the
  conformance scrub. **No automation ever cuts over an edition.**

## The end state: replacing assumption-based logic — criteria, not authorization

The founder's stated end state (2026-08-23): when this program is absolutely bulletproof,
the conventional-loan logic built on assumptions and research is deleted and replaced by
Guide-derived logic, with the Guide as absolute source of truth. **This section defines when
that program may START; it authorizes nothing by itself, and automation never deletes
product logic.** All five, simultaneously:

1. **14 consecutive `OK` steward reports** (drill green, sweep recorded) — two weeks of
   daily proof the chain holds from nothing.
2. **The corpus gate green on `main`** across that same window (no corpus step failed on a
   merged PR).
3. **Every one of the 319 link URLs dispositioned**: ok-probed, mailto/malformed-documented,
   or acknowledged-blocked with a procurement path — zero silent gaps in the ledger.
4. **One edition-cutover drill rehearsed** on a throwaway branch against the README runbook,
   proving the procedure before it is needed in anger.
5. **A conformance or coverage row exists for every section whose assumption-based logic
   would be replaced** ([SELLING_GUIDE_COVERAGE.md](SELLING_GUIDE_COVERAGE.md),
   [SELLING_GUIDE_CONFORMANCE.md](SELLING_GUIDE_CONFORMANCE.md)) — you cannot replace what
   you have not mapped.

Then the replacement program is **founder-opened**, one section per PR, every change citing
its section id (`guard:authority` enforces the citation resolves), conservative-direction
rules intact — a reading may tighten a gate, never loosen one without a founder decision.
The deletion of assumption-based logic is the founder's act, section by section, with the
Guide text open.
