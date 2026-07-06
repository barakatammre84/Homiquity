# Armed Launch Charter — target EOD 2026-07-07

**Owner:** Amr (founder) · **Drafted:** 2026-07-05 · **Status:** active

This charter governs the July 7 launch push. It exists so that when the audit bites on
July 6, we execute a pre-agreed rule instead of holding an argument. Read it before
spinning up any team.

---

## 1. Launch definition (locked)

**Option 2 — Armed launch, gated until F1.**

- The public site is **live and deployed to production on July 7**, but shows a
  **pre-license experience only**: educational content + a **waitlist / lead-capture**
  surface. No mortgage solicitation reaches a stranger until F1 (NMLS licensing) clears.
- Everything commercial — the application funnel, live pricing, DU submission, lender
  delivery — is **built, proven, and behind a flag**, one config flip from going
  commercial the day F1 assigns a real NMLS ID.
- "Armed" means the thing behind the flag is *complete*, not just gated.

### Two dates, not one — this is the whole trick

| Date | What it gates | Contents |
|---|---|---|
| **Public-launch (July 7, fixed)** | What a stranger can reach | Hero + educational pages + **waitlist**. Small surface. |
| **Armed-completeness (must beat F1, NOT July 7)** | The commercial machine behind the flag | LS-10 lender adapter, L6 XSD validation, LS-6 prod reseed, CS1 SLA seeds. |

Because the public surface is small, **the date is cheap to hold** — if a
behind-the-gate item slips, it slips *toward F1*, never *past July 7*. The gate is the
shock absorber.

---

## 2. The date-vs-scope rule (the spine)

**Scope bends, date holds.** July 7 is fixed. A finding moves the date **only** if it is
one of these three blocker classes. Everything else → post-launch backlog.

**Blocker classes (only these move the date):**
1. **Borrower PII exposure or data loss** — PII outside `ssnVault`/`encryptionService`,
   in logs/Sentry/errors, or any path that can drop/corrupt borrower data.
2. **Illegal public claim or a gate leak** — a soliciting surface (funnel, live pricing,
   "apply/get approved" language, Reg Z trigger terms) reachable by an unauthenticated
   public user before F1; or a public claim that violates Reg N/UDAAP or SAFE Act
   advertising rules (verified against `docs/nmls/` + `docs/nmls-safe/`, not from memory).
3. **Silent lead/data loss in the waitlist** — the one thing the public surface *does*
   must not fail silently: a submitted waitlist lead that never lands.

If it's not one of these three, it is a backlog item. No live relitigation.

---

## 3. Build lane — serial, one executor (no parallel write-teams)

`main` deploys to prod on every push; the shared dev DB corrupts under concurrent
worktree pushes; the integration suite runs in serialized groups. **Do not parallelize
writes.** One executor, top to bottom.

- [ ] **BUILD-1 — Pre-license gated public mode + waitlist. ← July 7 BLOCKER, do first.**
      *This is the launch. It does not exist today.* Add a presentation-layer launch flag
      (env-based, like `INTAKE_PAUSED` but for the public *surface*, not just submit POSTs).
      When engaged: the public routes that solicit a mortgage transaction —
      `/apply` (funnel UI), the 4 persona LPs (`/refinance`, `/va-loans`, `/self-employed`,
      `/first-time-buyer`), `/rates/*` pricing pages, and any calculator that displays a
      priced result — are replaced by an educational + **waitlist** experience. Wire a
      lead-capture form to `POST /api/leads` (closes ARC-1: TrustedForm evidence,
      rate-limited, no Reg Z trigger terms, no approval language). Keep live: `/learn`,
      `/faq`, `/glossary`, `/privacy`, `/terms`, `/disclosures`, `/login`.
      **Acceptance:** with the flag on, no unauthenticated route renders a rate, a priced
      quote, or an "apply/get approved" CTA; the waitlist form creates a queryable lead;
      flag off restores the full commercial surface unchanged.
- [ ] **BUILD-2 — LS-10 lender submission adapter.** *Behind the gate; targets F1, not July 7.*
- [ ] **BUILD-3 — L6 XSD-validate the MISMO export + ULAD mapping audit.** *Behind the gate; targets F1.*
- [ ] **BUILD-4 — CS1 SLA seeds + LO-M16 VA PMI display fix.** *Behind the gate; post-launch-safe.*

---

## 4. Audit swarm — read-only, parallel, launches July 5

Read-only work has no merge/DB/deploy hazard, so it parallelizes cleanly. Each lane is a
separate agent with a scoped prompt and one acceptance question. **Every lane sorts its
findings into `BLOCKER` (one of the three classes) vs `BACKLOG` — that sort is the
deliverable**, due EOD July 5.

> Reference discipline for all lanes: verify against `docs/fannie-mae/`, `docs/nmls/`,
> `docs/nmls-safe/`, `kb/regulatory-ledger.json`, and the code — **never from memory**.
> Confirm any "X is missing/broken" claim against the code before filing it (the
> source-of-truth rule; the TRID #34 false alarm is the cautionary tale).

### Lane 1 — Gate integrity (depends on BUILD-1)
Prove the pre-license gate holds. Enumerate every public route, deep link, and API a
logged-out user can hit; confirm none renders a rate, a priced quote, the application
funnel, or mortgage-solicitation language while the flag is on. Hunt for orphaned routes,
cached client bundles, and authenticated-but-trivially-reachable paths.
**Acceptance:** a written list of every public-reachable surface, each marked
clean/leak; zero leaks, or each leak filed as a BLOCKER.

### Lane 2 — Public-word compliance
Every string a stranger sees vs. Reg N/UDAAP + SAFE Act advertising rules + `docs/nmls/`.
No Reg Z trigger terms without required disclosures, no approval/pre-approval language on
public surfaces, no "direct loans" (broker accuracy, #33), correct behavior while
`nmlsId` is `PENDING`. Include the waitlist copy and any lead-ack email.
**Acceptance:** every public string cited clean or flagged with the specific rule; claims
issues filed as BLOCKER, tone/polish as BACKLOG.

### Lane 3 — PII / security
Every path touching borrower data goes through `encryptionService`/`ssnVault` and writes
an `auditLog` entry. No SSN or full PII in logs, error messages, Sentry payloads, or
client-visible responses. Check the waitlist/leads path specifically (new public write).
**Acceptance:** each PII-touching path traced to its vault + audit entry, or the gap
filed as BLOCKER.

### Lane 4 — Regulated-math regression
Confirm citation discipline survived the 13-PR merge. Spot-check that the #29–#32 ledger
pattern is intact, no regulated scalar runs uncited, and the dual-path VA residual fix
(underwritingEngine.ts + underwritingNuance.ts both read by `complianceInvariants`) still
holds. Run the compliance test gate.
**Acceptance:** `complianceInvariants` green + a diff-level confirmation no uncited
regulated math entered in the merge; regressions → BLOCKER.

### Lane 5 — Ops readiness
Confirm migrations 0005–0008 are applied on prod, the rollback runbook is current, the
kill switch works, and the LS-2 env vars have a home. Verify `/api/health` responds.
**Acceptance:** a go/no-go ops checklist with each item confirmed or flagged.

---

## 5. Founder critical path (only Amr can do — no team moves these)

- [ ] **LS-2 — env vars in Vercel:** GCS bucket creds, `SENDGRID_API_KEY`/`FROM_EMAIL` +
      SPF/DKIM DNS, `SENTRY_DSN` + uptime monitor on `/api/health`. (~1h)
- [ ] **Push `ci.yml`** from a normal environment — the automation token lacks `workflow`
      scope. (~10 min)
- [ ] **LS-6 — supervised prod reseed** (destructive wipe-and-reseed; founder-supervised).
- [ ] **LS-4 — start F3 (credit vendor) + F6 (DU/LPA) applications** — vendor lead time
      runs in parallel with F1, not after it.

---

## 6. Timeline

- **July 5** — Audit swarm launches (5 lanes, parallel). Build lane starts BUILD-1.
  Founder does LS-2 + ci.yml. **EOD: every lane delivers its BLOCKER/BACKLOG sort.**
- **July 6** — Blockers fixed serially. BUILD-1 lands + Lane 1 re-verifies the gate.
  LS-6 prod reseed (founder-supervised). BUILD-2/3 continue toward F1.
- **July 7** — Morning: end-to-end dress rehearsal (stranger → waitlist; and behind the
  flag, borrower → application → DU → lender package). Noon: **go/no-go** against the
  §2 rule. EOD: armed launch — public waitlist live, commercial machine one flip from F1.

---

## 7. Riskiest assumption

That the gate holds — that once BUILD-1 ships, there is genuinely **no** orphaned route,
cached bundle, or reachable path that puts a soliciting surface in front of the public
before F1. If it leaks, "gated" silently becomes "fully public + soliciting," which is the
scope we explicitly declined. That is why Lane 1 exists and why a leak is a §2 blocker.

---

## 8. Execution log — 2026-07-05

### Audit swarm (read-only, parallel) — COMPLETE

| Lane | Result | Date-moving blockers |
|---|---|---|
| 1 — gate integrity | **6 blockers, 1 backlog** | **6 → all FIXED (below)** |
| 2 — public-word compliance | **7 blockers, 5 backlog** | **7 → all FIXED (below)** |
| 3 — PII / security | 0 PII blockers, 4 backlog | 0 (the "blocker"-tagged CSRF/aggregator item is not PII and doesn't touch the `/api/email-capture` waitlist → backlog; matters for post-F1 aggregator intake) |
| 4 — regulated-math | 0 blockers, 1 backlog | 0 (46/46 compliance tests pass; #29 VA dual-path intact) |
| 5 — ops readiness | 0 blockers, 1 backlog, 4 founder-actions | 0 |

### BUILD-1 — pre-license gated mode + waitlist — DONE & VERIFIED

New: `client/src/lib/prelaunch.ts` (client flag, fail-safe gated in prod builds),
`server/services/prelaunchGate.ts` (server gate; fail-safe interlock = prod + NMLS
PENDING), `client/src/pages/public/Waitlist.tsx` (marketing `/api/email-capture` capture —
NOT the TrustedForm/TCPA leads path), `isCompanyNmlsPending()` in `shared/companyIdentity.ts`.
Wired: `App.tsx` (`/` → Waitlist; persona LPs, `/apply`, `/rates/*`, `/ref`, `/partner`
redirect to `/` while gated), `Navigation.tsx` (soliciting links + CTAs hidden), the three
public rate endpoints + `POST /api/loan-applications` (server `prelaunchGate`). Docs:
`.env.example`, test `tests/prelaunchGate.test.ts` (6/6).

Verified on a gated dev server (:5002, flags on): `/` renders the Waitlist; `/apply` and
`/rates` redirect to `/`; `GET /api/{rates,mortgage-rates,mortgage-rate-programs}` → 404
`PRELAUNCH_GATED`; `tsc` clean; 6/6 gate tests pass.

### Lane 2 blocker remediation — all 7 FIXED (verified in-browser)

Terms (`and/or direct lender` → broker), PreApproval `/apply` footer (`direct lender`,
`NMLS #PENDING`, `Equal Housing Lender` ×3 → broker + Equal Housing Opportunity),
Disclosures (fabricated `NMLS #123456` → `Pending` via `isCompanyNmlsPending()`; false
42-state licensing claim removed; `Equal Housing Lender` → `Equal Housing Opportunity`;
fabricated HQ address de-fabricated; legal name unified). Note: Disclosures + Terms stay
**public in gated mode**, so these were true §2 (stranger-reachable) blockers, not just
F1-day cleanup.

### Lane 1 gate-leak remediation — all 6 FIXED (verified on the gated server)

Lane 1 probed the running gated server and found BUILD-1's first cut leaked 6 soliciting
surfaces it had left public. All closed and re-verified on :5002:

- **Live-pricing API leak (the serious one):** `GET /api/calculators/credit-tiers`
  (`server/routes/calculators.ts`) served live 30-yr-fixed + per-tier rates to a logged-out
  curl → now behind `prelaunchGate` (404 `PRELAUNCH_GATED`, confirmed).
- **Routes gated (redirect to Waitlist):** `/properties` `/properties/live` `/properties/:id`
  (pre-approval CTAs + estimates), `/afford` (funnels to `/apply`), `/find-an-agent`
  (pre-approval CTAs), `/calculators/rent-to-own` (rendered the live pricing above),
  `/learn/first-time-buyer` (data-driven pre-approval CTAs). All confirmed → `/`.
- **Educational pages kept live, apply CTA + rate copy suppressed when gated:** ArticleDetail
  (`/learn/:slug`), Glossary, DownPaymentWizard — content still renders; no `/apply` link,
  no "get pre-approved" copy (confirmed).

Post-fix gate: `tsc` clean, **653/653 unit tests pass**.

### Still open

- **Backlog (post-launch, non-blocking):** `/resources` has one card ("How mortgage rates
  work / check your rates") linking to a dead `/mortgage-rates` route — soliciting copy but
  the link 404s and serves no rate (Lane 1 backlog); CSRF exemption for `/api/leads` aggregator POSTs
  (Lane 3); LLPA/PMI rate-card ledger entries (Lane 4); `PublicLayout` has no Footer /
  rate-card equal-prominence polish (Lane 2 #10–12); `emailService` dev console-log hard-gate
  (Lane 3 #4).
- **Founder-actions (Lane 5):** confirm prod migrations 0005–0008 applied; LS-2 env vars
  (SendGrid + SPF/DKIM, SENTRY_DSN + uptime, GCS creds).

## 9. Launch shape — DECIDED 2026-07-05: layer with the private-beta gate (PR #53)

Reconciled with the open PR #53 (private-beta Edge Middleware, `BETA_ACCESS_CODE`). Decision:
**layer both — beta gate is the front door, this pre-license gate hides the funnel inside,
the funnel lights up on F1.** They compose (distinct env vars; #53 exempts `/api/*`, so this
PR's server `prelaunchGate` on the rate/credit-tier/application APIs is what actually protects
pricing from an admitted tester). Rollout:

1. Merge #53 first (clean onto current main), then #54 — **one trivial conflict**, in
   `vitest.config.ts`: union the test `include` entries (`rateLimitRelaxed` + `betaGate` +
   `prelaunchGate`). `.env.example` auto-merges; `tsconfig.json` is #53-only; no other conflicts.
   *(Verified 2026-07-05 by a trial merge onto current `origin/main` = adce335.)*
2. Set `BETA_ACCESS_CODE`; leave `PRELAUNCH_GATED`/`VITE_PRELAUNCH_GATED` unset (fail-safe
   gates prod while NMLS PENDING). → public sees #53's invite screen; testers get the platform,
   funnel/rates/apply dark.
3. **F1:** real NMLS id + `PRELAUNCH_GATED=false` + `VITE_PRELAUNCH_GATED=false` → funnel lights
   up for testers (site still invite-only).
4. **Public launch:** delete `BETA_ACCESS_CODE` → middleware no-op, site public + funnel live.

**Open seam (founder call):** an admitted tester lands on this PR's Waitlist at `/` (odd —
they're already in; and #53's invite screen collects no public emails, so the Waitlist is
effectively unused in this shape). Either keep it (thin beta — testers Sign in and test the
authed app) or change `/` in beta mode to the gated Landing (extra work: gate the Landing's
RatesTeaser + apply CTAs). **DECIDED 2026-07-05: ship as-is (Waitlist-at-`/`, thin beta).**
Gating the Landing for a richer beta is a deliberate deferred backlog item — revisit only if
testers need to walk the full marketing/education surface pre-F1.
