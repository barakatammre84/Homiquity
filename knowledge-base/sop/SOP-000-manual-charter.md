# SOP-000 — Operations Manual Charter

> **Freshness:** last verified 2026-08-19 · review every 90 days
> **Code anchors:** `scripts/sop-freshness-guard.cjs`, `knowledge-base/governance/TEAM_PRACTICES.md`

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
   outsourced to us, and requires the lender to review "the third party's QC procedures so that the
   seller can determine if the party … meet[s] the seller's standards." It states plainly that the
   TPO must maintain **"a written QC plan"** and **"a process for resolving QC discrepancies and
   tracking corrective actions."** No manual, no broker approval. This is the commercial gate.
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

## 3. Numbering

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
role is filled, its work sits with the named **acting** holder in `RACI.md`.

## 4. Anatomy of an SOP

Every SOP uses `_TEMPLATE.md`. Two header lines are mandatory and machine-checked:

```
> **Freshness:** last verified YYYY-MM-DD · review every N days
> **Code anchors:** `path/one.ts`, `path/two.ts`
```

**Code anchors are the living-document mechanism.** They name the files that implement what the SOP
describes. `scripts/sop-freshness-guard.cjs` (wired into `pnpm checkup` and CI) fails the build when:

- an SOP is missing either line;
- an anchor path no longer exists on disk (the code moved, the SOP now describes a ghost);
- **an anchor file has been committed to since the SOP's `last verified` date.**

That last rule is the whole idea. You cannot change `server/services/trid.ts` and leave SOP-201
claiming yesterday's behaviour — CI goes red and names the SOP. The fix is to re-read the SOP,
correct it if the behaviour changed, and bump the date. Bumping the date without reading it is
possible, and is the one dishonesty this system cannot catch; see §7.

## 5. How an SOP gets written, approved, and changed

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

## 6. Review cadence

| Trigger | Action |
|---|---|
| Anchor file changes | CI flags it. Re-read within **5 business days**. |
| Regulatory change affecting the SOP | Re-read immediately. Compliance owns the signal (SOP-206). |
| Scheduled interval elapses | Re-read, re-date. |
| A file goes wrong in a way the SOP did not anticipate | Re-read *and* add the failure mode to §8. |
| Quarterly | COO walks the register: every SOP has an owner, every owner is a real person. |

Default intervals: **90 days** for compliance and money SOPs, **180 days** for everything else.

## 7. What this manual will not do

- **It will not make an untrue claim true.** Several SOPs describe steps against systems that are
  today **deterministic simulations** — DU/LPA findings, wholesale lender acknowledgements, asset
  verification. Each says so in bold at the top. When those become real integrations, the SOP
  changes; until then, no one may treat a simulated output as a fact about a borrower.
- **It will not substitute for counsel.** Open legal questions are listed, not answered. Anything
  marked `NEEDS COUNSEL` routes to the founder and General Counsel, never to an operator's judgment.
- **It will not catch a false attestation.** Re-dating an SOP without reading it, or writing
  "reviewed" in a PR without reviewing, defeats every guard here. That is a culture problem with a
  technical veneer, and the manual says so out loud rather than pretending otherwise.

## 8. Precedence

Where two sources disagree:

1. Statute and regulation.
2. The executed wholesale lender agreement (it can be stricter than the rule, never looser).
3. Fannie Mae Selling Guide, then job aids.
4. **The code** — on any question of what the system actually does, the code wins over any doc. A
   doc that disagrees with the code is a bug in the doc.
5. This manual.
6. Anyone's memory of how it was done last time.

## 9. Change log

| Date | Change | By |
|---|---|---|
| 2026-08-19 | Manual established; charter, template, register and freshness guard created. | Founder |
