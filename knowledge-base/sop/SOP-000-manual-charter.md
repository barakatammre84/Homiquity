# SOP-000 — Operations Manual Charter

> **Freshness:** last verified 2026-08-20 · review every 90 days
> **Code anchors:** `knowledge-base/governance/TEAM_PRACTICES.md`

| | |
|---|---|
| **Owner** | Chief Compliance Officer |
| **Backup** | COO |
| **Applies to** | Everyone who writes, approves, or follows an SOP |
| **Status** | DRAFT — pending founder approval |
| **Approved by** | *(unsigned)* |

---

## 1. Why this manual exists

Three separate forces require it, and they do not overlap:

1. **Fannie Mae, through our wholesale lenders.** We originate as a **third-party originator (TPO)**.
   Selling Guide **A3-3-01** makes the *lender* fully responsible to Fannie Mae for functions
   outsourced to us, and requires the lender to review the TPO's QC procedures against its own
   standards — including that the TPO maintain a written QC plan and a process for resolving QC
   discrepancies and tracking corrective actions. No manual, no broker approval. This is the
   commercial gate.
   ⚠️ **Citation unverified in-repo** (2026-08-20): `docs/fannie-mae/` holds no Selling Guide
   A3-3 text, so the requirements above restate the drafting session's reading rather than a
   captured source — the original draft carried them as direct quotes, downgraded here to
   paraphrase for that reason. Procure the section into `docs/fannie-mae/` and re-verify before
   treating this wording as authoritative (CLAUDE.md compliance hierarchy).
2. **State examiners and the SAFE Act.** An Illinois RMLA examination asks for written policies
   before it asks for files. Our licence, our NMLS record, and our Mortgage Call Reports are all
   attached to procedures somebody has to be able to produce.
3. **The company scaling past its founder.** Most of what follows currently lives in one head and
   in the code. A new processor on day one has to be able to do the job correctly without asking.

## 2. The one rule that makes this manual different

**The software is the primary control. The SOP documents the human parts and the parts the software
does not do.**

Homiquity already enforces a large amount of this in code: TRID hard stops, denial chokepoints,
role gates, transition tables, consent coverage. Where the code enforces something, the SOP **says
so and points at the file** — it does not restate the rule as if a human were the control, because
a human re-stating a machine control is how manuals rot.

Where the code does *not* enforce something — and there is a lot of it, catalogued in each SOP's
**§10 Open items** — the SOP is the only control that exists, and it is written to be followed
literally.

Every procedure step is therefore tagged:

| Tag | Meaning |
|---|---|
| `[SYSTEM]` | The app does this automatically. Nobody clicks anything. Listed so you know what already happened. |
| `[HUMAN]` | A person does this. This is a real instruction. |
| `[GATE]` | The app will physically refuse to let you continue until a condition is met. The SOP tells you how to clear it. |
| `[MANUAL-ONLY]` | The app does **not** do this at all. Off-platform. This step is the only thing standing between us and the failure it prevents. |

## 3. Explain it to a new hire — using an SOP on day one

Open the SOP for the task in front of you and read the tags before the words. `[SYSTEM]` rows
have already happened — the app did them; you are reading them so you know what state the file is
in. `[GATE]` rows are why the button you want is disabled; the SOP tells you what the app is
waiting for. `[HUMAN]` rows are your actual job. `[MANUAL-ONLY]` rows are the dangerous ones —
nothing in the software backs you up there, so follow them literally and never from memory. If
what the app does contradicts what the SOP says, the code is right and the SOP is wrong (§9) —
say so, and the SOP gets fixed by PR like code (§6). Never "improve" a step in the doing; a
procedure you improvised is a procedure the next person cannot follow.

## 4. Numbering

| Series | Domain | Primary owner |
|---|---|---|
| **SOP-0xx** | The manual itself | Chief Compliance Officer |
| **SOP-1xx** | Loan lifecycle — lead to funded | VP Fulfillment / Operations |
| **SOP-2xx** | Compliance & Quality Control | Chief Compliance Officer |
| **SOP-3xx** | Customer-facing & sales | VP Production / Sales |
| **SOP-4xx** | Internal & back-office | COO |

Numbers are permanent. A retired SOP keeps its number and is marked `RETIRED` with a pointer to its
replacement; numbers are never reused. Roles are the **org-chart roles**
(`knowledge-base/governance/HIRING_PLAN.md` and the org chart artifact) — not people's names — so
the manual survives a hire, a departure, and the phase where one founder holds six titles. Until a
role is filled, its work sits with the named **acting** holder in a governance RACI table
(**planned, not yet written** — until it exists, every unfilled role's acting holder is the
founder).

## 5. Anatomy of an SOP

Every SOP will use a common template file in this directory (**not yet written** — the first real
SOP's PR creates it). Two header lines are mandatory and intended to be machine-checked:

```
> **Freshness:** last verified YYYY-MM-DD · review every N days
> **Code anchors:** `path/one.ts`, `path/two.ts`
```

**Code anchors are the living-document mechanism.** They name the files that implement what the SOP
describes. The enforcement mechanism — an SOP freshness guard script in `scripts/`, **planned, not
yet built** — would fail the build when:

- an SOP is missing either line;
- an anchor path no longer exists on disk (the code moved, the SOP now describes a ghost);
- **an anchor file has been committed to since the SOP's `last verified` date.**

That last rule is the whole idea. You could not change `server/services/trid.ts` and leave SOP-201
claiming yesterday's behaviour — CI would go red and name the SOP. The fix is to re-read the SOP,
correct it if the behaviour changed, and bump the date. Bumping the date without reading it is
possible, and is the one dishonesty this system cannot catch; see §8.

⚠️ **Until that guard exists, nothing machine-checks these promises.** The standing weekly
`scripts/doc-freshness-guard.cjs` covers only the docs in its `REQUIRED` list — **this charter is not in it** (verified 2026-08-23; it never has been), so its Freshness line above is a voluntary claim no machine checks —
not anchor-vs-date staleness. Building the SOP guard is the first work item after this charter is
approved.

## 6. How an SOP gets written, approved, and changed

1. **Draft** — anyone may draft. Status `DRAFT`. A draft SOP is not binding.
2. **Technical accuracy review** — someone who has read the anchor code confirms every `[SYSTEM]`
   and `[GATE]` claim is true *today*. This is not optional; a wrong `[SYSTEM]` claim tells a human
   to skip a step the machine is not actually doing.
3. **Compliance review** — Chief Compliance Officer checks the regulatory anchors and that nothing
   in §5 instructs a person to do something the rules forbid.
4. **Approval** — named approver + date written into the header. Status `ACTIVE`.
5. **Change** — SOPs change by pull request against this repo, like code. The PR body says what
   changed and why. §11 Change log gets a row. Material changes (a control removed, a gate relaxed,
   an owner changed) need re-approval; typo fixes do not.

Approval authority mirrors `policy-ops` in the app: **the author may not approve their own SOP.**
Where the company is two people and that is impossible, the SOP is approved anyway and the fact is
recorded in the header as `Approved by: <name> (self-approved — single-operator exception)`. An
honest record of a weak control beats a fictional record of a strong one.

## 7. Review cadence

| Trigger | Action |
|---|---|
| Anchor file changes | CI flags it (once the §5 guard exists). Re-read within **5 business days**. |
| Regulatory change affecting the SOP | Re-read immediately. Compliance owns the signal (SOP-206). |
| Scheduled interval elapses | Re-read, re-date. |
| A file goes wrong in a way the SOP did not anticipate | Re-read *and* add the failure mode to §8. |
| Quarterly | COO walks the register: every SOP has an owner, every owner is a real person. |

Default intervals: **90 days** for compliance and money SOPs, **180 days** for everything else.

## 8. What this manual will not do

- **It will not make an untrue claim true.** Several SOPs describe steps against systems that are
  today **deterministic simulations** — DU/LPA findings, wholesale lender acknowledgements, asset
  verification. Each says so in bold at the top. When those become real integrations, the SOP
  changes; until then, no one may treat a simulated output as a fact about a borrower.
- **It will not substitute for counsel.** Open legal questions are listed, not answered. Anything
  marked `NEEDS COUNSEL` routes to the founder and General Counsel, never to an operator's judgment.
- **It will not catch a false attestation.** Re-dating an SOP without reading it, or writing
  "reviewed" in a PR without reviewing, defeats every guard here. That is a culture problem with a
  technical veneer, and the manual says so out loud rather than pretending otherwise.

## 9. Precedence

Where two sources disagree:

1. Statute and regulation.
2. The executed wholesale lender agreement (it can be stricter than the rule, never looser).
3. Fannie Mae Selling Guide, then job aids.
4. **The code** — on any question of what the system actually does, the code wins over any doc. A
   doc that disagrees with the code is a bug in the doc.
5. This manual.
6. Anyone's memory of how it was done last time.

## 10. Prove it yourself

```bash
cd "$(git rev-parse --show-toplevel)"
ls knowledge-base/sop/                      # → this charter only; the SOP series is unwritten
grep -n "REQUIRED = \[" -A 12 scripts/doc-freshness-guard.cjs   # → 8 docs; no sop/ entry (§5's caveat)
grep -c "SYSTEM\|GATE\|HUMAN\|MANUAL-ONLY" knowledge-base/sop/SOP-000-manual-charter.md  # the tag vocabulary
grep -rn "A3-3" docs/fannie-mae/ | head -1  # → empty: the §1 Selling Guide wording is still unprocured paraphrase
```

## 11. Where this breaks

| Failure mode | The instance | The rule it bought |
|---|---|---|
| A manual claiming controls that do not exist | the 2026-08-19 founding row claimed four artifacts; **only this charter existed** (§15, 2026-08-20 row) | every planned item is now labelled *planned, not yet built* |
| A human restating a machine control | the rot §2 names — restated rules drift from the code silently | `[SYSTEM]`/`[GATE]` tags point at files instead |
| A compliance quote nobody can source | the A3-3-01 wording restated a session's reading, not a captured text | downgraded to ⚠️ paraphrase pending procurement (§1) |
| A re-dated doc nobody re-read | possible here by design | named out loud as the one uncatchable dishonesty (§8) |

## 12. What we don't know

- **The SOP freshness guard (§5) is unbuilt** — until it exists, nothing machine-checks anchor
  staleness, and this charter's own Freshness line is voluntary (§5's caveat).
- **The template, the RACI table, and every SOP-1xx…4xx are unwritten** — the first real SOP's PR
  creates the template; until the RACI exists, every unfilled role's acting holder is the founder (§4).
- **Selling Guide A3-3 is not in `docs/fannie-mae/`** — the §1 TPO obligations remain flagged
  paraphrase until procured (CLAUDE.md compliance hierarchy).
- **Status is DRAFT, unsigned** — §6's technical-accuracy and compliance reviews have not run.

## 13. The analogy

A ship's engine-room manual on a largely automated vessel. Most valves answer to the control
system — the manual lists them so the engineer knows what moved without a hand on it (`[SYSTEM]`),
and which interlocks will refuse an order (`[GATE]`). The few hand-operated valves get exact,
literal procedures (`[HUMAN]`, `[MANUAL-ONLY]`) — because when automation covers ninety percent,
the crew's skills atrophy exactly where the remaining ten percent lives. And the manual never
claims a gauge the engine room does not have: an honest gap beats a fictional control.

## 14. Teach-back

1. An SOP step says `[SYSTEM]` but you watched a person do it by hand yesterday. What is wrong,
   and what happens next?
2. Why does the numbering series never reuse a retired number?
3. The wholesale lender agreement is stricter than the regulation. Which wins, and which may it never be?
4. Who may approve an SOP you drafted, and what happens when the company is too small for that?

**Key:** 1 — a wrong `[SYSTEM]` tag is the §6.2 technical-accuracy failure: the manual claims a
machine control that is not there; the SOP is corrected by PR and the step re-tagged `[HUMAN]` or
`[MANUAL-ONLY]` (§2, §6). 2 — a reused number makes two procedures answer to one citation in old
files and exam records; numbers are permanent, retirement is a status (§4). 3 — the agreement
wins because it may be stricter than the rule, never looser (§9 precedence, item 2). 4 — not you
(§6 mirrors `policy-ops`); in the single-operator phase it is self-approved **and recorded as
such** — an honest weak control beats a fictional strong one (§6).

## 15. Change log

*(References inside dated rows below use this file's pre-2026-08-23 section numbers — rows are
records and are not rewritten; the 08-23 row maps the renumber.)*

| Date | Change | By |
|---|---|---|
| 2026-08-19 | Manual established; charter, template, register and freshness guard created. | Founder |
| 2026-08-20 | Correction + landing. Of the four items the row above claims, **only this charter existed** — it sat untracked in the primary checkout (snapshot: `wip/sop-manual-draft-2026-08-19`), where it silently blocked every push via the pre-push `kb-index` check. Landed as indexed DRAFT per founder decision: template / RACI / freshness-guard references rewritten as planned items; Selling Guide A3-3-01 quotes downgraded to ⚠️-flagged paraphrase pending procurement into `docs/fannie-mae/`. Today's pass verified citations and existence claims only — §2's per-control `[SYSTEM]` claims still await the §5.2 technical accuracy review, which is why status remains DRAFT. | Founder-directed hygiene session |
| 2026-08-23 | Feynman restructure (founder-directed): sections reordered/renumbered (old §3–§8 → §4–§9, change log → §15), new §3 (day-one usage), §10–§14 (prove-it, failure modes, unknowns, analogy, teach-back). No rule changed. One factual correction: §5's claim that this charter is covered by `doc-freshness-guard.cjs` was false — it is not in the guard's `REQUIRED` list and never has been (`git log -S 'SOP-000' -- scripts/doc-freshness-guard.cjs` → empty). Status remains DRAFT, unsigned. | Founder-directed session |
