# Page-by-Page UI Audit

Audited 2026-07-04 against `main` (42eb5c3). Status legend:
✅ on-system · 🟡 partially migrated / minor issues · 🔴 off-system or blocking issues.
Severity: **S1** blocks trust/conversion or compliance · **S2** visible quality gap · **S3** polish.

"Off-palette" = uses legacy emerald/amber/sky/etc. Tailwind hues instead of the Obsidian Indigo
ramp + semantic tokens (verified by grep; 60 of ~130 client TSX files still match).

## Public / acquisition

| Page | File | Status | Top issues | Severity |
|---|---|---|---|---|
| Landing | `pages/public/Landing.tsx` | ✅ | Hero migrated (roadmap #12 done). Verify trust-indicator claims stay truthful pre-license (NMLS "PENDING") | S1 (claims) |
| Rates hub (6 pages) | `pages/rates/*.tsx` | 🟡 | Rate tables render but production pricing returns "no products" until demo rate sheet ships (roadmap #11) — an empty rates page is an S1 trust killer for a rates-led acquisition strategy | S1 |
| Affordability check | `pages/public/AffordabilityCheck.tsx` | ✅ | Entry commitment device works; ensure result screen hands off into `/apply` with context preserved | S2 |
| Login / Signup | `pages/public/Login.tsx`, `Signup.tsx` | 🟡 | No forgot-password path exists yet (roadmap #2) — a locked-out borrower mid-transaction is an S1 support event | S1 |
| Disclosures / Terms / Privacy | `pages/public/*.tsx` | 🟡 | Shells exist; final text needs legal review (roadmap #26). Plain-language summaries missing | S2 |

## Pre-approval funnel (the crown jewel — protect it)

| Page | File | Status | Top issues | Severity |
|---|---|---|---|---|
| /apply funnel | `pages/lending/PreApproval.tsx` + `funnel/*` | ✅ | Deterministic state machine, autosave + resume, FCRA soft-pull gate, VA zero-down routing, "3 minutes, no hard credit check" framing — this is the reference implementation. Issues: (1) autosave indicator is 10px text at opacity 50 — too quiet to earn the trust it's designed for; (2) no per-step "time remaining" though total estimate is promised on intro; (3) only the funnel emits `form_step_complete` — other forms are dark | S3 / S3 / S2 |
| Pre-approval result | `pages/lending/PreApproval.tsx` (final) | 🟡 | Moment of maximum emotion; verify the approved state uses semantic success token and offers letter download + one next step, not a wall of numbers | S2 |

## Borrower engine

| Page | File | Status | Top issues | Severity |
|---|---|---|---|---|
| Renter home (Incubator) | `pages/borrower/RenterHome.tsx` | 🔴 | HomeReadinessPassport child still legacy emerald/amber/sky (roadmap #13); two competing readiness scores on one screen (client-side % vs server /100 — roadmap #14) — contradictory numbers are a direct trust leak | S1 |
| Borrower dashboard | `pages/borrower/Dashboard.tsx` | 🟡 | JourneyTracker (center of page) off-palette (roadmap #15); task signal now scoped/grouped (roadmap #6 done) | S2 |
| Tasks / TaskDetail | `pages/borrower/Tasks.tsx` | ✅ | Milestone grouping shipped; keep ≤5 visible next steps as the invariant | S3 |
| Documents | `pages/borrower/Documents.tsx` | 🟡 | Off-palette accents; upload→condition auto-match shipped (L4) — surface "we matched this to X" confirmation to close the loop for the borrower | S2 |
| URLA (1003) | `pages/borrower/URLAForm.tsx` | 🟡 | Long-form; needs the funnel's chunking + autosave treatment (it's where SSN enters — reassurance copy matters most here) | S2 |
| Verification / IdentityVerification | `pages/borrower/Verification.tsx` | 🟡 | Off-palette; verification steps are peak-stress moments — apply calm-language patterns (see psychology-patterns.md §4) | S2 |
| EConsent / CreditConsent / HMDA | `pages/borrower/*.tsx` | 🟡 | Consent ledger wiring done (L1–L3); visual sweep pending. Do NOT reword legal copy during sweep | S2 |
| Messages | `pages/borrower/Messages.tsx` | 🟡 | Presence dots are decorative (no WebSocket, F9) — remove or wire; fake liveness is an anti-trust pattern | S2 |

## Lending / loan options

| Page | File | Status | Top issues | Severity |
|---|---|---|---|---|
| Loan options | `pages/lending/LoanOptions.tsx` | ✅ | LLPA "why your rate is your rate" decomposition shipped (L5) — this is a differentiator, make it the visual centerpiece. Anti-steering disclosure records on view (L3) | S3 |
| Loan estimate | `pages/lending/LoanEstimate.tsx` | 🟡 | Gated on eDisclosure consent (L2 done). LE is a regulated document — visual fidelity to the CFPB form matters more than brand styling | S2 |
| Pipeline / summary / comparison | `pages/lending/*.tsx` | 🟡 | Off-palette accents in comparison view | S3 |

## Broker / partner

| Page | File | Status | Top issues | Severity |
|---|---|---|---|---|
| Broker dashboard | `pages/agent-broker/BrokerDashboard.tsx` | 🟡 | Wired to referral data; off-palette stat tiles; commission figures should use tabular-nums financial type style | S2 |
| Referral landing / invites | `ReferralLanding.tsx`, `InviteGenerator.tsx`, `ApplyInvite.tsx` | 🟡 | Co-branding is the broker's trust asset — audit that agent identity (photo, NMLS#) renders on the borrower-facing invite | S2 |
| Agent pipeline / dashboards | `AgentDashboard.tsx`, `AgentPipeline.tsx` | 🟡 | Off-palette; empty states missing for zero-referral partners | S3 |
| Lender persona | (deferred) | — | Unbuilt by decision (partner-personas); don't audit until built | — |

## Staff / admin (ops)

| Page | File | Status | Top issues | Severity |
|---|---|---|---|---|
| Staff dashboard | `pages/staff/StaffDashboard.tsx` | 🔴 | Pastel KPI tiles off-system (roadmap #17); bare "My Queue (0)" empty states give no guidance (roadmap #22) | S2 |
| Borrower file | `pages/staff/BorrowerFile.tsx` | 🟡 | The ops workhorse — audit information scent: conditions, docs, and stage actions should be one screen, no tab-hunting | S2 |
| Task operations | `pages/staff/TaskOperations.tsx` | 🟡 | SLA timers exist in lib (`lib/sla.ts`) — verify queue sorts by SLA breach risk, not creation date | S2 |
| Admin dashboard | `pages/admin/AdminDashboard.tsx` | 🔴 | Pastel KPI tiles (roadmap #17); volume figures now real (roadmap #7 done) | S2 |

## Homeowner (Portfolio) & education

| Page | File | Status | Top issues | Severity |
|---|---|---|---|---|
| Homeowner dashboard | `pages/homeowner/HomeownerDashboard.tsx` | 🔴 | Whole page off-palette (roadmap #16); graduation hook works (roadmap #9 done) | S2 |
| AI Coach | `pages/education/AICoach.tsx` | 🔴 | Off-palette (roadmap #18); coach events tracked | S2 |
| First-time buyer hub | `pages/education/FirstTimeBuyerHub.tsx` | 🔴 | Off-palette (roadmap #18) | S2 |
| Calculators (4) | `pages/calculators/*.tsx` | 🟡 | Off-palette accents; calculators are SEO entry points — each needs a contextual CTA into /apply | S2 |

## Cross-cutting findings

1. **Accessibility (S1):** 2 `aria-label` attributes in the entire client. Icon-only buttons,
   progress bars, and steppers are invisible to screen readers. WCAG 2.1 AA is table stakes for a
   consumer financial product (and an ECOA-adjacent fairness signal). Roadmap #23 confirms this
   is known; it should outrank cosmetic sweeps.
2. **Palette debt (S2):** 60 files off-palette. Mechanical fix, one route per commit.
3. **Dark mode is undecided (S2):** full `.dark` token set exists but swept pages aren't tested
   against it (roadmap #21). Decide: ship it or strip `dark:` variants. Cheapest decision first.
4. **Testability (✅):** 109 files carry `data-testid` — visual regression + E2E ready.
5. **Empty states (S2):** strong on RenterHome, absent on staff views and partner dashboards.
