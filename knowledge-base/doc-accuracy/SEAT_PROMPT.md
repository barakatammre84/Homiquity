# The 19:30 seat prompt — auditable copy

> **The scheduler's copy is authoritative at fire time.** This file exists because a definition
> only one machine can see is one nobody can audit (routines charter, preamble). The live prompt
> lives in the founder's local scheduled task **`doc-accuracy-daily`** (`30 19 * * *`, fires
> ~19:33); changing this prompt means editing **this file and the scheduler together, in the same
> session** (routines charter §15). Last synchronized: **2026-08-23** (founder-directed session —
> the paste below supersedes the scheduler text #700 installed; install it on next review).
> A CCR/cloud firing of the same seat reads this file directly.

---

Everything between the rules below is the paste — one block, verbatim.

---

> ## ⛔ FOUNDER DIRECTIVE — 2026-08-19 — context for every routine in this suite
>
> **We are not launching until the webapp is proven.** Launch readiness is nobody's ranking
> input. Deferred launch is not permission to defer work — the time pressure that justified
> "good enough" is gone, so nothing merely adequate is acceptable. Nothing about the safety
> rails, compliance gates, or write territory in `knowledge-base/routines/CHARTER.md` §10/§13 is
> relaxed by this directive. The charter (§8) carries the authoritative suite shape; this seat
> runs daily at 19:30, after the day's build lanes and the 17:05 Client Journey Walk and before
> the 21:00 Evening Triage, which consumes your report the same night — write the report for
> that reader.

Run the **doc-accuracy** routine for Homiquity (GitHub `barakatammre84/Homiquity` — the repo was
formerly named MortgageStream; NEVER use the old name in API calls). You are a fresh session with
no memory of any prior run. This is the scheduled invocation rail D1 requires — an explicit
scheduled prompt naming **/doc-accuracy** — and this prompt names it.

**Invoke `/doc-accuracy` and follow `.claude/skills/doc-accuracy/SKILL.md` exactly.** Its rails
D1–D12, its Modes, and its Phases 0–3 are authoritative; where the routines charter disagrees
with the skill, the charter wins and your report says so. Derive every path from
`git rev-parse --show-toplevel` — this prompt must run identically on the founder's machine or a
remote session (where `gh` is absent, the GitHub MCP tools answer the same questions).

**The seat's charge — founder decisions of 2026-08-23, recorded here so no run re-litigates
them:**

1. **Every markdown file in the repository stays correct and up to date** — the all-markdown
   sweep universe and its five lanes are in the skill's mission block; the drift-sweep machinery
   is the engine.
2. **The Feynman onboarding corpus `knowledge-base/handoff/` is this seat's flagship artifact**
   (extend and refresh, never rebuild; strictly read-only over app code). Its standing table of
   contents is the founder's six understanding areas plus the two meta-layers, mapped to
   chapters: the codebase and its map (00, 01) · user-auth flow (02) · DB schema and data model
   (03) · data flow (04) · backend and frontend architecture (05, 06, 10) · the verification
   harness (07) · compliance rails (08) · the prompting layer (09) · **the pattern analysis —
   application logic, prompting mechanisms, repetitive tasks (11)** · **the loop-safe build
   playbook and its prompt templates (12, prompts/)** · day one to first PR (13). Phase 1.4
   re-derives it every tick; Phase 1.5 re-runs the fresh-hire teach-back every fourteenth.
3. **The three living charters carry Feynman receipts** (routines · feature-review · SOP-000,
   restructured 2026-08-23): re-verifying their factual rows and prove-it receipts is seat work
   in the D11 ⛔ lane; their rule semantics stay founder territory.

**Tick shape:** Phase 0 memory refresh in full → Phase 1 detection (diff window since
`last-swept SHA`, the mechanical sweeps over the all-markdown universe, the rotation slice, the
1.4 corpus re-derivation) → Phase 2 fixes on ONE docs-only PR at most → Phase 3 ledger + report
to `knowledge-base/routines/reports/<YYYY-MM-DD>-doc-accuracy.md` (charter §13 format, final line
`STATUS:`). An empty window is a cheap clean tick: say so briefly and stop — that is a success.
Never merge, never enable auto-merge, never push `main`. Work in a fresh worktree off current
`origin/main`, never the shared primary checkout; a docs-only tick installs nothing.
