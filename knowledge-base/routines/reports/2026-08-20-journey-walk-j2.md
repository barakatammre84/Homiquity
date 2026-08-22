# Client Journey Walk — 2026-08-20 (second run) — Journey 2: Active buyer, W-2 salaried

**Routine:** `client-journey-walk` (daily since 2026-08-19). **Second run of this seat**; the first
ran earlier the same day and walked journey 1, so this report takes the `-j2` suffix rather than
overwriting [`2026-08-20-journey-walk.md`](2026-08-20-journey-walk.md).
**Persona:** 2 of 4 — active buyer, W-2 salaried. Resumed from the rotation ledger.
**Claim taken:** none. This seat writes no application code (CHARTER §6 — report + tickets only).

STATUS: WARN

---

## ⛔ Human actions

1. **Decide whether `/e-consent` is load-bearing.** `J-0820-01` shows every signature taken on that
   page is written with `applicationId = null`, so no application-scoped consent gate can see it.
   The borrower's Loan Estimate — the TRID disclosure — stays locked behind a consent the product
   has already told them is complete. The escape hatch (signing a second time on the LE page)
   leaves **two consent rows for one disclosure, one of them orphaned**, on a record type that
   carries tamper-evident content hashes. That is a records-integrity question above a bug fix.
2. **Flagged, never asserted — Reg Z, for compliance-watch.** `/loan-options` renders five options
   with **rate and monthly payment but no APR and no points/fees**, while the anti-steering
   disclosure *on the same page* states the options include "the loan with the LOWEST TOTAL DOLLAR
   AMOUNT of discount points, origination points, and origination fees." The badges shown are
   "Lowest rate" and "Lowest **payment**". Per CLAUDE.md, `docs/reg-z/` holds no authoritative text,
   so this is **recorded as an internal-consistency observation and flagged**, not ruled.

---

## Summary

Journey 2 completes end to end and its single most important assertion passes: a fresh `/signup`
account was created as part of funnel submission and came out `active_buyer`, with all eleven
captured fields arriving at the server exactly as entered. The Illinois licensing gate, the
funnel's 13-step promise, the DTI disclosure and the URLA's income conversion are all genuinely
good. The damage is concentrated after submission: consents signed on `/e-consent` are invisible
to every gate that matters, so the Loan Estimate is unreachable from the path the product
signposts; and three surfaces label numbers as something they are not — a max **purchase price**
sold as "your pre-approved **loan amount**", self-reported debts sold as coming "from your soft
credit check", and an affordability-ceiling payment printed directly above the borrower's own
target price. Two steps of the charter route (`/verification`, `/credit-consent/:id`) were **not
walked** — see Not walked, below.

---

## Server under test

| | |
|---|---|
| Origin | `http://localhost:5001` — local only; the deployed site was never touched |
| Serving commit | **`c23079b5`** = `origin/main` tip ("docs(hygiene): adjudicate the outside hygiene-loop pitch", #640) |
| Worktree | `…/scratchpad/jw-wt`, detached from `origin/main`, `pnpm install` run fresh |
| Process | pid 43496, `cwd` verified via `lsof -a -p 43496 -d cwd`, started **17:15:55** local |
| `/api/health` | `{"status":"ok","commit":null,"email":{…}}` |

All three staleness traps cleared explicitly:

- `commit: null` is the local-dev signature, so it cannot identify a checkout — the process was
  identified by `lsof` cwd instead, which resolves to this worktree and not the primary checkout.
- The `commit` **and** `email` keys are both present, which rules out the stale port-5002 orphan
  class (that one returns only `{status,timestamp}`).
- `pnpm dev` has no watch flag, so the server half is frozen at process start. Start time
  **17:15:55** is later than `origin/main`'s tip commit (`14:59:54`), so **server-side findings
  belong to `c23079b5`**, not to older code.

**`preview_start {name}` was not used** — it boots the primary checkout, which is on
`feat/landing-coach-first` with three uncommitted files.

**End-of-run re-check (the ledger's mandatory step):** `git fetch origin` at the end of the walk
returned `origin/main` still at **`c23079b5`**. `main` did **not** move underneath this run, so
every file:line below is against the tip as walked. (The previous run was corrected by exactly this
check; it cost nothing to repeat.)

---

## Environment notes — mine, not the product's

These cost real time and produced two findings I nearly filed falsely. **Next walker, read these.**

1. **🚨 The browser pane is `document.visibilityState === "hidden"` for the whole run, and
   `requestAnimationFrame` never fires.** Measured: `{visibilityState:"hidden", rafFired:0,
   elapsed:655ms}`. The funnel's step card lives inside `AnimatePresence mode="wait"`, which mounts
   the next step only after an rAF-driven exit animation, so **the chrome advances to step N+1
   while the step-N question stays frozen on screen.** I watched the header go 1 → 2 → 3 with the
   question never changing and was one step from filing "the funnel is unusable — you can only ever
   answer question one."
   **It is a documented driver artifact, not a defect.** `client/src/pages/lending/PreApproval.tsx:788-803`
   describes this exact desync, verified 2026-07-17, and states that a real user cannot reach it
   (a hidden tab receives no trusted input, and the stalled exit completes on the first visible
   frame). **Workaround that works: take a `computer{action:"screenshot"}` after every click** — it
   forces a frame and the card resyncs immediately. Injecting an rAF shim *after* load does not
   work; framer-motion has already captured the reference.
2. **`element.click()` does not operate the funnel's toggle controls.** `toggle-isFirstTimeBuyer`
   stayed `false` in the draft through a scripted `.click()`, and I nearly filed "the first-time-buyer
   toggle silently drops its answer." A real coordinate click set it correctly on the first try.
   Untrusted events with no pointer sequence are the difference. **Confirm any dead-control claim
   with a real click before filing it** — this is the same trap the ledger recorded last run.
3. **Screenshots only render at scroll origin.** At `scrollY > 0` the capture comes back blank
   white while the DOM is demonstrably populated. Scroll the target to the top of the viewport
   (`scrollIntoView({block:'start'})`), then capture.
4. **Key name:** `Right` does nothing; `ArrowRight` works.
5. **The browser profile arrived carrying a prior run's `homiquity_preapproval_draft`** (income
   137000, downPayment 400000 on a 434892 home — incoherent leftovers). Cleared before starting.
   Environment contamination, not product state.

---

## Persona and account

Fresh `/signup` through the real form, per JOURNEYS §2. **Not `buyer@test.com`.**

| | |
|---|---|
| Account | `jw2+0820@test.local`, id `eeb27cde-cf41-45a1-9315-42665966339c`, name Jordan Walker |
| Application | `225596f6-c354-4544-8464-0720c71705e0` |
| Income | $135,000/yr W-2, one employer, 6 years |
| Purchase | $415,000 in **Illinois**, $50,000 down (88% LTV), $500/mo debts, credit band 720–759 |

$415,000 is deliberately **below** `CONFORMING_LOAN_LIMIT_2026` (`shared/lendingLimits.ts:16` =
806,500) — the jumbo surfaces belong to journey 4.

`PRELAUNCH_GATED` is **false** locally (`client/src/lib/prelaunch.ts` opens dev builds;
`server/services/prelaunchGate.ts:25-31` returns false unless `NODE_ENV === "production"`), so the
`<Gated>` termination JOURNEYS §2 predicts for production did not apply and the whole route was
walkable. That gate working in prod is not in question here; it simply was not under test.

---

# 1. The trace

### 1.1 `/` — Landing, anonymous
`POST /api/auth/logout` first; `/api/auth/user` → 401 confirmed anonymous. Four doors, exactly as
the charter says: renting (`Landing.tsx:59-72`), self-employed (`:75-90`), owner (`:93-99`),
moving-up (`:102-111`). Console clean apart from the expected anonymous 401s.

**The charter's missing-door prediction is confirmed.** None of the four is "I have a normal job."
The salaried buyer's actual entrance is the header CTA **"Get Pre-Approved" → `/apply`**. Reported
below as an observation, not a defect — see §3.

**A promise the charter sends you after is already gone, correctly.** JOURNEYS §2 lists
`Landing.tsx:67` — *"We work out every way your income can count"* — as a promise to test against a
single-W-2 buyer. That string is **absent** from `main` today; #595 retracted it. Its absence is
the fix, not a finding, exactly as the ledger warns.

### 1.2 The Landing buying-power estimator — seam 2
Three steps (GOAL / NUMBERS / ESTIMATE). Chose *Buying my first home*; set income to **exactly
$135,000** on the slider; debts band *$250–$750*; cash *~$50k*.

- The band chips carry `aria-pressed` and a labelled `role="group"` — I checked before filing an
  a11y finding, and there isn't one.
- Band → scalar collapse is by midpoint: `data-testid="chip-debts-500"`.
- Result: **$390,000 – $425,000**, with *"An estimate from the ranges you picked, using conservative
  assumptions — not an offer, rate quote, or approval."* Provenance and Reg N posture both good.
- Reproduced identically on a second run.

`Start my pre-approval` wrote
`sessionStorage["homiquity:buying-power-scenario"] = {"goal":"first","annualIncome":135000,"monthlyDebts":500,"downPayment":50000}`
and navigated to `/apply`. **Write asserted, all four fields, meaning intact.** What happens to them
next is `J-0820-05`.

### 1.3 `/apply` — the funnel
Intro screen promises *"a verified pre-approval letter in about 3 minutes."*
Then **Step 1 of 13 → Step 13 of 13**. The step-count promise is **kept**: 13 promised, 13
delivered, matching `computeRoute()` (`preApprovalMachine.ts:161-192`) for a non-veteran,
non-complex-income file — 14 route entries less the unnumbered `intro`.

Notable along the way, all good:

- Step 5 personalises: *"On a $415,000 home, how much can you put down?"* — the value carries.
- The LIVE ANALYSIS panel updates live and correctly: entering $50,000 moved the payment
  $3,194 → $2,862/mo; LTV showed **88%** (50,000/415,000 → correct).
- Step 8 shows **DTI 25%** and says plainly *"Doesn't include your monthly debts yet — we ask about
  those in a later step."* After step 11 it moved to **30%** — `(2862+500)/11250 = 29.9%`. The
  disclosure was honest and the math is right. **This is §13 Provenance done well.**
- Step 12 points to `annualcreditreport.com` for a free score.
- Step 13's FCRA soft-pull authorization is an **unchecked** box — a positive opt-in.
- Footer carries NMLS #427468 and the broker disclosure.

**The Illinois licensing gate is excellent and deserves saying so.** Selecting **California** at
step 6 produced:

> "We can't take applications in California yet — Homiquity is currently licensed to arrange
> mortgage financing in Illinois only, so we can't yet accept applications or provide quotes for
> properties in CA. Our licensing is independently verifiable through NMLS Consumer Access
> (NMLS #427468). Pick a different state to continue, or see where we're licensed."

It **did not advance** (stayed Step 6 of 13) and offered a way forward. This is exactly the
Landing's promise — *"We'll tell you up front if we can't arrange financing where you're buying"* —
kept, with the licence cited. Switching to Illinois advanced normally.

### 1.4 Submission, signup, and the promotion — **the assertion this journey exists for**
Submit → teaser modal → "See my full pre-approval" → **"One last step — Create an account… Your
answers are already saved."** That claim is **true**: the draft was in
`localStorage["homiquity_preapproval_draft"]` at that moment, verified.

Created the account. Landed on `/loan-options/225596f6-…`.

```
GET /api/auth/user → { role: "active_buyer", email: "jw2+0820@test.local", … }
```

**The promotion fired.** ✅ One application created — no duplicate, despite my clicking
"Get My Loan Options" twice.

**Value equality across the client→server seam — exact on every field.** The funnel stores
comma-formatted strings, which is precisely the shape that usually breaks at a numeric boundary;
it does not here:

| field | funnel draft | server record |
|---|---|---|
| purchasePrice | `"415,000"` | `415000.00` ✅ |
| annualIncome | `"135,000"` | `135000.00` ✅ |
| downPayment | `"50,000"` | `50000.00` ✅ |
| monthlyDebts | `"500"` | `500.00` ✅ |
| creditScore | `"720"` | `720` ✅ |
| employmentYears | `"6"` | `6` ✅ |
| employmentType | `"employed"` | `"employed"` ✅ |
| propertyState | `"IL"` | `"IL"` ✅ |
| loanPurpose / propertyType | `purchase` / `single_family` | same ✅ |
| isFirstTimeBuyer / isVeteran | `true` / `false` | `true` / `false` ✅ |

### 1.5 `/loan-options` immediately after submit
Read **"Under Review — Your file is being prepared for review."** The application record already
said `status: "pre_approved"`.

**I nearly filed this as a two-surface disagreement and it is not one.** `awaitingDecision`
(`LoanOptions.tsx:129-131`) excludes `pre_approved`, so the banner was correct *at that instant* —
the async analysis had not yet landed. A reload showed **"Pre-Approved / Congratulations! You're
pre-approved for $562,000."** Withdrawn before filing. What survives is the smaller point that the
page never refetches on its own (`J-0820-12`).

Also on this page: the **Anti-Steering Loan Options Disclosure** with the Reg Z §1026.36(e) text
and a version stamp (v1.1), and pricing labelled *"Indicative · Your profile priced against 3
wholesale rate sheets · Priced Aug 20, 5:39 PM · 30-day lock"* — good provenance. Each option says
*"Verify your income & assets to make this rate lockable."*

### 1.6 `/dashboard`
Sidebar now reads **Active Buyer** — confirming that the "Aspiring Owner" label seen one page
earlier was a stale cache (`J-0820-11`), not a failed promotion.

Greeting: *"Hi, Jordan · File healthy — You're pre-approved. Time to find your home."*
Right card: **"YOU'RE PRE-APPROVED / $562,000 / Your pre-approved loan amount"** → `J-0820-03`.
Next step: *"Upload your documents — 8 needed."* 8 tasks listed. The dashboard names a real next
step; it is not a dead end.

### 1.7 `/urla-form`
Correct provenance in the header: *"Uniform Residential Loan Application · Freddie Mac Form 65 /
Fannie Mae Form 1003 (Effective 1/2021)."* The SSN field explains itself — *"Encrypted in transit
and at rest — only your loan team can see this. We use it to verify your credit, nothing else"* —
which is §13 Explanation done right.

- **Section 1a: 17 fields, 0 prefilled**, including first name, last name and email that the
  account demonstrably holds (`/api/auth/user` → Jordan / Walker / jw2+0820@test.local) → `J-0820-09`.
- **Section 1b prefills correctly**: `input-years-work-0` = `6` and `input-base-income-0` = `11250`
  — the funnel's `$135,000/yr` converted to monthly base income. **The income seam works.** That is
  why `J-0820-09` is scoped to the identity fields only and not written up as "the URLA re-asks
  everything."

### 1.8 `/e-consent` → the consent seam
Landed showing **6 consents required, 0 given**, while `/loan-options` was simultaneously
advertising **"3 consent(s) need your signature."** I signed all six through the UI, one at a time.
Page then read **Pending 0 · Completed 6 · Total Required 6.**

The six rows actually written: `fcra_disclosure`, `privacy_policy`, `e_disclosure`,
`credit_authorization`, `anti_steering`, `tax_document_use`.

Re-checking `/loan-options` after signing all six: **still "3 consent(s) need your signature."**
The count did not even decrease. → `J-0820-02`, and the root cause → `J-0820-01`.

### 1.9 `/loan-estimate/:id` — the disclosure leg, and the ux-30 question re-dated
JOURNEYS §2 says to re-date ux-30 ("no borrower-reachable UI rendered the LE") by walking to it
rather than reading the line. Walked:

**The route exists and is wired** — `App.tsx:479-484` mounts it behind `ROUTE_GATES.disclosure`, and
`LoanEstimate.tsx` renders a real consent gate. So ux-30's original claim is **stale**; that fix
landed. **But the page is still not reachable**, for a different reason:

```
GET /api/loan-applications/225596f6-…/loan-estimate
→ 403 {"code":"CONSENT_REQUIRED","consentType":"e_disclosure"}
```

…taken at a moment when `/api/consents/me` reported
`{consentType:"e_disclosure", consentGiven:true, applicationId:null}` and `/e-consent` displayed
"Completed 6". The borrower has given the consent; the gate cannot see it. → `J-0820-01`.

Signing the *same* disclosure a second time from the gate card on that page created a **second**
`e_disclosure` row, this one with `applicationId` set, and the gate opened (403 → 409). The 409 is
legitimate — `COMPENSATION_ELECTION_PENDING`, a real broker-compensation prerequisite — but the
page throws the server's clear sentence away and prints "Error Loading Loan Estimate / Unable to
generate the loan estimate for this application" → `J-0820-08`.

### 1.10 `/application-summary`
Figures all correct and unusually well presented — an Annual/Monthly table captioned *"the two ways
your loan team reads them"*: income $135,000/$11,250, debts $6,000/$500, assets $50,000, applicant
Jordan Walker.

One defect: the Debts group carries the note **"From your soft credit check — the kind that never
affects your credit score."** I typed that $500 into `input-monthlyDebts`; no credit pull has run.
→ `J-0820-04`.

### 1.11 Responsive (§12)
Checked 320 / 768 / 1280 across `/apply`, `/dashboard`, `/application-summary`, `/e-consent`,
`/loan-options`.

**No page-level horizontal overflow at 320px on any of the five** (`scrollWidth === clientWidth ===
320` everywhere). #587 and #605 have both landed and this journey's surfaces are clean — I checked
the open-PR list first, per the ledger, and neither is open any more.

One real clip: the mobile bottom nav's last item **"More"** measures `left 284 → right 340` on a
320px viewport — 20px of a 56px target is off-screen, and the screenshot shows the label rendered
as "Mor" with its icon cut. → `J-0820-10`.

---

## Not walked — stated, not inferred

- **`/verification`** — not walked. I confirmed the route resolves but never drove it. No finding
  either way; seam 7 (verified provenance → decision recalc → the number on `/application-summary`)
  is **untested this run**.
- **`/credit-consent/:id`** — not walked, same reason.
- **I did not enter an SSN.** Entering government identifiers is prohibited for me regardless of
  the database being local and the value being fake, so URLA section 1a was never submitted and
  sections 3–7 (Assets, Liabilities, Property & loan, Declarations, Demographics) were not
  exercised. The URLA findings below are limited to what sections 1a/1b render on load.
- **Seam 1 (`/calculators/affordability` → funnel via `calculatorPrefill`) was not walked.** I
  entered the funnel through the Landing estimator (seam 2) instead. `calculatorPrefill` is
  read-and-consumed and only one funnel entry can be in flight, so the documented raw-score vs
  band vocabulary question is **still open and untested**. Recommend the next journey-2 run enter
  via the calculator to cover it.

---

# 2. Findings, ranked by what they cost a client

## (a) The journey cannot be completed

None outright. `J-0820-01` blocks the disclosure leg from the signposted path but has an escape
hatch, so it is ranked in (b).

## (b) It completes, but data is wrong or lost

### J-0820-01 — Consents signed on `/e-consent` are invisible to every gate, and the Loan Estimate stays locked behind a consent already given

- **Surfaces:** `/e-consent` → `/loan-estimate/:id`
- **Observed:** `/e-consent` shows "Pending 0 · Completed 6". At that same moment
  `GET /api/loan-applications/225596f6-…/loan-estimate` → **403**
  `{"code":"CONSENT_REQUIRED","consentType":"e_disclosure"}`, and `/api/consents/me` shows
  `{consentType:"e_disclosure", consentGiven:true, applicationId:null}`.
- **Expected:** a consent recorded through the product's own consent surface satisfies the gate
  that requires it.
- **Root cause:** `client/src/pages/borrower/EConsent.tsx:118-124` posts only
  `{consentType, templateId, templateVersion}`. `applicationId` is **optional** in the POST schema
  (`server/routes/borrower/consents.ts:75`), so the row is written with `applicationId = null`.
  The gate reads application-scoped (`server/consentGate.ts:31-34` →
  `server/storage/locksAndConsents.ts:152-157`, `eq(borrowerConsents.applicationId, applicationId)`),
  mounted at `server/routes/underwriting/delivery.ts:81`. Null never matches.
- **Compounding:** signing again from the LE gate card writes a **second** `e_disclosure` row with
  `applicationId` set (403 → 409). The borrower ends with two rows for one disclosure, one
  orphaned, on a record type that carries a tamper-evidence content hash.
- **Note for the fixer:** `consentGate.ts:38-49` deliberately supports null-application rows via
  `hasUserConsent` for pre-application consents. So the fix is a decision about which consents are
  application-scoped, not a blanket "always send applicationId".
- **Fails:** DESIGN_SYSTEM §13 Agreement; the repo's silent-success class (the confirmed operation
  that does not land where its consumer looks).
- **Severity:** P1.

### J-0820-02 — `/loan-options` demands 3 signatures that no template can satisfy

- **Observed:** after signing all six consents, `/loan-options` still reads **"Sign Required
  Disclosures — 3 consent(s) need your signature — Review & Sign."** Clicking through lands on
  `/e-consent`, which says nothing is pending. A loop with no exit.
- **Root cause:** `server/routes/lending/dashboard.ts:306` hardcodes
  `requiredConsentTypes = ["credit_pull", "disclosure", "privacy_policy"]`. The types the product
  actually writes are `fcra_disclosure, privacy_policy, e_disclosure, credit_authorization,
  anti_steering, tax_document_use`. **`credit_pull` is documented as never written** —
  `server/services/creditConsents.ts:21-23`: *"`credit_pull` and `monitoring` appear in the
  schema's taxonomy comment but no code path has ever written them."* Bare `"disclosure"` is
  likewise never written. Neither matches `CONSENT_TYPES` in `shared/schema/compliance.ts:514-526`
  either — there are three consent vocabularies in play.
- **Interaction:** because of `J-0820-01` the application-scoped read returns `[]`, so all three
  read pending regardless. Fixing `J-0820-01` alone would still leave 2 of 3 unsatisfiable.
- **Fails:** §13 Agreement (a count that cannot reach zero).
- **Severity:** P2.

### J-0820-03 — A maximum purchase price is labelled "your pre-approved loan amount"

- **Observed:** dashboard renders **$562,000** under the heading "YOU'RE PRE-APPROVED" with the
  caption **"Your pre-approved loan amount."** The borrower's file is a $415,000 purchase with
  $50,000 down — a $365,000 loan.
- **Root cause:** `server/services/loanAnalysis.ts:389-391` sets
  `preApprovalAmount = String(Math.max(maxQualifyingPurchase(...), purchasePrice))`, and
  `maxQualifyingPurchase` (`:244-272`) returns **`loan + downPayment`** — a purchase price. The
  caption is `client/src/components/dashboard/PreApprovedCard.tsx:83`.
- **Why it matters:** at a $562,000 price with $50,000 down the loan is **$512,000**, so the label
  overstates the loan by $50,000 and, more importantly, misnames the quantity. It also explains —
  without reconciling — why the borrower has now been shown $390–425k (estimator), $364–428k
  (funnel teaser) and $562,000 (dashboard) for "what I can buy", with no note that the first two
  use a 28% front-end test and the last a 43% back-end cap.
- **Fails:** §13 Provenance (the number does not declare what it is) and Agreement.
- **Severity:** P2.

### J-0820-04 — Self-reported debts are labelled as coming from a credit check

- **Observed:** `/application-summary`, Debts group: **"From your soft credit check — the kind that
  never affects your credit score."** The $500 was typed into the funnel's `input-monthlyDebts`;
  no credit pull exists on this file.
- **Root cause:** `client/src/pages/lending/ApplicationSummary.tsx:164` — the note is an
  **unconditional string** on the group, not derived from any provenance state, so every borrower
  sees self-reported debts described as bureau-sourced.
- **Fails:** §13 Provenance. `shared/dataProvenance.ts` has three real states; this asserts the
  wrong one.
- **Severity:** P2.

## (c) It completes, but it is not best-in-class

### J-0820-05 — The Landing estimator's four answers are dropped on the way into the funnel

- **Observed:** at funnel step 7, `sessionStorage["homiquity:buying-power-scenario"]` still held
  `{"goal":"first","annualIncome":135000,"monthlyDebts":500,"downPayment":50000}` **intact, in the
  same tab**, while `input-annualIncome` was empty (placeholder 120,000). Same at step 11 for
  `input-monthlyDebts` (placeholder 1,500). The goal was re-asked twice — step 1 (loanPurpose) and
  step 3 (first-time buyer).
- **Expected:** the module's own contract, `client/src/lib/buyingPowerScenario.ts:1-5`: *"Seed
  contract … answers given to the hero widget are never asked again."*
- **Root cause:** `loadBuyingPowerScenario` has exactly **one** reader —
  `client/src/pages/public/AffordabilityCheck.tsx:5,30`. `BuyingPowerEstimator.tsx:277` seeds and
  goes to `/afford` (which reads it); `:286` seeds and goes to **`/apply`**, which never reads it.
- **Why it matters:** this is the Landing page's primary no-account CTA and the highest-traffic
  top-of-funnel capture path in the product.
- **Fails:** §12 (needless re-asking) and the module's stated contract.
- **Severity:** P2.

### J-0820-06 — The down-payment step shows the $0-down payment beside a $100,000 placeholder

- **Observed, measured directly:** on arrival at step 5 the field is empty showing placeholder
  `100,000`, and the panel reads **$3,194/mo**. Typing values: `0` → $3,194/mo · `50000` →
  $2,862/mo · `100000` → **$2,397/mo** · cleared → $3,194/mo. So the figure on arrival is the
  **$0-down** payment, $797/mo away from what the placeholder implies.
- **Fails:** §13 Agreement (two elements on one screen implying different down payments).
- **Severity:** P3. Error direction is conservative (it overstates cost), which is why this is P3
  and not higher.

### J-0820-07 — The teaser modal prints the affordability-ceiling payment above the borrower's own target price

- **Observed:** modal reads **"$364,262 – $428,543 / Est. $3,350/mo / Your target of $415,000 is
  within this range"**, while the live panel behind it — same screen, same instant — reads
  **$2,862/mo**. Both strings are simultaneously in `document.body.innerText`.
- **Root cause:** `client/src/pages/lending/preApproval/FunnelChrome.tsx:105` renders
  `estimate.monthlyPITI`, which `client/src/lib/affordabilityEstimate.ts:90-97` computes at
  `maxHomePrice` using **`requiredDownPayment = maxHomePrice × minDownPaymentPercent`** (5% here,
  ≈$21,427) — neither the price the borrower named nor the $50,000 they actually have.
- **Expected:** a payment shown one line above "your target of $415,000" should be the payment for
  $415,000, or be labelled with the price it belongs to.
- **Fails:** §13 Agreement and Provenance.
- **Severity:** P3.

### J-0820-08 — The Loan Estimate page discards the server's explanation for a generic error

- **Observed:** server returns **409** with
  `"Your Loan Estimate is being prepared — a required pricing setup step by our team is still
  pending."` (`COMPENSATION_ELECTION_PENDING`). The page renders **"Error Loading Loan Estimate —
  Unable to generate the loan estimate for this application."**
- **Expected:** a legitimate, well-worded waiting state should not be presented as a failure. The
  server already wrote borrower-appropriate copy; the client only has to show it.
- **File:** `client/src/pages/lending/LoanEstimate.tsx` (error branch around `:130-160`; the
  `CONSENT_REQUIRED` branch at `:146-152` already does this correctly — the pattern exists).
- **Fails:** §13 Explanation.
- **Severity:** P3.

### J-0820-09 — URLA section 1a re-asks the name and email the account already holds

- **Observed:** 17 fields on section 1a, **0 prefilled**, including `input-borrower-first-name`,
  `input-borrower-last-name`, `input-email`. `/api/auth/user` returns Jordan / Walker /
  jw2+0820@test.local.
- **Scope, deliberately narrow:** section **1b prefills correctly** (`years-work` 6, `base-income`
  11250), so the URLA does hydrate from the file. The gap is the identity block specifically.
- **Fails:** §12 (an intrusive ask the product can already answer).
- **Severity:** P3.

### J-0820-10 — The mobile bottom nav's last item is clipped at 320px

- **Observed:** the "More" button measures `left 284 → right 340` in a 320px viewport — 20px of a
  56px target off-screen; parent `overflow-x: visible`; the page itself does not scroll. Screenshot
  shows the label as "Mor" with the icon cut. Six items do not fit in 320px.
- **Fails:** §12 (designed at 320px).
- **Severity:** P3. Global chrome, so it is present on every authenticated surface.

### J-0820-11 — After promotion the sidebar keeps the sandbox identity until a full reload

- **Observed:** immediately after signup + submit, on `/loan-options`, the sidebar read **"Aspiring
  Owner"** and offered "Get Pre-Approved" (just completed), "My Lease", "Gap Calculator", "Down
  Payment Help" — while `/api/auth/user` returned `active_buyer`. A full navigation to `/dashboard`
  corrected it to "Active Buyer".
- **Diagnosis:** the cached user query is not invalidated when submission changes the role. It
  self-heals; it is not a failed promotion.
- **Worth noting:** JOURNEYS §2 predicts this is *"visible only from the nav"* because both roles
  pass every route gate. That prediction was exactly right.
- **Severity:** P3.

### J-0820-12 — `/loan-options` does not refetch when the analysis it is waiting on completes

- **Observed:** landed post-submit on "Under Review — Your file is being prepared for review"; it
  did not change while I remained on the page. A manual reload showed "Pre-Approved / $562,000".
- **Expected:** the page the borrower is redirected to at submission should reflect the decision
  when it lands, without a manual reload.
- **Severity:** P3.

---

# 3. Observations — recorded, deliberately not filed

- **The W-2 buyer still has no door.** Confirmed on `c23079b5`: the four Landing doors are renting,
  self-employed, owner, moving-up. The salaried buyer's real entrance is the header "Get
  Pre-Approved" CTA, which works. JOURNEYS §2 already records this as expected, so it is an
  observation, not a new finding — but it remains a live product question for the founder.
- **Reg Z, flagged not asserted** (see ⛔ #2): rate + payment shown with no APR and no points/fees,
  beside a disclosure promising a lowest-total-fees option; badges are "Lowest rate" and "Lowest
  payment". Routed to compliance-watch. `docs/reg-z/` holds no authoritative text, so no ruling.
- **"Pre-approval" vs "pre-qualification" is a known, deliberate deferral.** The same artifact is
  called "Get Pre-Qualification Letter", "View pre-qualification letter" and "Generate Pre-Approval
  Letter" across states. `PreApprovedCard.tsx:20-30` documents this as *"the deferred,
  compliance-gated COPY track"*. **Not filed as new** — it is a known open decision.
- **Submit is enabled before FCRA consent is ticked.** Clicking without it is blocked by
  `stepGate`, so the gate exists; a disabled button would be clearer. Too small to file.

---

# 4. Buildable tickets

Each names a file and an expected behavior, with a one-line acceptance test.

| # | ticket | owner lane | acceptance test |
|---|---|---|---|
| T1 | **`J-0820-01`** — decide the scope rule for consent records, then make `/e-consent` write it. `EConsent.tsx:118-124` must send the `applicationId` for application-scoped consents; consider making it **required** in `server/routes/borrower/consents.ts:75` for those types so the failure is loud. Do not blanket-require — `consentGate.ts:38-49` needs null rows for pre-application consents. | Backend Data Engineer (owns the API contract) + Workflow Completion | Sign `e_disclosure` on `/e-consent`, then `GET /api/loan-applications/:id/loan-estimate` → **not 403**; exactly **one** `e_disclosure` row exists for that application. |
| T2 | **`J-0820-02`** — replace the hardcoded `["credit_pull","disclosure","privacy_policy"]` at `server/routes/lending/dashboard.ts:306` with the consent types the application's own templates define. | Backend Data Engineer | With all templates signed, the "Sign Required Disclosures" item is **absent** from `/loan-options`; with one unsigned, the count equals the number unsigned. |
| T3 | **`J-0820-03`** — `PreApprovedCard.tsx:83` must not call a purchase price a loan amount. Either relabel to "maximum purchase price" or render `preApprovalAmount − downPayment`. Decide which `loanAnalysis.ts:391` is meant to produce and make the name match. | Primary Engineer | A $415,000/$50,000-down file shows a figure whose caption matches its quantity; a unit test pins `maxQualifyingPurchase` as a price. |
| T4 | **`J-0820-04`** — `ApplicationSummary.tsx:164` must derive its provenance note from `shared/dataProvenance.ts`, not assert a credit check. | Capture Path Engineer | With no credit pull on file, the Debts note does **not** say "From your soft credit check"; after a pull, it may. |
| T5 | **`J-0820-05`** — make `/apply` consume `loadBuyingPowerScenario()`, or stop `BuyingPowerEstimator.tsx:286` from claiming that exit. Prefill goal, income, debts and down payment. | Capture Path Engineer | Complete the Landing estimator, click "Start my pre-approval": `input-annualIncome` arrives holding the estimator's income and the goal step is not re-asked. |
| T6 | **`J-0820-07`** — `FunnelChrome.tsx:105` must label which price its payment belongs to, or show the payment for `targetPrice`. | Capture Path Engineer | The modal's payment either matches the live panel for the target price, or is captioned with the price it assumes. |
| T7 | **`J-0820-06`** — the down-payment step must not render a $0-down payment beside a $100,000 placeholder. Show a neutral state until a value is entered, or seed the field. | Capture Path Engineer | On arrival at step 5 with an empty field, no payment figure is shown that contradicts the placeholder. |
| T8 | **`J-0820-08`** — `LoanEstimate.tsx` must surface the server's `error` string for non-consent failures, mirroring its own `CONSENT_REQUIRED` branch. | Primary Engineer | A 409 `COMPENSATION_ELECTION_PENDING` renders the server's sentence, not "Unable to generate". |
| T9 | **`J-0820-09`** — hydrate URLA section 1a's first name, last name and email from the authenticated user. | Feature Completion | Opening `/urla-form` on a fresh account shows the signup name and email already filled. |
| T10 | **`J-0820-10`** — fit six bottom-nav items in 320px, or reduce the count below 320px. | UI conformance sweep | At 320px every bottom-nav item's `right` ≤ viewport width. |
| T11 | **`J-0820-11`** — invalidate the user query when submission promotes the role. | Primary Engineer | Immediately after signup+submit, the sidebar reads "Active Buyer" with no reload. |
| T12 | **`J-0820-12`** — `/loan-options` should refetch (or subscribe) while the application is in an analysing state. | Workflow Completion | Submitting and remaining on the page shows the decision when it lands, without a reload. |

---

# 5. What is genuinely solid

The founder asked for best-in-class, so this half of the walk matters as much as the findings.

- **The Illinois licensing gate** — blocks the state, names the licence, cites NMLS Consumer Access,
  refuses to advance, offers a way forward. Best-in-class as it stands.
- **The client→server capture path** — eleven fields, comma-formatted strings throughout, every one
  landed exactly. This is the seam that usually breaks and it does not.
- **The promotion** — `aspiring_owner` → `active_buyer` on submit, one application, no duplicate
  across two submit clicks.
- **The DTI disclosure** — showing 25% and *saying* it excludes debts, then moving to a correct 30%
  once they are entered, is exactly the honesty §13 asks for.
- **The step-count promise** — 13 promised, 13 delivered, branch logic included.
- **URLA section 1b** — annual → monthly conversion carried correctly from the funnel.
- **The anti-steering disclosure** — full Reg Z §1026.36(e) text, versioned.
- **320px** — no page-level horizontal overflow on any of the five surfaces walked.
- **The `/apply` intro's "your answers are already saved"** — verified true.

---

STATUS: WARN
