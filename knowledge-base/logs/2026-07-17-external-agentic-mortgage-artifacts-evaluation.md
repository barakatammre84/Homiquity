# External agentic-mortgage artifacts — evaluation — 2026-07-17

> Dated, immutable snapshot (TEAM_PRACTICES §2). Never rewritten; supersession goes in a banner here.
> Authority: adjudicates external artifacts against **code** per the KB precedence rule ("code wins
> over any doc on a stale fact" — [L1 §7](../L1_VISION_AND_SCOPE.md)). Verdicts below cite code, not docs.
> House precedent: [2026-07-12 external strategy adjudication](2026-07-12-external-strategy-adjudication.md),
> the chrome-extension verdict, and the airuleset decision — extract what survives contact with the
> code, reject the rest with reasons, record both.

The founder asked whether three public "agentic mortgage" artifacts can help Homiquity. All three
were cloned and read in full on 2026-07-17 (every skill/lab/hook file, not just READMEs), and every
claimed Homiquity gap below was verified against this repository before being recorded.

1. **IBM `ai-agent-for-loan-risk`** — LangGraph/watsonx single-agent loan-risk demo
2. **Confluent `workshop-mortgage-underwriting-agentic-system`** — Kafka/Flink "Streaming Agents" underwriting workshop
3. **Lendtrain `lendtrain/mortgage`** (mirrored on davepoon/buildwithclaude) — a licensed broker's
   consumer refi funnel shipped as a Claude Code plugin. ⚠ **PROPRIETARY license — ideas only,
   zero text/table/code copying.** Reviewed: 5 skills, the 1200-line `/refi-quote` workflow, 4
   hooks, MCP + org-config.

## 1. Artifact verdicts

| Artifact | What it actually is | Verdict | Why (evidence) |
|---|---|---|---|
| IBM | ~650-line single-file LangGraph demo: 4 toy tools (3 hardcoded customers, **random fallback values**), 20-line risk matrix, 3-tier rate lookup; optional RAG over two 1-page policy PDFs; README self-declares it broken since the mistral-large deprecation | **Adopt nothing; one idea extracted** (§2-A) | Its thesis — "rely on LLMs to reason… instead of rules" — is barred from our decision path (Reg B doctrine; CI-enforced: `tests/complianceInvariants.test.ts` `DECISION_PATH_MODULES` × `AI_IMPORT_PATTERNS`). Exhibits: its policy PDFs contradict its own coded rules (PDF 675–749/good-standing=Medium, rates 3.175/4.885/6.325% vs code 550–750=medium, 3/5/8%) — the drift failure mode our `ResolvedPolicy` fingerprint design prevents; it logs its API key at startup |
| Confluent | Terraform-provisioned Confluent Cloud + Flink + Postgres CDC + Bedrock (`claude-opus-4-5`). Lab 1: stream enrichment into a data product. Lab 2: `CREATE AGENT` in Flink SQL — Agent 1 scores fraud/credit risk; Agent 2 **makes the approve/reject decision, sets the interest rate, and auto-emails the acceptance/rejection letter to the applicant** via a Gmail/Zapier MCP tool | **Do NOT implement** | Decisioning half is an ECOA anti-pattern: the auto-emailed rejection **is** an adverse-action notice (ECOA §1002.9/FCRA) — ours is a regulated, staff-gated path (`server/services/adverseActionDelivery.ts`; autopilot `decisionRelay` routes `denied` to staff only) and it collides with the autopilot doctrine (agent pre-flights, **lender decides**). Demo-rigor tells: prompt allows DTI "1–600%", their "DTI" is loan÷income (LTI) mislabeled, `WHERE property_value < 500000` silently drops applications, agent `status` never checked, borrower PII through Gmail/Zapier. Streaming half is wrong-sized: 3 new vendors to replicate in-process semantics we already have (fact change → `recalculateDecision` → immutable `decisionSnapshots`) |
| Lendtrain | Real licensed broker (Atlantic Home Mortgage, NMLS #1844873, 10 states) distributing a refi-quote funnel as a Claude plugin: structured interview, statement extraction, FHA Streamline/VA IRRRL detection + seasoning math, hosted pricing MCP, staged TRID/ECOA disclosures, defense-in-depth hooks | **Review-only (proprietary); best guardrail architecture of the three; exposed 3 real gaps in us** (§2) and validated 7 of our designs (§3) | Their hooks: input-side SSN/DOB regex block (`UserPromptSubmit`), pre-tool licensing/LTV gates, post-tool suppression of wholesale `basePrice`, stop-hook required-disclosure checks. Content is good-not-perfect: blanket "FHA MIP is permanent" ignores the ≤90%-LTV 11-year cancellation — reinforces our verify-against-primary-sources rule |

## 2. Homiquity gaps confirmed (each verified in code before being claimed)

**A. No AI narration of our deterministic risk outputs** *(pointed at by IBM's "explain the risk
per policy" interaction and Confluent's `agent_reasoning` column).* We compute structured risk
everywhere — `UnderwritingResult.rejectionReasons/reviewReasons`, `InstantDecision.reasons/
missingItems`, `PreUwFlag[]`, `predictiveEngine` risk/positive factors, readiness `blockers[]` —
but no code narrates or explains them. **Action: staff-facing advisory "file risk brief"** (LLM
narrates, never calculates; echo-only number validation; `internal_only` classification;
deterministic fallback; CI import invariant keeps it out of the decision path). Grounded in the
engine's own `ResolvedPolicy` snapshot — deliberately *not* IBM's RAG-over-PDFs, per the drift
exhibit above. Ships with governance inventory row M-7.

**B. Coach rails are output-side only** *(exposed by Lendtrain's `guard-sensitive-data.sh`).*
`findStreamingHardBlock` + `applyCoachLintFilter` (`server/services/coachingService.ts:1040-1107`)
police what the model *says*; nothing polices what the borrower *pastes*. A pasted SSN today
enters model context and the `ai_interactions.prompt` log verbatim (grep-verified: no input guard
in `server/routes/coach.ts` / `coachingService.ts`). **Action: input-side sensitive-data guard**
before `runCoachTurn` — no model call, no raw-text logging, canned secure-upload reply.

**C. Coach has no structured first-contact disclosure** *(their compliance skill mandates a 5-part
one).* `client/src/pages/education/AICoach.tsx` discloses AI-ness via branding + an offline-mode
banner only. **Action: static (not model-generated) disclosure copy** — AI identity, educational-
guidance limitation, `companyNmlsDisplay()` + Equal Housing. Statutory scoping of emerging
state AI-disclosure laws → counsel, not from memory.

**D. Company licensed-state footprint is not modeled anywhere — the most valuable find.** What
exists is adjacent-but-different: per-wholesale-product `allowedStates`
(`server/services/lenderMatchingEngine.ts:123` — *product* eligibility, not *our brokering
authority*) and the prelaunch gate (a *time* gate, not geography). `client/src/pages/public/
Disclosures.tsx:21` — "State licensing list intentionally omitted until real licenses are issued
(roadmap F1)" — is **now stale**: F1 issued (NMLS #427468 renders via `companyNmlsDisplay()`) but
the State Licensing card still says licensing is in process and lists no states, and no
quote/solicitation surface checks property state against our license footprint. Risk: unlicensed-
brokering exposure under state SAFE Act implementations. **Action (blocked on founder):**
`LICENSED_STATES` in `shared/companyIdentity.ts` with the same light-up contract as
`companyNmlsDisplay()`; fix the Disclosures card; gate intake/pre-approval/rate paths (incl. the
MCP `get_best_execution_rates` zip input). The state list comes from the founder and NMLS Consumer
Access — never guessed; activity scoping (solicitation vs education) verified against
`docs/nmls/` per CLAUDE.md.

## 3. Validations — where the house doctrine held up against independent implementations

- **Rate-figure fabrication**: banned at the source — the coach prompt forbids stating
  rates/APR/points in chat (`coachingService.ts:614`); stronger than Lendtrain's post-hoc phrase lint.
- **Reg N**: hard-block → full-message REPLACE, streaming-aware and sentence-bounded
  (`coachingService.ts:1058-1107`), Reg Z trigger terms log-only with citations
  (`shared/compliance/loCommsLint.ts`).
- **Extraction prompt-injection posture**: documented untrusted-output pipeline
  (`server/extractionService.ts:252` — adversarial-document rationale; Zod clamps, consistency
  checks, confidence downgrades, human-review threshold).
- **NMLS identity**: `shared/companyIdentity.ts` single source, light-up-only-when-licensed —
  same "compliance-hardcoded NMLS" philosophy as theirs, better engineered.
- **Static disclosure discipline**: NMLS/Equal Housing in `Footer.tsx` + key surfaces;
  estimate/subject-to-change language on rates + pre-approval pages.
- **Honest recommendations**: our coach recommends no products at all — stricter than their
  score-threshold branching (which is itself a good pattern; see §5).
- **Wholesale-pricing secrecy**: structural — the server strips lender identity/economics before
  the borrower sees an offer (`shared/borrowerOfferView.ts`) vs their prompt-level "never show
  `basePrice`". Prompt-level secrecy is not a control; ours is the stronger design.

## 4. Binding rejections (apply to all future proposals of this shape)

1. **No LLM in the decision or pricing path, ever** — Reg B doctrine, CI-enforced. An LLM may
   narrate a deterministic outcome; it may not produce, adjust, or gate one.
2. **No auto-sent borrower decision communications.** Anything that functions as an adverse-action
   notice goes through the regulated path with staff in the loop.
3. **No vendoring from these repos** — IBM/Confluent are inferior to shipped code; Lendtrain is
   proprietary.
4. **No new agent frameworks/stacks for this** (LangChain/LangGraph, watsonx, Bedrock detour,
   Confluent/Flink/CDC) — the hand-rolled Anthropic loop and in-process event flow are ahead and
   right-sized.

## 5. Parked register (tracked, not drift — each with its reopen gate)

- **FHA/refi program depth** — FHA exists in our schema as a product enum only. Lendtrain maps the
  needed content: streamline detection, 210-day/6-payment seasoning, UFMIP 1.75% + refund-netting
  schedule, HUD 4000.1 max-loan worksheet, MIP-permanence nuance. Reopen gate: refi funnel becomes
  a priority → source HUD 4000.1 + VA Lenders Handbook into `docs/` first
  (no-citation-no-implementation), then build from primary sources.
- **Refi recommendation packaging** — weighted transparent score + "present honestly, don't
  proactively push below threshold" branching; UDAAP-friendly pattern for our refinance calculator
  someday.
- **Plugin-marketplace distribution as borrower acquisition** — a licensed broker is live in the
  Claude plugin marketplace today; battlecard entry + possible post-F1 Homiquity experiment
  (founder + counsel; pre-launch gate applies).
- **Deterministic fraud/loan-stacking pre-screen** (from the Confluent pass) — payment-failure
  patterns, utilization+defaults co-occurrence, concurrent-application detection, as
  MANUAL_REVIEW-routing signals. Low priority: DU/LPA + wholesale lenders run their own fraud
  tooling. Nearest existing code: `detectSignificantDeposits`.

## 6. Actions

1. **This log's PR** (`claude/external-artifacts-adjudication`): this memo + KB index line +
   roadmap singles A4/A5.
2. **Risk-brief PR** (`claude/staff-risk-brief`): gap A build + `MODEL_RISK_GOVERNANCE.md` M-7 row
   (and the stale M-1 Gemini row corrected to the shipped Claude extraction engines).
3. **Coach safety PR** (`claude/coach-input-guard-disclosure`): gaps B + C; TEAM_PRACTICES §9
   security-review flag.
4. **Licensed-state footprint PR** — gap D, **blocked on founder input** (state list + license
   numbers); engineering is small once supplied.
