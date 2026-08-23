# The Lender-Demo Ten — what actually gets us approved

> **Freshness:** last verified 2026-08-23 · review every 30 days
> **Verified against** `origin/main` @ `c8bb44f` — every claim below carries the command that
> produced it. **Authoritative:** [L1 §2 core loop](../L1_VISION_AND_SCOPE.md) and
> [routines/CHARTER.md §1](../routines/CHARTER.md) (they win on intent; **the code wins over both**).

## 1. The mental model

**The lending package is a sworn statement, not a form — and every gate we own checks spelling, not
truth.**

## 2. Explain it to a new hire

A wholesale lender will not talk to borrowers; it wants a finished folder. Our entire product is
building that folder — who the borrowers are, what they earn, what they owe, what the house is
worth — and handing it over. The lender's first question is not "is this folder well-formatted?"
but "is every sentence in it true?", because they buy the loan on the strength of our word.
Today our folder can be perfectly formatted and factually wrong at the same time, and nothing we
run will notice. That gap is what this document ranks.

## 3. Business intent (why this doc exists)

Founder direction, 2026-08-23: **the app is part of the lender-approval process.** We have
relationships, not paperwork. When we sit with a wholesale lender's Account Executive, they must be
able to drive a *live, real client application* end to end. The demo is the sales instrument, so
every screen on that path and every field in that XML is being read by the person deciding whether
to approve us as a TPO — and, before they sign, by their security reviewer.

This reverses the usual order. We are not building the platform because we were approved; we are
building it **to get** approved.

## 4. Mechanism — where a package can be wrong

```
 borrower intake ──► URLA completeness ──► AUS ──► broker submission readiness ──► MISMO XML ──► lender
                          │                              │                            │
                    can an ORGANIC                 3 gating stages             validateMISMOXML
                    client even get               (stage 4 informational)      = 11 substring checks
                    this far?  ── F-052 ──►                                          │
                                                                              xmllint (XSD)
                                                                              RECORDED, NOT ENFORCED
```

Two independent failure modes, and only one of them has a gate:

| Failure mode | Example | Caught by |
|---|---|---|
| **Malformed** — the shape is wrong | missing `NoteAmount` | `validateMISMOXML`, `xmllint` |
| **False** — the shape is right, the content is untrue | one `PARTY` carrying two people's incomes under one SSN | **nothing** |

## 5. The facts, with receipts

Run these from the repo root. Outputs are stamped at `c8bb44f`.

```bash
# The hard gate on submission is a substring check.
grep -c "xml.includes" server/mismo.ts
# → 7   (plus a 4-element loop = 11 checks total) @ c8bb44f

# Exactly one PARTY node is ever emitted, however many borrowers exist.
grep -n "children: \[buildPartyNode" server/mismo.ts
# → 1321:    children: [buildPartyNode(dto)], @ c8bb44f

# Personal info is keyed by borrower sequence. Employment is not.
grep -n "async getUrlaPersonalInfo\|async getEmploymentHistory" server/storage/urla.ts
# → 91:  async getUrlaPersonalInfo(applicationId, borrowerSequenceNumber = 1)
# → 171: async getEmploymentHistory(applicationId)                        @ c8bb44f

# Nothing in the product writes the employment vocabulary the validator requires.
grep -rn "employmentType.*previous" client/src server/routes --include=*.ts --include=*.tsx | wc -l
# → 0 @ c8bb44f

# Whole user rows — password hashes included — are returned to callers.
grep -n "borrower: r.users\|broker: c.users" server/storage/brokerReferrals.ts
# → 32:      borrower: r.users,
# → 147:      broker: c.users,                                            @ c8bb44f
grep -rn "passwordHash" server/storage/*.ts | wc -l
# → 0   (nothing anywhere strips it)                                      @ c8bb44f
grep -n "passwordHash" shared/schema/core.ts
# → 50:  passwordHash: varchar("password_hash"),                          @ c8bb44f
```

### 5a. The register is stale in the direction that wastes work

Four of the highest-severity open rows were checked against the code this session. All four are
**already fixed**; the register still lists them as open.

| Register says | Code says | Command |
|---|---|---|
| F-051 (P0) AUS recommendation is the literal `"Approve"` | reads the stored recommendation | `grep -c "mapAusRecommendation(application.ausRecommendation)" server/mismo.ts` → `1` |
| F-054 `LoanAmortizationType` hardcoded `"Fixed"` at `:812` | `:884` calls a real mapper that **throws** on unmapped values; `:812` no longer exists | `sed -n '197,211p' server/mismo.ts` |
| F-076 borrower APR is `rate + flat spread` | routes through the Reg Z Appendix J solver | `grep -c "calculateMortgageAPR" server/services/loanAnalysis.ts` → `2` |
| F-077 `calculatePMI` card overrides the PMI matrix | `calculatePMI` deleted; tombstone comment remains | `grep -n "calculatePMI" server/services/loanCosts.ts` → `651` (comment only) |

An independent audit this session put the total at **21 rows marked FIXED still filed under
`## Open findings`, plus 4 in an undocumented "fix landed, awaiting re-verification" state.**
`CTO_ROADMAP.md` §3.31 says "ten" — that count was written 2026-08-19 and eleven have accumulated
since.

**Consequence:** a top-ten drawn off that register sends roughly four days of work at code that is
already correct, and misses the P0 in §5b, which the register carries but the roadmap does not.

## 6. The Ten

Build order. One PR each, each shipping the test that is red on `main` and green on the branch
(`handoff/prompts/_RAILS.md` R4).

### Group A — stop the disqualifiers

**1. `F-0820-50` (P0) — password hashes in API responses.**
`getBrokerReferrals` returns `borrower: r.users` — the whole `users` row, `passwordHash` (scrypt
digest + salt) included. Two of the four affected endpoints reach non-employee third-party partner
companies. This is the register's only genuinely open P0, it is filed under Domain 13
(Security/PII) — **a domain that has never been reviewed** — and it is precisely what a lender's TPO
security review looks for.
*Fix:* explicit column selection; a test that fails if any response body contains `passwordHash`.

**2. `F-0818-04` — the consent attests to relationships we do not have.**
The borrower signs that their options came from *"the wholesale lenders with whom we regularly do
business"* while `server/consentGate.ts:81` computes `creditorsQuoted === 0`. That statement sits in
the package's own consent trail, and we are about to show that trail to the very lenders in question.

### Group B — the package must not lie

**3. Co-borrower blindness, both layers.**
(a) One `PARTY` is emitted for a two-borrower file while both employments ride under it — so the
package states one person earns both incomes, under one SSN, and `validateULDDCompliance` returns
`valid: true`. Authority is in-repo: `docs/fannie-mae/uldd-implementation-guide.pdf` p.14 — the
PARTY container repeats per borrower.
(b) **G-15:** the representative credit score ignores the co-borrower while counting their income.
A 760/600 pair prices and gates at 760 where B3-5.1-02 requires 600 — **clearing a 620 floor it
should fail.**

**4. Stop emitting guesses as facts** (F-055 / F-056 / G-16).
Occupancy → `PrimaryResidence`, purpose → `Purchase`, lien → `FirstLien`, marital → `Unmarried`,
`financedPropertiesCount` → `1` from an REO set the URLA cannot even capture. Escalation **U-22**
(ULDD Appendix D, 403 from this environment) blocks knowing whether these are hard conformance
failures — it does **not** block the honest fix, which is to emit nothing rather than a guess.

**5. The "emitted == stored" truth gate.**
Assert every material datapoint in the XML equals the row it came from — names, SSN-last4 *per
party*, each income to its earner, loan amount, rate, amortization, AUS recommendation.
`WORKFLOWS.md:32` already carries the instruction: do not re-run Workflow 3 until it gains this leg.
Finding `D-014` measured the cost of not having it — the script catches **3 of 9** registered
Domain 8 findings and **misses the P0**, because every assertion it makes is a schema assertion.

**6. Make conformance a real gate — and take U-25 to the meeting.**
XSD validation is recorded, never enforced, and degrades to `{skipped: true}` when `xmllint` is
absent. Promote it to blocking; make `xmllint` a hard startup requirement so it can never silently
skip. **Open question worth an agenda line:** the generator is `generateMISMO34XML`, but the only
schema in the repo is MISMO **3.0** (escalation U-25) — *ask the AE which vocabulary their ingestion
expects.* That is a question a lender can answer in ninety seconds and we cannot answer at all.

### Group C — an organic client must reach it

**7. Prior-employment capture (`F-052`).**
Nothing writes `employmentType: "previous"`, so any borrower under two years' tenure is hard-blocked
at submission readiness — and the block surfaces as a validation error, not an instruction.

**8. The e-consent orphan (`J-0820-01`).**
Every consent signed on `/e-consent` is written with `applicationId = null`, so no
application-scoped gate ever sees it: the Loan Estimate stays locked behind a consent the product
reports as complete.

### Group D — it must survive being watched

**9. The demo neither crashes nor lies on screen.**
`F-0820-20` — the staff Intelligence tab throws and unmounts the entire routed app (the server
returns an object, the client types it `FunnelData[]`); it has never worked in any commit.
`F-0820-51` — **1,663 of 1,723 task rows have `sla_due_at IS NULL`, and every one renders "green /
on time."** Plus the silent-success writes: the co-brand `PUT` that returns 200 and writes nothing,
the invite `resend` that sends no email, the `/compare-offers/:id` Confirm.

**10. An organic dress rehearsal — not a seeded one.**
Drive a real two-borrower purchase file through the actual UI end to end and produce the hand-off
bundle: validated XML + income-analysis JSON + both sha256 hashes + the readiness snapshot.
`routines/CHARTER.md` §1 is explicit about why this cannot be shortcut:
*"Green delivery suites hide the seed-vs-organic gap because the fixture is the seed."*
**A better seed makes the problem worse.**

### Item 0 — re-baseline first (half a day)

Reconcile `FINDINGS.md` and `CTO_ROADMAP.md` §3 against the code. Nothing on this list should be
built off a register with 21 mislabeled rows in it.

### Deliberately dropped: ARM (`F-053`)

Seven required fields captured nowhere, zero `INTEREST_RATE_ADJUSTMENT` containers in the emitter.
**Scope the demo to fixed-rate and make the refusal explicit on screen**, rather than spend two days
of a three-week sprint on it. Raise it with the AE as roadmap — not as a gap they discover.

## 7. Ten or twenty — the recommendation

**Ten to build now. But there genuinely is a second ten, and it is not optional — it is later.**

The Ten are on the **demo path**: what the AE clicks and reads. The second ten is a **TPO
due-diligence pack**, and this repo already proves it is required rather than hypothetical —
`sop/SOP-000-manual-charter.md` cites **Selling Guide A3-3-01: "no manual, no broker approval"**,
and that SOP is an unsigned DRAFT whose four content directories hold nothing but `.gitkeep`.

So the answer is a **sequence, not a number**:

| | What | When | Cost |
|---|---|---|---|
| **The Ten** | Gets the meeting, and survives it | Before the AE call | ~3 weeks at *"roughly one push a day"* (`TEAM_PRACTICES.md` §4) |
| **The second ten** | Gets us *approved* after the AE says yes | After the demo lands | The QC manual · `F-0819-01` adverse-action de-dup failing open · `F-0819-02` borrower-sequence-blind HMDA · the §1002.9 30-day clock with no completed-application timestamp · credit-consent expiry · **G-21** CLTV/HCLTV never computed while we market four IHDA DPA subordinate-lien programs in Illinois, our only licensed state |

Doing all twenty before the meeting makes it ~7 weeks and does not make the AE likelier to say yes.
`L1_VISION_AND_SCOPE.md` §3 already encodes this as the cut-line.

**The one input that flips this answer:** if a lender's onboarding runs its security/QC review
*before* the technical demo rather than after, the second ten moves on-path and the answer becomes
twenty. That is a question for the AE, and it belongs in the first call.

## 8. Where this breaks

| Trap | Where | Caught by |
|---|---|---|
| A package passes `xmllint` and states something untrue | `server/mismo.ts` | **Nothing** — that is item 5 |
| A green delivery suite proves only that the *seed* delivers | every Domain 8 test | **Nothing** — that is item 10 |
| This document itself goes stale the way the register did | this file | Its own §5 commands, re-run |
| U-22 / U-25 stay unanswered and items 4 and 6 look "done" | `FINDINGS.md` Escalations | Nothing automated — U-25 is an AE question |

## 9. What we do not know

- **Whether the six substituted data points in item 4 are hard conformance failures.** ULDD
  Appendix D is the only document that says, per data point, whether Fannie treats it as Required /
  Conditionally Required / Optional, and it returns 403 from this environment (U-22). The fix
  proposed — emit nothing rather than a guess — is correct either way, which is why it is not blocked.
- **Which MISMO vocabulary each wholesale lender's ingestion expects** (U-25).
- **Whether the lender's security review precedes the demo.** This is the single input that changes
  ten to twenty.

## 10. Analogy

`xmllint` is spell-check. Spell-check will happily approve *"The borrower earns $500,000"* when he
earns $50,000 — every word is spelled correctly and the grammar is fine. Every remaining defect on
our delivery path is a spelling-correct lie. Item 5 is the fact-checker we have never hired.

## 11. Teach-back checkpoint

1. A package validates clean against the XSD. Name two ways it can still be false.
2. Why does building a better demo seed make question A *harder* to answer, not easier?
3. The register lists F-051 as an open P0. What single command settles whether it is?
4. Why is item 1 (password hashes) ranked above every package-correctness item, when it has nothing
   to do with the package?

## 12. Go deeper

[L1 §2 core loop](../L1_VISION_AND_SCOPE.md) · [L2 invariants I1–I10](../L2_COMPLIANCE_AND_LOGIC.md)
· [routines/CHARTER.md §1](../routines/CHARTER.md) · [feature-review/FINDINGS.md](../feature-review/FINDINGS.md)
· [the 15-day sprint](LENDER_DEMO_SPRINT.md)
· [CEO business queue](../governance/CEO_BUSINESS_QUEUE.md)
