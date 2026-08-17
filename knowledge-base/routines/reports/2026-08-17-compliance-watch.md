# Compliance Watch — 2026-08-17 (Mon, founder-triggered; regular slot is Tue 13:21)

**STATUS: WARN** — the ladder's first verification run landed cleanly (8 rows verified or
converted, 1 draft produced, no posture regression), but a mandatory upstream is dark: **Evening
Triage has never produced a report** — and it is both the consumer of this routine's ⛔ list and
the roadmap's only authorized editor. Second WARN driver: five regulatory-ledger entries whose
verification is network-blocked cross their review interval within 1–6 days.

R1 invocation: explicit founder trigger ("run the compliance watch now too") via a scheduled-task
prompt naming this routine. Guard passed: `.claude/skills/compliance-watch/SKILL.md` present on
`origin/main` (followed via `git show` — absent from the shared checkout, which sits on a peer's
branch). Run worktree `routine/compliance-watch-2026-08-17` off `origin/main` @ `4d7d919`.
No `REGISTER.md` claim taken (no code written); active claims read (one: financial-audit, money
paths — no overlap).

---

## ⛔ Human actions — hardest first, each a five-minute decision

| # | Action | Unblocks | Why this order |
|---|---|---|---|
| 1 | **In NMLS: who originates?** Check Manage People → relationships/sponsorships. Record whether an IL-licensed MLO with an **approved sponsorship** exists (name + individual NMLS ID). The guidebook at Ch. V p.111 indicates an approved sponsorship is what denotes supervised licensed activity, and a company can only sponsor in states where it is licensed. | CW-0.3 | The answer may be a launch blocker: if no sponsored IL MLO exists, nobody can originate the first Illinois loan regardless of every other row. Discovery, not paperwork. |
| 2 | **Same NMLS login, four record pulls:** (a) NMLS Consumer Access — what does #427468 / IL license #3423789 actually show (record scope on CW-0.1); (b) MU1 — control persons/qualifying individuals/disclosure answers on file (CW-0.2); (c) surety bond on file? amount + renewal (CW-0.5); (d) financial-statement / net-worth license items shown (CW-0.6). | CW-0.1, 0.2, 0.5, 0.6 | One session, four reads, five ladder rows stop being blocked. Do not infer any of these from the license having been issued. |
| 3 | **Download the Illinois checklist(s)** from the NMLS Resource Center → "Licensing Checklists, Requirements and Fees" (named at Guidebook Ch. I §C p.13), incl. the MCR page's SSSF state list. The Resource Center is unreachable from sessions (two attempts today returned empty JS shells) — only you can fetch it. Hand the PDFs to a session to land under `docs/nmls/` (routines cannot write `docs/**`). | CW-IL.1, IL.2, IL.3, SSSF question in the MCR draft | Every Illinois-specific row is honestly empty until this lands; state law controls over the guidebook. |
| 4 | **Confirm the first Mortgage Call Report obligation in NMLS and calendar it.** Draft: [`knowledge-base/compliance-watch/drafts/2026-08-17-mcr-q3-2026-prep.md`](../../compliance-watch/drafts/2026-08-17-mcr-q3-2026-prep.md). Computed: Q3 2026 RMLA due **2026-11-14** (p.126 rule); confirm the date NMLS displays, confirm Standard filer rendering, note the FC calendar-vs-fiscal wording variance (p.126 vs p.128) escalated in the draft. | CW-0.4 | Deadline-bearing and wholly preparable — the draft turns it into a checklist. |
| 5 | **Reg Z source-text procurement** (recurring ask; procedure in `docs/reg-z/README.md`): 12 CFR 1026.36(d)(1)-(2), 1026.32(b)(1), 1026.19(e)(3), plus FCRA 1681s-2 and CROA 1679b texts. Authoritative hosts are network-blocked from sessions; 5 ledger entries carrying "VERBATIM VERIFICATION PENDING" hit their review dates within 1–6 days and no session can clear them. | 5 of the 9 due-soon ledger entries; retires a standing flag | Same procurement pattern as the CDIA manual: "still absent" is a founder ask, not a failure to fix. |

---

## Summary

First verification run over the seeded ladder: six company-wide and three Illinois rows were
checked against the NMLS Policy Guidebook 2026.03.31 text layer, moving 7 of 10 rows from
`unverified` to cited `blocked-founder`/`drafted`/`in-progress` — every remaining blocker is a
five-minute founder lookup, consolidated into the five asks above. The run's one draft is the
Q3-2026 Mortgage Call Report preparation sheet (first RMLA computed due 2026-11-14; the
guidebook's own p.126-vs-p.128 FC deadline wording variance is escalated, not harmonized). The
Phase 2 read-only gap check found no regression: company identity stays single-sourced with the
light-up NMLS display, the Disclosures state card and adverse-action creditor block are intact,
and the only hardcoded-id hits are a comment and per-MLO dynamic fields. The regulatory ledger
passes its freshness gate today (59/59 in interval) but 9 entries fall due within 14 days, 5 of
them unverifiable from any session because the source hosts are blocked — that is ask 5. WARN
because a mandatory upstream (`evening-triage`) has produced zero reports since the suite's
2026-08-12 re-registration — this routine's ⛔ hand-off channel — and because those ledger flags
begin aging past-due this week without founder action.

---

## Evidence

### Guard, worktree, boards

```
$ git cat-file -e origin/main:.claude/skills/compliance-watch/SKILL.md && echo PRESENT
PRESENT
$ git diff --stat origin/main -- .claude/skills/compliance-watch/   # (checkout lacks it)
 .claude/skills/compliance-watch/SKILL.md | 140 -------------------
$ git worktree add .claude/worktrees/compliance-watch-2026-08-17 -b routine/compliance-watch-2026-08-17 origin/main
HEAD is now at 4d7d919
```

`REGISTER.md` active claims: one (`/financial-audit`, money paths) — no overlap with
`knowledge-base/compliance-watch/**`. `SESSION_CLAIMS.md` is a pointer stub (absorbed 2026-08-12).

### Missing upstream (WARN driver 1)

```
$ git log --all -- "knowledge-base/routines/reports/*evening-triage*"
(empty — no evening-triage report has ever been committed on any branch)
$ ls knowledge-base/routines/reports/
2026-08-12-{lender-delivery-gate,sprint-blitz,wiring-audit}.md
2026-08-17-{launch-gate,refactor-radar,vendor-procurement}.md README.md
```

CHARTER §3 registers Evening Triage daily at 18:40; §4 makes it the sole roadmap editor and this
routine's ⛔ consumer. Peers have produced reports on 2026-08-12 and 2026-08-17; evening-triage
never has. (CHARTER §3 does note a closed laptop defers runs — but zero reports across both
active days is a registration-or-execution question, not a scheduling gap. Ticket CW-T1.)

Upstream that does exist and was read: `2026-08-17-vendor-procurement.md` (STATUS: FAIL, DNS
email-auth) — its ⛔ 5 (F3 credit vendor + FCRA end-user certification package) is
compliance-adjacent and deliberately not duplicated here; vendor lane owns it.

### Guidebook verification (NMLS Policy Guidebook 2026.03.31, PDF text layer via pypdf per `docs/nmls/README.md`)

README inventory check: the README promises exactly one document (the 201-page guidebook);
`pypdf` confirms 201 pages present. **No promised document is missing.** Chapter map spot-checked:
Ch. II @p.18, Ch. V @p.89, Ch. VII @p.120, Ch. VIII @p.126, Ch. IX @p.136 all match the README.
Verification ran on the text layer only — any figure-borne content is outside scope (R3).

Verbatim extracts backing the ladder rows (PDF page numbers):

- p.13 (Ch. I §D, CW-0.1): "The unique identifying number is different than a license number,
  which will be provided by a regulatory agency."
- p.13 (Ch. I §C, CW-IL.1): state requirements live on the "Licensing Checklists, Requirements
  and Fees page on the NMLS Resource Center."
- pp.47–48 (Ch. II, CW-0.2): ACN event list — Legal Name, Main (Corporate) Address, Other Trade
  Names, Legal Status, Affiliates/Subsidiaries, Direct and Indirect Owners/Executive Officers,
  Qualifying Individuals.
- pp.107–111 (Ch. V, CW-0.3): access → relationship (incl. W-2 classification + work-remote
  status) → sponsorship; "A company can only sponsor licenses in states where the company is
  also licensed or registered." (p.111)
- pp.126–129 (Ch. VIII, CW-0.4): "The MCR is due 45 days from the end of each calendar quarter"
  (p.126); brokering FC "no later than 90 days from the calendar year end" (p.126) vs Standard
  filers "no later than 90 days after the fiscal year end" (p.128) — **variance confirmed
  verbatim, escalated per R4**; RMLA per state "even if there was no activity during the
  reporting period" (p.129); Expanded MCR = GSE sellers/servicers/Ginnie issuers only (p.127).
- p.136 (Ch. IX, CW-0.5): "State regulations define the specific surety bond requirements (e.g.
  amount of coverage)…", SAFE Act 12 USC §5104(b)(6).
- p.120 (Ch. VII, CW-0.6): annual FS "within 90 days of their fiscal year end"; most-stringent
  standard rule (pp.120, 122).

### Resource Center unreachability (CW-IL.1/IL.2 stay content-unverified)

Two fetches on 2026-08-17 — `https://mortgage.nationwidelicensingsystem.org/` and
`…/slr/Pages/default.aspx` — both returned effectively empty pages ("Home" navigation shell, no
content). Consistent with the standing note that the Resource Center may be unreachable from a
session. No Illinois requirement was asserted from any other source.

### Standing-claim dating (R7)

```
$ git log -S "427468" --format="%h %ad %s" -- shared/companyIdentity.ts | tail -1
b94a6f8 2026-07-13 feat(launch): F1 go-live — set real NMLS #427468, open the prelaunch gate (#154)
$ git log -S "3423789" --format="%h %ad %s" -- shared/companyIdentity.ts | tail -1
1db9361 2026-08-05 feat(launch): go-live prep — creditor address, IL license number, gate-aware sitemap (#419)
$ git log -1 --format="%h %ad %s" -- shared/companyIdentity.ts
acf7e2e 2026-08-06 fix(seo): canonical host is www — the apex resolves to nothing (#423)
```

CW-0.1's 2026-08-17 dry-run correction was re-dated and built upon, not re-derived.

### Phase 2 gap check (read-only) — no regression

- Identity single source: `shared/companyIdentity.ts:120-139` (`LICENSED_STATES=["IL"]`, license
  #3423789); render surfaces: `client/src/components/Footer.tsx:78` (light-up
  `companyNmlsDisplay()`), `client/src/pages/public/Disclosures.tsx:119`
  (`LICENSED_STATE_DETAILS` map), + ContactCard/AICoach/Waitlist/PartnerWaitlist.
- Adverse-action creditor block: `shared/companyIdentity.ts:22-26` (Reg B §1002.9(b)(1) name+
  address rationale in-file).
- Pre-license gate: `server/services/prelaunchGate.ts:26-30` — explicit `PRELAUNCH_GATED` flag OR
  fail-safe (production + `isCompanyNmlsPending()`). Architecture intact; NMLS id set → the
  pending-based gate is open by design.
- Hardcoded-id sweep: `grep -rn "427468\|3423789"` outside `companyIdentity.ts` hits only
  `server/services/ausSubmission.ts:315` — a comment; `:318` reads `COMPANY_IDENTITY`. The four
  client `NMLS #` literals (`LoanTeamCard:91`, `ReferralLanding:162`, `AgentCoBranding:293`,
  `PartnerLanding:175`) render per-MLO dynamic ids — the SAFE-Act individual identifier, not
  company drift.

### Regulatory ledger freshness (WARN driver 2)

```
$ node scripts/regulatory-freshness.cjs   (exit 0)
Regulatory ledger fresh: 59 entries verified within interval (9 due for review within 14 days)
SOON regz-1026-36d2-dual-compensation: due in 1d       (VERBATIM VERIFICATION PENDING)
SOON regz-1026-32b1-points-and-fees-floor: due in 1d   (…PENDING)
SOON trid-1026-19e3-fee-tolerance: due in 1d           (…PENDING)
SOON regz-1026-36d1-referral-commission-payout: due 5d (NEITHER VERIFIED)
SOON regz-1026-36d2-consumer-paid-platform-fees: due 6d (NOT VERIFIED)
+ fcra-1681s2 (5d) · regv-1022-43 (5d) · cdia-metro2 (5d, procurement) · croa-1679b (5d)
```

The blocked-network condition is recorded in the entries themselves; `docs/reg-z/` still holds
only its README (shopping list). Per rails, these stay **flagged, never asserted**, conservative
direction only. The CDIA row is rent-reporting-watch's standing procurement ask — referenced, not
duplicated.

---

## Proposed tickets — for Evening Triage to land

1. **CW-T1 — Evening Triage has never run: verify its registration, then its execution.** Zero
   reports on any branch since the 2026-08-12 suite re-registration while six peer reports landed.
   Check the scheduler entry per CHARTER §11 (`cronExpression` present, not a one-shot `fireAt`),
   then its run history. Until it runs, this routine's ⛔ hand-off channel and the roadmap's only
   authorized editor are both dark.
2. **CW-T2 — Reg Z/FCRA/CROA verbatim-text procurement** (⛔ 5): land the cited CFR/USC texts in
   `docs/reg-z/` per its README procedure so the five network-blocked ledger entries become
   verifiable in-session before they age past-due this week.
3. **CW-T3 — Create the `docs/nmls/` state shelf when ⛔ 3's downloads arrive** (e.g.
   `docs/nmls/states/il/` + README inventory rows, mirroring `docs/fannie-mae/`), so CW-IL.1–3
   become citeable rows instead of founder-memory. Human-landed — `docs/**` is off-limits to
   every routine.

---

STATUS: WARN
