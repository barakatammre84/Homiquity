# End-to-End Workflows — Borrower & Operations

Grounded in the actual state machines: `client/src/funnel/preApprovalMachine.ts`,
`server/services/borrowerStateMachine.ts`, `shared/stageRequirements.ts`.

## Borrower workflow (discovery → post-close)

```
DISCOVERY                PRE-QUAL                 APPLICATION              UNDERWRITING            CLEAR TO CLOSE          POST-CLOSE
─────────                ────────                 ───────────              ────────────            ──────────────          ──────────
Landing / rates /   →    /apply funnel       →    URLA 1003 +         →   AUS + conditions   →    CD + funding       →    Homeowner Hub
calculators / educ.      (soft pull)              docs + e-sign            pipeline                                        (graduation hook)
```

### Stage detail with decision gates

**1. Discovery** — Landing, 6 rate pages, 4 calculators, education hub, AI Coach.
- *Gate D1 (email capture):* `EmailCaptureModal` — commitment device before deep content.
- *Handoff:* every calculator result and rate view must deep-link into `/apply` with context
  (loan purpose, price) pre-seeded. **Currently inconsistent — see roadmap UX-9.**

**2. Pre-qualification** — `/apply` funnel (reference implementation).
- Route is a pure function of answers (`computeRoute`); VA answer unlocks $0-down path and
  suppresses PMI guidance; self-employment injects the complex-income block.
- *Gate P1 (FCRA):* soft-pull consent required at `final` step; never persisted across sessions;
  written to consent ledger with IP/UA/disclosure hash at submit (L1 shipped).
- *Gate P2 (data):* zod schema must parse before submit.
- Autosave to localStorage + server draft when authenticated; resume on return.
- *Handoff:* pre-approval letter + account creation → borrower dashboard.

**3. Application** — URLA 1003 (`URLAForm.tsx`), document intake (`Documents.tsx`), e-consent.
- SSN enters here (server-side vault on main), not in the funnel — by design.
- *Gate A1 (ESIGN):* eDisclosure consent required before LE delivery (`requireConsent`, L2).
- *Gate A2 (anti-steering):* disclosure recorded when priced options shown (L3).
- Upload auto-matches to outstanding conditions → "submitted", never auto-cleared (L4).
- *Handoff:* stage advance gated by `assertStageRequirements` + `assertVerifiedForDecisioning`.

**4. Underwriting** — automated checks + manual review triggers.
- Simulated vendors (credit/VOIE/AVM/DU) until F3–F7 contracts; adapters throw if keyed.
- Scenario registry + compliance invariant tests + daily guardian loop protect correctness.
- *Borrower-visible:* JourneyTracker stage + grouped conditions ("3 documents needed").
- *Gate U1:* approval with no coherent loan amount routes to `under_review`, never a $0
  pre-approval (roadmap #7 fix).

**5. Clear to close** — final conditions, closing disclosure, funding checklist.
- *Gate C1:* all conditions cleared by staff (one-click stage advance when
  `checkPipelineProgress` says ready).

**6. Post-close** — graduation hook auto-surfaces Homeowner Hub with equity snapshot
(roadmap #9 shipped); refi-alert daily scan begins; referral prompt.

### Lifecycle architecture rule
Incubator (RenterHome) / Engine (borrower Dashboard) / Portfolio (HomeownerDashboard) are
**separate surfaces** — do not merge them in any redesign.

## Operations workflow

```
INTAKE              AUTO-UW              MANUAL REVIEW           QC/COMPLIANCE          FUNDING
──────              ───────              ─────────────           ─────────────          ───────
doc upload     →    rules engine    →    staff task queue   →    invariant tests   →    funding checklist
OCR/extraction      risk scoring         SLA timers              consent ledger         reconciliation
auto-match L4       exception route      audit trail             audit trail
```

- **Intake:** `extractionService.ts` parses uploads; extraction confidence surfaced to staff;
  documents auto-match conditions (L4) and notify assigned staff.
- **Automated UW:** scenario engine + LLPA pricing; exceptions route to manual queue.
- **Manual review:** `TaskOperations.tsx` queue; SLA policy in `client/src/lib/sla.ts` —
  **queue should sort by SLA breach risk (audit finding), not creation date.**
- **QC/compliance:** stage invariants (`shared/stageRequirements.ts`), consent ledger checks,
  daily scenario-guardian loop; regulatory watcher feeds `kb/regulatory-ledger.json`.
- **Funding:** checklist + reconciliation (manual today; wire confirmation integration is a
  post-contract item).

### Automation touchpoints (existing vs planned)

| Touchpoint | Status |
|---|---|
| OCR + metadata extraction on upload | ✅ built (`extractionService.ts`) |
| Upload → condition auto-match + staff notify | ✅ built (L4) |
| Stage-requirement enforcement at status seams | ✅ built (#7) |
| Consent enforcement middleware | ✅ built (L2) |
| Refi-alert + equity snapshot jobs | ✅ built (#9) |
| Lead intake API (`POST /api/leads`) | ❌ roadmap #8 |
| LO assignment engine w/ state-licensing gate | ❌ F8/F2 (blocked on business) |
| Real credit/VOIE/AVM/DU vendors | ❌ F3–F7 (blocked on contracts) |
| Quiet-hours + SMS STOP compliance services | ❌ roadmap #24/#25 (must precede any outbound SMS) |
