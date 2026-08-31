# 13 — The Selling Guide as the foundation

> **Freshness:** last verified 2026-08-23 · review every 30 days
> **Verified against** the corpus PR's branch @ 3a60fef8 (this chapter and the machinery it
> teaches land in the same PR) · **Authoritative:** `CLAUDE.md` §Compliance first,
> `../governance/TEAM_PRACTICES.md` §10,
> [`../compliance/SELLING_GUIDE_PERMANENCE.md`](../compliance/SELLING_GUIDE_PERMANENCE.md),
> [`docs/fannie-mae/selling-guide/README.md`](../../docs/fannie-mae/selling-guide/README.md)
> (they win on conflict; the code wins over both; **nothing in this chapter is a Guide
> reading — readings come only from the extracted corpus, cited by section id and page**).

## The mental model

One book outranks the codebase, and the codebase has to prove it read the book. The Fannie
Mae *Selling Guide* is the policy authority for every conventional-loan rule this company
ships — eligibility, underwriting, income, credit, property, delivery — and this repo treats
it the way it treats code: **versioned** (edition 08-05-2026, pinned by SHA-256),
**buildable from source in any clone** (the PDF recovers from the repo's own git history —
no network, no setup), **gated in CI** (a corpus that disagrees with itself cannot merge),
**materialized into every session** (a SessionStart hook), **watched daily** (a steward
routine drills the whole chain and probes Fannie for editions, amendments and link rot),
and **cited by id** (a change to Guide-governed code without a resolving section id fails
the gate). Everything else in this corpus — the engines of chapter 05, the compliance rails
of chapter 08, the loops of chapter 12 — builds on rules whose ultimate authority is this
one document.

## Explain it to a new hire

The Selling Guide is the rulebook our lending logic must agree with, and we keep the whole
1,185-page book inside the repo as 423 per-section text files that one command regenerates
in about three seconds, in any checkout, with no network. Titles, page numbers, structure
and the book's own link inventory are tracked as facts; the copyrighted text itself is
generated locally and gitignored, because this repo is public. Three mechanisms keep it
trustworthy: a CI gate that re-proves extraction and coherence on every PR, a session hook
that hands you the corpus (or a loud directive) the moment you start working, and a daily
steward that re-drills everything from scratch and watches Fannie for new editions and
amendments. When you change Guide-governed code you cite the section id, and the gate checks
the id actually exists in the committed edition, because the Guide renumbers and a stale
citation does not announce itself. If you need to know what the Guide says, you read the
extracted section — never memory, never a search-engine paraphrase.

## Mechanism

The chain, end to end:

1. **Source.** `Selling-Guide_08-05-2026.pdf` — committed 2026-08-20 (repo then private),
   removed from the tip when the repo went public, still present as blob
   `c984148c…` in merged history. `scripts/extract-selling-guide.py` recovers it
   (`$SELLING_GUIDE_PDF` → local file → `git cat-file`), verifies its SHA-256 against the
   pinned constant, and **stops honestly** when no path yields a PDF.
2. **Extraction, in two renderings of the same pages.** One run writes the page-marked
   text stream (`selling-guide-text.txt`, `[[PAGE n | <section>]]` on every page) plus one
   heading-anchored file per section under `extracted/sections/<ID>.txt` (ligatures
   expanded so grep works; anchors tile the book so every character lands in exactly one
   file), and — when `pymupdf4llm` is installed — the same book again as **markdown**
   (`selling-guide.md`, `extracted/markdown/<ID>.md`). Read the markdown one: the text
   rendering **flattens tables**, and the Guide states most of its real thresholds in
   tables. Both renderings use the same TOC and the same anchoring code, so a section id
   means the same span in both. The run also regenerates the **tracked fact layer**:
   `section-index.tsv`, `revised-sections.tsv`, `toc.json`, `links.json`, `manifest.json`,
   `INDEX.md` — derived from the text layer alone, so it is byte-identical on a machine
   with no `pymupdf4llm`. Deterministic, so `git diff` is the drift check.
3. **The link corpus.** The Guide cites the outside world, and `links.json` pins all of it:
   every external URL with an honest class (`ok`/`mailto`/`malformed`), the section→section
   cross-reference graph, and each section's canonical URL on the HTML edition.
4. **Gates.** `pnpm guard:corpus` (fact layer agrees with itself and with the extractor's
   pins — which it *parses out of* the extractor, never restates), `pnpm guard:coverage`
   (the 423-row map current), and the CI extraction proof (recover → extract → `--check` at
   the pinned pymupdf) — all three **always-run**, deliberately outside the scope step's
   docs-are-inert shortcut, a property `tests/ciTriggers.test.ts` pins. Plus
   `pnpm guard:authority`: an unresolvable section id fails anywhere in the diff.
5. **Sessions.** `.claude/settings.json` runs `scripts/selling-guide-session-hook.cjs` at
   SessionStart: corpus present → one-line OK in milliseconds; absent → materialized in ~3s;
   impossible → a corpus-first directive in the session's opening context. The hook informs;
   the gate blocks.
6. **The daily steward.** `/selling-guide-steward` (CCR fleet, 05:30 UTC — before every
   other routine, which is the corpus-first ordering made literal) re-drills extraction from
   a clean worktree, runs the guard battery, sweeps editions/amendments/links
   (`pnpm sg:watch:save`), and reports. Draft PRs only. Edition cutover is a founder
   runbook, never an automated act.
7. **Consumption.** Guide-governed code carries section ids (`PATH_TRIGGERS` domains:
   underwriting and decision engines, income policy, scenario/classification, AUS/DU,
   delivery readiness, policy data, borrower-facing policy surfaces); the coverage map says
   which of the 423 sections have been reviewed against the code; the conformance ledger
   records what was read and what was fixed.

## The facts, with receipts

The corpus-specific rows live in [FACTS.md](FACTS.md) — F-45 through F-48 — so
`pnpm handoff:facts --check` re-derives this chapter's numbers forever. The shape:

```bash
cut -f3 docs/fannie-mae/selling-guide/section-index.tsv \
  | grep -Ec '^[A-E][0-9]?(-[0-9]+(\.[0-9]+)?)*-[0-9]{2}, '        # → 423 leaf sections
tail -n +2 docs/fannie-mae/selling-guide/section-index.tsv | wc -l  # → 554 TOC entries
python3 -c "import json;s=json.load(open('docs/fannie-mae/selling-guide/links.json'))['summary'];print(s['unique_urls'],s['ok_urls'],s['xref_edges'])"
                                                                    # → 319 295 989
grep -cE '^      - name: Selling Guide' .github/workflows/ci.yml    # → 4 gate steps
```

And the one command that makes everything above concrete:

```bash
python3 scripts/extract-selling-guide.py
# → source=Selling-Guide_08-05-2026.pdf sha256=✓ pages=1185 toc=554 sections=423 …
```

## Prove it yourself

Run these from a checkout; each proves a different link in the chain.

```bash
# 1. The corpus builds from nothing — delete the generated layer and watch it come back
rm -rf docs/fannie-mae/selling-guide/extracted docs/fannie-mae/selling-guide/*.pdf \
       docs/fannie-mae/selling-guide/selling-guide-text.txt \
       docs/fannie-mae/selling-guide/selling-guide.md
python3 scripts/extract-selling-guide.py --no-markdown   # PDF from git history, ~3s
python3 scripts/extract-selling-guide.py --markdown      # the readable layer, ~2 min

# 2. Read one section the way a session should
python3 scripts/extract-selling-guide.py --section B3-6-05 --markdown

# 2b. See why the markdown rendering exists: a table the text layer destroys
grep -A5 "Maximum Number of" docs/fannie-mae/selling-guide/extracted/markdown/B2-2-03.md
grep -A9 "Maximum Number of" docs/fannie-mae/selling-guide/extracted/sections/B2-2-03.txt

# 3. Who cites B3-6-05? The book's own citation graph answers
python3 -c "import json; x=json.load(open('docs/fannie-mae/selling-guide/links.json'))['internal_xrefs']; print(sorted(k for k,v in x.items() if 'B3-6-05' in v))"

# 4. The coherence gate, exactly as CI runs it
pnpm guard:corpus

# 5. The session hook's three honest outcomes (all exit 0 — it informs, the gate blocks)
node scripts/selling-guide-session-hook.cjs
```

## Where this breaks

- **Tables flatten.** Text extraction loses row/column association in borderless tables —
  B2-2-03's financed-property limits table is the named case. A threshold, matrix cell or
  limit read out of extracted text is **unverified until the PDF page is open**, and the PDF
  is one command away in any clone. Prose may be trusted from the text; a table value may
  not.
- **The Guide renumbers, and stale citations do not 404.** On 2026-03-04 self-employment
  income moved off B3-3.2/B3-3.4; six code sites kept citing the old chapter and the old
  URL kept returning HTTP 200, silently serving renumbered content. That incident is why an
  id the index does not know is a **wrong** citation, not merely an old one
  (`scripts/selling-guide-authority-guard.cjs`).
- **The network to Fannie is environment-dependent and lies in both directions.** Measured
  2026-08-23: every fanniemae.com host is unreachable from the Claude remote environment —
  and the transparent agent proxy answers **HTTP 403**, indistinguishable from an origin bot
  wall (curl shows 000). The watch's first seed run took those 403s for link rot and emitted
  293 false signals before the rule landed: **rot is 404/410 only; a 403 is `denied` and
  never a signal**. Reachability has flipped before (the Reg Z sources, blocked 2026-08-04 →
  open 2026-08-18), so it is probed every run and recorded, never asserted.
- **An amendment beats the edition.** Fannie publishes SEL-YYYY-NN announcements between
  editions; the committed corpus is the 08-05-2026 snapshot. A signaled announcement means
  the sections it revises are unverified here until the next edition lands — the watch
  surfaces the id; it cannot make the gap not exist.

## What we do not know

- **The Servicing Guide is absent** — the document hierarchy's other half. Nothing here may
  answer a servicing-policy question.
- **The LLPA Matrix is not procured** — which is exactly why `server/pricing.ts` is
  deliberately outside the authority guard's trigger paths (a trigger nobody can satisfy
  honestly trains route-arounds).
- **Whether the founder will allowlist `*.fanniemae.com`** in the environment network
  settings — the recorded unlock that turns the edition/link watch fully automatic. Until
  then, new editions arrive by founder-supplied PDF, the path 08-05-2026 itself took.

## Analogy

The Guide is the building code, and this repo refuses to let it be a book on a shelf. It is
a **vendored dependency with a lockfile**: the edition is version-pinned by hash, built from
source on every machine, integrity-checked on every merge, re-audited every morning by
the steward, and imported by explicit reference — every Guide-governed function names the
section it implements the way an import names its module. Upgrading the dependency (a new
edition) is a deliberate, human-reviewed version bump with a changelog diff
(`revised-sections.tsv`), never an auto-update.

## Teach-back checkpoint

Answers with receipts in [TEACHBACK_KEY.md](TEACHBACK_KEY.md) — try first.

1. A fresh clone, no network, no PDF anywhere. What exact mechanism gives
   `extract-selling-guide.py` the Guide, and what proves the bytes are the right edition?
2. Why is an unknown section id a **wrong** citation rather than merely an old one, and
   which incident set that rule?
3. Your PR only touches `docs/fannie-mae/selling-guide/`. Why do the corpus gate steps
   still run, when the scope step classifies `docs/` as inert — and what pins that?
4. The watch sees HTTP 403 on a Guide-referenced URL. What does it record, what does it
   NOT emit, and why is that rule correct even against the real origin?
5. You read a DTI threshold out of `extracted/markdown/B3-6-05.md` that sits inside a
   table the markdown rendering laid out cleanly. What must still happen before code may
   rely on it — and why does a well-rendered table not change that answer?
6. The steward's sweep signals a PDF-sha mismatch at the official endpoint. Name the next
   three things that happen — and the thing that must NOT happen.
7. Where do the five criteria live that gate the assumption-replacement end state, and who
   may start that program?

## Go deeper

[`docs/fannie-mae/selling-guide/README.md`](../../docs/fannie-mae/selling-guide/README.md)
(the front door: layout, grep recipes, the edition-cutover runbook) ·
[`../compliance/SELLING_GUIDE_PERMANENCE.md`](../compliance/SELLING_GUIDE_PERMANENCE.md)
(the program map, every layer with its receipt, the end-state criteria) ·
[`../compliance/SELLING_GUIDE_CONFORMANCE.md`](../compliance/SELLING_GUIDE_CONFORMANCE.md)
(what was read and what the code disagreed with) ·
[`../compliance/SELLING_GUIDE_COVERAGE.md`](../compliance/SELLING_GUIDE_COVERAGE.md)
(all 423 sections vs this codebase) ·
[`.claude/skills/selling-guide-steward/SKILL.md`](../../.claude/skills/selling-guide-steward/SKILL.md)
(the daily seat's rails) · chapter [08](08-compliance-rails.md) (the wider compliance rail
system this slots into) · `../governance/TEAM_PRACTICES.md` §10 (the binding register).
