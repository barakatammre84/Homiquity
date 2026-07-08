# [Feature Name] — Spec (L3)

<!--
  This is the L3 [Feature]_SPECS template. Copy it to `<FEATURE>_SPECS.md`, fill every
  section, delete these comments. L3 executes under L1 + L2:
    L1 VISION_AND_SCOPE.md  — decides scope (the cut-line)
    L2 COMPLIANCE_AND_LOGIC.md — the guardrails that override features
  A spec that doesn't cite the L1 loop it serves AND the L2 invariants it obeys does NOT merge
  (COMPLIANCE_AND_LOGIC §6 / TEAM_PRACTICES §7). Keep it to one page; link, don't restate.
-->

**Status:** draft · **Owner:** ⟨name⟩ · **Roadmap:** [CTO_ROADMAP #⟨NN⟩] · **Last updated:** ⟨YYYY-MM-DD⟩

## 1. Business Intent (the "why" — write this first)

⟨One paragraph: the friction this removes / why it makes the platform better, in the founder's
"certainty and speed" terms. If you can't tie it to a real user pain, stop — it may fail the
cut-line.⟩

## 2. Serves L1 loop

- **Core-loop link:** ⟨which link of borrower → pre-approval → MISMO package → wholesale delivery
  this advances — cite `VISION_AND_SCOPE.md` §2⟩.
- **Cut-line check:** ⟨does it serve the loop or unblock launch? If it's *peripheral*
  (listings/agent/homeowner), justify why it's in scope now instead of post-launch.⟩

## 3. Bound by L2 (compliance & logic) — the guardrails this MUST obey

| L2 invariant | How this feature satisfies it |
|---|---|
| ⟨e.g. I3 GSE delivery valid⟩ | ⟨e.g. every MISMO name/enum verified against `docs/fannie-mae/`, never from memory; U-escalations raised for anything unverifiable⟩ |
| ⟨I1 / I2 / I4 / I5 / I6 / I7 / I8 / I9 / I10 as applicable⟩ | ⟨…⟩ |

- **Security-review trigger?** ⟨Does it touch a `COMPLIANCE_AND_LOGIC` §4 surface — PII vault,
  auth/sessions, role gates, uploads, outbound messaging, PII-adjacent logging? If **yes**, name
  the required `/security-review` and note it blocks merge on unresolved CRITICALs.⟩
- **Regulated math?** ⟨If it introduces/changes a threshold/factor/enum, it carries a
  `data/regulatory/regulatory-ledger.json` citation in the same commit — no citation, no change (I2).⟩

## 4. Scope

- **In:** ⟨what this spec delivers⟩
- **Out (non-goals):** ⟨explicit exclusions so scope doesn't creep⟩

## 5. Design / execution

⟨The how, referencing existing patterns — don't reinvent. Cover as applicable:⟩
- **Server:** ⟨routes + services + the adapter seam; determinism/AI-free rules where relevant⟩
- **Data model:** ⟨`shared/schema/*` changes → hand-authored migration (`db:migrate`, never
  `db:push` — see `knowledge-base/handbook/app-guide/03-database.md`)⟩
- **Client:** ⟨pages/components; loading/empty/**error** states; role gates mirror the server
  (`isInternalStaffRole`, not `isStaffRole`)⟩
- **Contract:** ⟨request/response shape; who can call it⟩

## 6. Acceptance criteria (verifiable — write the test first)

⟨Given/When/Then, or "a failing test that then passes." Each criterion must be observable.⟩
- [ ] ⟨e.g. Given a complete file, When staff exports MISMO, Then the XML validates against the
  ULDD XSD in `docs/fannie-mae/` and SSN appears nowhere outside the delivery seam.⟩
- [ ] **Definition of Done** (TEAM_PRACTICES §5): `npm run check` clean · `npm test` green (new
  tests added to `vitest.config.ts`) · integration green on :5002 · live evidence in the PR ·
  env vars in `.env.example` + CICD.md · doc-sync line · security-review outcome recorded if §3
  triggered it.

## 7. Risks & escalations

⟨Anything needing founder/compliance sign-off before build or merge — e.g. an unverifiable MISMO
name (escalate per L2 §3), a new vendor DPA, a state-licensing dependency. Name it here rather
than deciding it silently.⟩
