# The Selling Guide is the core document — the decision rule

> **Freshness:** last verified 2026-08-24 · review every 30 days
> **Authority (L1/L2):** founder direction 2026-08-24 · CLAUDE.md "Compliance first" ·
> [governance/TEAM_PRACTICES.md](../governance/TEAM_PRACTICES.md) §10. This file states the
> rule and how to obey it in under a minute; the *program* that keeps the Guide true is
> [SELLING_GUIDE_PERMANENCE.md](SELLING_GUIDE_PERMANENCE.md), and what our code actually
> agrees and disagrees with is [SELLING_GUIDE_CONFORMANCE.md](SELLING_GUIDE_CONFORMANCE.md).

## The rule

**Before anyone at Homiquity decides anything about what a loan is, who qualifies for it,
what it costs, what documents it needs, or how it is delivered — the Fannie Mae *Selling
Guide* answers the question, and the answer is cited by section and page.**

This binds **everyone**, and the founder/CEO is named in it deliberately, because the
failure mode this rule exists to prevent is not an engineer guessing in a pull request. It
is a decision made above the code — a product promise, a marketing claim, a pricing move, a
"can we just…" in a meeting — that the code is then asked to implement. By the time it
reaches a PR the decision is already made and the guards are arguing with a commitment.

The Guide is not an engineering rail. It is the **product definition** for a conventional
loan. Everything downstream of it is implementation detail.

## Which document, exactly

Edition **08-05-2026**, 1,185 pages, 423 citable sections, living in
[`docs/fannie-mae/selling-guide/`](../../docs/fannie-mae/selling-guide/).

Two renderings of the same PDF pages. **Read the markdown one.**

| | Read it when | Path |
|---|---|---|
| **Markdown** — `md` | Always, by default. It keeps the Guide's **tables** intact, and the Guide states most of its actual thresholds, matrices and eligibility grids in tables | `extracted/markdown/<ID>.md`, whole book at `selling-guide.md` |
| **Text** — `txt` | When you want the plainest possible grep target, or the markdown layer is not built on your machine | `extracted/sections/<ID>.txt`, whole book at `selling-guide-text.txt` |
| **PDF** | To settle anything. A threshold, a matrix cell, a limit — if it decides money or eligibility, confirm it on the page | `Selling-Guide_08-05-2026.pdf` |

Why markdown is the default now: the text rendering **flattens tables**. B2-2-03's
financed-property limits arrive there as three unlabelled runs of words, and no reader can
say which maximum belongs to which occupancy. In markdown the same page is a table with its
rows intact. That was the corpus's one standing gap, and it is closed.

## Looking something up, in under a minute

**Materialize the corpus once per machine** (the text under it is Fannie Mae's copyrighted
work and is therefore *not* committed to this public repo — the command rebuilds it locally,
recovering the PDF from this repository's own git history, with no network):

```bash
pip3 install pymupdf pymupdf4llm
python3 scripts/extract-selling-guide.py
```

Then, whichever of these fits how you think:

```bash
# 1. I know the section. Read it, tables and all.
python3 scripts/extract-selling-guide.py --section B3-6-05 --markdown
#    …or just open docs/fannie-mae/selling-guide/extracted/markdown/B3-6-05.md

# 2. I know the topic, not the section. Find which section governs it.
grep -n "Monthly Debt" docs/fannie-mae/selling-guide/section-index.tsv
#    ↑ this file is TRACKED — it works in a fresh clone with nothing installed

# 3. I know a phrase. Find every page it appears on, with its governing section.
grep -n "boarder income" docs/fannie-mae/selling-guide/selling-guide.md

# 4. I want to browse.
open docs/fannie-mae/selling-guide/INDEX.md    # every section, md + txt links
```

Two grep traps, both of which have cost a session here: use **`grep -F`** for any phrase
containing `$` (BSD grep reads it as an anchor and reports zero matches on text that is
verbatim there), and grep a **fragment**, not a sentence — lines wrap mid-sentence.

## Citing it

**Section id + PDF page.** `B3-6-05, p. 523`. Every generated section file prints its own
`Cite as:` line, so there is nothing to look up.

The id must resolve in the tracked `section-index.tsv` — `pnpm guard:authority` enforces that
on changed lines in every PR, because the Guide renumbers between editions and a stale id
does not 404, it just quietly points at the wrong policy.

## The four things this rule does *not* let you do

1. **Answer from memory.** Not the CEO, not an engineer, not Claude. If the corpus will not
   materialize on your machine, that is an honest gap — say so and stop. It is never a
   licence to answer anyway. (`scripts/extract-selling-guide.py` is built to fail loudly and
   tell you where it looked, rather than degrade into guessing.)
2. **Read a threshold out of a table and ship it unchecked.** The markdown layer
   reconstructs tables well — 840 of them — but on 98 of 1,185 pages it takes a second
   rendering pass to recover the prose at all, and those pages carry their tables below a
   `[[TABLES FROM THE GRAPHICS PASS …]]` marker rather than in place. **Anything that
   decides money or eligibility gets confirmed against the PDF page.** The PDF is one
   command away; there is no excuse left for skipping it.
3. **Loosen a gate because the Guide permits it.** A reading may remove a borrower charge or
   tighten a requirement on its own. A reading that *loosens* a consent, disclosure,
   adverse-action or FCRA gate is a founder decision even when the text plainly supports it.
   (CLAUDE.md, "conservative in one direction only.")
4. **Pick an interpretation when sources disagree.** The *Selling Guide* and *Servicing
   Guide* are Fannie Mae's official policy statements and control over job aids. Where they
   conflict with something else, or where the requirement is genuinely ambiguous, escalate to
   the founder rather than choosing. Writing down which reading you chose is not the same as
   having authority to choose it.

## What the Guide does *not* govern

It is the core document, not the only one. It answers *what Fannie Mae will buy*. It does not
answer:

| Question | Authority |
|---|---|
| Disclosure timing, APR, fee tolerances, LO compensation, the QM points-and-fees cap | Regulation Z — [`docs/reg-z/`](../../docs/reg-z/) (12 CFR 1026 + Supplement I, captured locally, cited by section and line) |
| Who may originate, licensing, sponsorship, call reports | NMLS Policy Guidebook — [`docs/nmls/`](../../docs/nmls/); state statutes control over it |
| Field names, enumerations, edit codes for delivery | ULDD/UCD references in [`docs/fannie-mae/`](../../docs/fannie-mae/) — and never invented if absent |
| Servicing after the loan is sold | Fannie Mae *Servicing Guide* — **not in this repo**; say so rather than reasoning from the Selling Guide |

Where the Selling Guide and one of these appear to conflict, that conflict is itself a
founder escalation, not a thing to resolve in a PR.

## How this is enforced rather than merely believed

You do not have to take this document's word for any of it — every layer has a command that
proves it, listed in [SELLING_GUIDE_PERMANENCE.md](SELLING_GUIDE_PERMANENCE.md). The short
version: a SessionStart hook materializes and verifies the corpus for every Claude session;
`pnpm guard:corpus`, `pnpm guard:coverage` and a full extraction proof run on every PR and
cannot be skipped; `pnpm guard:authority` fails a Guide-governed diff that does not cite a
resolvable section; and a daily steward re-proves the whole chain and watches for new
editions and amendments.

What is *not* enforced by a machine is the part this document is for: a decision taken in
conversation, before any of that runs. That one is on us.
