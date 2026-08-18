---
name: deliverable-qa-sweep
description: Use ONLY when the user explicitly invokes /deliverable-qa-sweep or explicitly asks to "run the QA sweep routine". NEVER auto-load for general testing, QA, bug-hunting, or review questions — those belong to the domain skills. This is a scheduled autonomous routine with its own safety rails.
---

# Deliverable QA Sweep — one domain, one workflow, adversarially verified

**Cadence:** daily, 15:05. **Writes code:** never — findings only.
**Produces:** verified rows in
[`knowledge-base/feature-review/FINDINGS.md`](../../../knowledge-base/feature-review/FINDINGS.md)
plus a `COVERAGE` line.
**Contract:** [`knowledge-base/routines/CHARTER.md`](../../../knowledge-base/routines/CHARTER.md)
wins over this file on any conflict; say so in the report rather than following the stale copy.

> **Provenance.** Reconstructed 2026-08-18 into the repo from CHARTER §1, §5, §6 and §9, from the
> feature-review corpus (`CHARTER.md`, `DOMAINS.md`, `WORKFLOWS.md`, `FINDINGS.md`), from the six
> `.claude/agents/*.md` this routine drives, and from its own `2026-08-17` report — because the
> definition existed only on one machine. See
> [`logs/2026-08-18-routine-suite-audit.md`](../../../knowledge-base/logs/2026-08-18-routine-suite-audit.md).
> **Merge any rail the scheduled-task copy carries that this file lacks; never delete one.**

## Why this routine exists

The Primary Engineer builds from verified findings. **This routine is what makes a finding
verified** — and everything downstream inherits its error rate. A false positive here costs a whole
build run; a fixed defect re-reported as launch-blocking erodes trust in every other row.

### What it catches that no other control does

CI proves the code does what the tests say. This routine asks the question tests cannot: **does the
feature do what it is *for*?** It reviews one domain against its intended use, drives one workflow
end to end against a live server, and probes the surfaces a diff-shaped review never revisits.

### The agents it drives

Already in this repo, and they are the method — do not hand-roll a substitute:

| Agent | Use |
|---|---|
| `feature-reviewer` | one domain from `DOMAINS.md` vs its intended use |
| `workflow-verifier` | one named workflow from `WORKFLOWS.md`, step by step, against the live dev server |
| `finding-verifier` | **adversarial**: tries to REFUTE a proposed finding before it enters the register |
| `ux-reviewer` | design-system conformance, cross-surface uniformity, friction |
| `compliance-auditor` | verifies compliance-touching findings against `docs/` — never from memory |
| `doc-governance-reviewer` | the `.md` corpus against the 4-point framework |

## Rails

- **R1 — Invocation.** Only on an explicit `/deliverable-qa-sweep` or a scheduled-task prompt
  naming this routine.
- **R2 — Findings only, no code.** Never edit `client/**`, `server/**`, `shared/**`, `tests/**`,
  `migrations/**`, `docs/**`. This routine writes `FINDINGS.md` and its own report. It takes **no
  `REGISTER.md` claim** — a claim it never releases would block peers that do write code.
- **R3 — No finding enters the register unrefuted.** Every proposed finding goes through
  `finding-verifier` first, prompted to **refute**, defaulting to refuted when uncertain. Record
  the verdict on the row. A finding nobody tried to kill is a hypothesis.
- **R4 — Date every standing claim, and re-run every negative grep.** "The grep found nothing" is a
  claim to re-run, not to quote: a P0 once asserted *"no recommendation field exists anywhere in the
  MISMO DTO"* when the field was at `shared/mismo.ts:720` — the defect was real, the cause was
  wrong, and a wrong cause makes a real finding cost more to fix.
- **R5 — Ids are date-qualified: `F-<MMDD>-<NN>`, using your own run's date.** Never a bare
  next-free integer: six sessions that could not see each other once minted six different `F-20`s.
- **R6 — Commit the register in the same run that writes it.** The 2026-08-12 sweep left its whole
  register uncommitted; it never reached `main`, and the P0 inside it **aged five days unowned**. An
  uncommitted finding is not a finding.
- **R7 — Never claim a browser verification.** No Playwright, no Storybook, no axe, and the client
  lane is happy-dom. A dev server may not start in an unattended run — say so plainly. A worktree
  dev server, when one runs, is port **5002**; the primary checkout uses 5001. HTTP integration
  tests must send `X-Forwarded-Proto: https` on login **and** every authenticated call, or the
  session cookie never comes back.
- **R8 — Compliance findings are verified against `docs/`, never memory.** MISMO names,
  enumerations, edit codes, NMLS policy, Reg Z readings — `compliance-auditor`, or flagged. Reg Z
  readings are **flagged, never asserted**.
- **R9 — CHARTER §8 verbatim.** Never push to `main`, merge, arm auto-merge, or touch production.
- **R10 — Propose, never land.** Roadmap items belong to Evening Triage (§4). Fixes belong to the
  Primary Engineer or a human.

## Phase 0 — Orient

Fetch, branch off current `origin/main`, install after the rebase. Read `CHARTER.md`,
`REGISTER.md`, `LESSONS.md`, the feature-review corpus, and the day's upstream reports.

## Phase 1 — Pick the rotation

**One domain** from `DOMAINS.md` and **one workflow** from `WORKFLOWS.md` — least-recently-reviewed
first, but a domain touched by yesterday's merges outranks the rotation. Ranked by CHARTER §1
(question A before B) with the §1a Illinois tiebreak. Write the choice and its justification down
**before** any review.

## Phase 2 — Review and drive

Run `feature-reviewer` on the domain and `workflow-verifier` on the workflow, in parallel. A
workflow step that cannot be driven (no dev server, an auth wall, a vendor simulation) is reported
`static-only` **with the reason** — never as a pass.

## Phase 3 — Adversarial verification

Every proposed finding → `finding-verifier`, prompted to refute (R3). Compliance-touching ones also
→ `compliance-auditor`. Survivors enter `FINDINGS.md` with: date-qualified id, severity, the
acceptance question it fails, `file:line` evidence, the refutation attempt, and a
`last-verified-against` sha. Refuted ones are recorded as refuted — that record is what stops the
next sweep re-proposing them.

## Phase 4 — Age the register

Re-verify open P0/P1 rows against `origin/main` before repeating them (R4). A row already fixed is
closed with the commit that fixed it. **Report the oldest unfixed finding's age in days** — an
ageing P0 is this routine's loudest signal, and the reason `COVERAGE` carries it:

```
COVERAGE: domains <n>/<total> reviewed · workflows <n>/<total> run · open P0 <n> · open P1 <n> · oldest unfixed <id> (<n> days)
```

Say how the counts were derived. The status column is free text, so it cannot be counted
mechanically — a crude parse once swallowed rows whose *prose* mentioned a fix.

## Phase 5 — Report

`knowledge-base/routines/reports/<YYYY-MM-DD>-qa-sweep.md`, CHARTER §9 order: `STATUS` + the
`COVERAGE` block · ⛔ human actions (any open P0 first, with its age and whether it has an owner) ·
Summary ≤5 sentences · Evidence for every claim · proposed tickets for Evening Triage. Commit
`docs(routine): qa-sweep <date>` **together with the `FINDINGS.md` edits** (R6), open a PR, never
push to `main`.

**Status rules.** `FAIL` = an open P0 unowned, or a register you left uncommitted or uncountable.
`WARN` = a workflow that could not be driven, a missing upstream, a finding you could not refute or
confirm. `OK` = the rotation reviewed, findings verified, register committed.

## What this routine deliberately does not do

Fix anything · edit the roadmap · edit another routine's ledger · assert a compliance reading from
memory · claim a browser check.
