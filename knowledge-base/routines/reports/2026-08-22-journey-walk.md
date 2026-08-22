# Client Journey Walk — 2026-08-22 — Journey 2: Active buyer, W-2 salaried

**STATUS: WARN** — the journey completes end to end and the record it writes is correct to the
cent, but between the Landing and the dashboard the same client is quoted **three different
affordability answers** (the last one 46% above the first, delivered as a congratulation), and the
`aspiring_owner → active_buyer` promotion never reaches the navigation in-session.

**Routine:** `client-journey-walk` (daily). **Persona 2 of 4**, per
[`journey-walk/LEDGER.md`](../journey-walk/LEDGER.md) (previous run: journey 1, 2026-08-20).
**Claim taken:** none — this seat writes no application code (CHARTER §6).

## ⛔ Human actions

**None blocking.** Every finding below is a buildable ticket for an existing lane. One item is
founder-adjacent rather than engineering: `/apply` promises *"a verified pre-approval letter in
about 3 minutes"* and the product — correctly — cannot issue one until documents are verified
(§2.6). Whether the fix is the copy or the promise is a positioning call, not a code call.

## Summary

I signed up as a new salaried buyer and walked from the Landing hero through the 13-step funnel,
the auth wall, the promotion, the pre-approval result, the URLA, the consent centre, verification,
the application summary and the Loan Estimate. **The application record is perfect** — all thirteen
funnel answers land in Postgres exactly as entered — and several compliance behaviours are
genuinely best-in-class (the unlicensed-state hard stop, the FCRA opt-in gate, the refusal to mint
a pre-approval letter from self-reported data). **The seams are where it breaks.** The Landing's
estimator writes a scenario that `/apply` never reads; three independent affordability models quote
$415–455k, then $391–460k, then **"Congratulations! You're pre-approved for $607,000"**; the
sidebar keeps calling the client an "Aspiring Owner" and offering "Get Pre-Approved" while they
stand on their own pre-approval page; and the dashboard's "Sign Required Disclosures" to-do names
two consent types that **no template in the system can ever satisfy**, so it can never be cleared.

---

# 0. Source, server, and honesty notes

## Charter source

`knowledge-base/feature-review/JOURNEYS.md` **is on `origin/main`** (`git cat-file -e` → present).
I used **§2 of `JOURNEYS.md`**, not the `SKILL.md` summaries. Its route, seams, promises and
"forbidden" list are what this walk followed.

## Server under test

| | |
|---|---|
| Origin | `http://localhost:5001` — **local only**; the deployed site was never touched |
| Serving commit | **`4206025f`** — `origin/main` tip, *"design(identity): the UI stops being the stack's defaults … (#643)"* |
| Worktree | `…/scratchpad/wt-jw`, detached from `origin/main`, fresh `pnpm install` |
| Process | pid 11755, `cwd` verified with `lsof -a -p 11755 -d cwd` → the worktree above; started **12:06:40**, i.e. **after** the checkout, so server-side code is current |
| `/api/health` | `{"status":"ok","timestamp":…,"commit":null,"email":{…}}` — `commit:null` is the local-dev signature; the presence of **both** `commit` and `email` rules out the stale port-5002 orphan class |
| Ports | 5001 and 5002 were both free at start — no orphan to inherit |

**I did not use `preview_start {name}`.** It boots the primary checkout, which is on
`feat/landing-coach-first`, **42 commits behind `origin/main`** and carrying three uncommitted
files. Everything below is `origin/main`.

**`origin/main` re-checked at the END of the walk** (the 2026-08-20 lesson): still `4206025f`.
Nothing moved underneath this run, so no finding needed re-dating.

## Two harness facts, reported as harness facts

1. **The browser pane is rAF-starved.** `document.visibilityState === "hidden"` and a measured
   **0 requestAnimationFrame callbacks per second**. The funnel's `AnimatePresence mode="wait"`
   therefore stalls: the step counter advances while the question stays frozen at `opacity: 0`.
   **This is not a defect** — `PreApproval.tsx:786-802` documents exactly this, verified
   2026-07-17, and states that only scripted drivers can observe it because a hidden tab receives
   no trusted input and resyncs on the first visible frame. Its own advice ("force the pane to
   render") is the workaround I used: **a screenshot delivers one frame and completes the
   transition.** Every funnel step below was advanced that way. I also tried the real-Chrome
   surface (`claude-in-chrome`); that window was backgrounded too and measured 0 fps as well.
2. **Clicking by `ref` is unreliable on this page set** (the 2026-08-20 run hit the same thing).
   I clicked by screenshot coordinate throughout and confirmed each effect in the DOM.

## Claims I checked and withdrew — do not build these

- **"The funnel's currency fields lack `inputmode`"** — WITHDRAWN. A DOM probe read `inputmode:
  null` on four currency steps, but `PreApproval.tsx:511-512` sets `inputMode="numeric"` on the
  shared number-step `<Input>` that renders all four. My probe read the wrong element.
- **"The FCRA soft-pull authorisation is captured and discarded"** — WITHDRAWN.
  `/api/consents/check/<id>/credit_report` returns `hasConsent:false`, which looked like the
  classic silent-success shape. It is not: the funnel consent is written to a *different* table,
  `credit_consents`, with `consentType:"soft_pull"` plus canonical disclosure text, IP and user
  agent (`applications.ts:177-205`). The server log contains **zero** occurrences of its
  non-fatal failure string, so the row was written. **The FCRA evidence trail is intact.**
- **"After signup the client is dumped back on the funnel's front door"** — WITHDRAWN as a
  finding. I observed `/apply`'s intro screen post-signup, but it was a transient state during the
  deferred submit; the page then navigated to `/loan-options/:id` on its own. Under rAF starvation
  I cannot measure how long that window lasts, so I will not file it. Worth a deliberate check by
  a lane that can measure it.
- **The consent checkbox is 16×16 px** — NOT a touch-target finding. It is wrapped in a
  `<label>` measuring **448×127**, so the whole disclosure text is the hit area.

## Already-registered findings this walk re-confirmed (no new rows)

| existing id | re-confirmed how, 2026-08-22 |
|---|---|
| **F-0820-21** (P1) `/api/predictions/me` 500s | Same stack trace, on a **brand-new organic `active_buyer`** in the `720-759` bucket — the row's live evidence was `below_640`. `TypeError: cohortData?.convRate?.toFixed is not a function at computePrediction (predictiveEngine.ts:235:49)`, `GET /api/predictions/me 500 in 8199ms`. **Still open, and now demonstrably wider than one bucket.** The borrower's insights card silently vanishes, exactly as the row's aggravator says. |
| **F-061** (P2) letter button offers a server-rejected action | Clicked it as the borrower. `POST …/generate-letter` → **422**, body: *"Cannot use self_reported data for generating a pre-approval letter…"*; UI showed *"Error — Failed to generate letter. Please try again."* Confirmed at source: `LoanLetterButton.tsx:96-98` `onError` takes no argument and never reads the response. **Still open, verbatim as filed.** |
| **F-079** (P1) TRID/LE compensation-election prerequisite | `GET …/loan-estimate` → **409 `COMPENSATION_ELECTION_PENDING`** on an organic file with no assigned LO — precisely the scenario F-079 describes. **Still open.** The *client-side* half of what I saw is new and filed below as `J-0822-06`. |
| **ux-30** LE not borrower-reachable | **FIXED — do not re-file.** `LoanDetails.tsx:95-100` links to `/loan-estimate/:id`, the route exists (`App.tsx:479`) and is correctly `ConsentGate`d on eDisclosure. I walked to it rather than reading the line, as §2 instructs. |
| **ux-49** fabricated "Your Team" | **Appears fixed for this persona.** The dashboard reads *"Your loan team is being assigned — we'll introduce you shortly."* No fabricated names. |

---

# 1. The trace

Account: **`jw2+0822@test.local`** ("Jordan Walker"), created through the real `/signup` form
during the walk. Not `buyer@test.com` (forbidden by §2 — it is pinned to `active_buyer`).
Session started clean: `POST /api/auth/logout` → 200, `GET /api/auth/user` → 401, `localStorage`
and `sessionStorage` both empty.

### 1.1 `/` — anonymous, 1280×900

Four doors: *You're renting now*, *Your income is your own*, *You already own*, *You're moving up*.
**Confirmed: there is no door for a salaried W-2 buyer** — the eyebrow even enumerates the gap,
*"RENTING, SELF-EMPLOYED, REFINANCING, OR MOVING UP — START ANYWHERE."* §2 predicts this and asks
me to report it; the two real entrances a salaried buyer has are the header's **"Get Pre-Approved"
→ `/apply`** and the hero's **Buying Power Estimator**, and I walked the estimator because it is
the most prominent thing on the page.

No console errors beyond two `GET /api/auth/user → 401` (expected while anonymous, though the page
fires that call **twice** on one load — noted, not filed).

### 1.2 The Buying Power Estimator — seam 2

Three steps, three inputs on the middle one — **§12's ≤3 met exactly**. I answered as the persona:

| ask | answered |
|---|---|
| Goal | Buying my first home |
| Household income (yearly), slider 30k–500k step 5k | **$145,000** |
| Monthly debt payments | band **$250–$750** |
| Cash for a down payment | band **~$50k** |

Result: **"Your estimated buying power — $415,000 – $455,000."** Disclaimed as *"An estimate from
the ranges you picked, using conservative assumptions — not an offer, rate quote, or approval."*

✅ **Reg Z §1026.24 handled correctly here.** `buyingPowerScenario.ts:20-26` states the assumed
rate is a modelling constant that "must NEVER be rendered", and the surface renders a price range
with no rate and no payment. The rail is real and it holds.

Clicking **"Start my pre-approval"** wrote
`sessionStorage["homiquity:buying-power-scenario"] = {"goal":"first","annualIncome":145000,`
`"monthlyDebts":500,"downPayment":50000}` and navigated to `/apply`.

> **Seam 2, write side: PASSES.** The debt *band* collapses to its midpoint (500) — lossy but
> defensible. **Seam 2, read side: FAILS.** See `J-0822-03`.

### 1.3 `/apply` → the 13-step funnel

The intro screen carries **no global chrome** (§12 ✅) and promises *"a verified pre-approval
letter in about 3 minutes. No hard credit check."*

Every step, and what I answered:

| step | question | answer | note |
|---|---|---|---|
| 1/13 | What are you looking to do? | Buying a Home | goal `"first"` was already in the seed; asked again |
| 2/13 | What kind of property? | Single Family Home | **pre-selected by default** |
| 3/13 | Programs (3 checkboxes) | *first-time home buyer* | all unchecked by default ✅ |
| 4/13 | Estimated purchase price | **$440,000** | empty field, placeholder `500,000` |
| 5/13 | How much can you put down? | **$50,000** | empty field, placeholder `100,000`; seed had 50000 |
| 6/13 | Which state? | **Illinois** | probed California first — see below |
| 7/13 | Total household income | **$145,000** | empty field, placeholder `120,000`; seed had 145000 |
| 8/13 | How are you employed? | W-2 Employee | pre-selected |
| 9/13 | Years at current job | **6** | |
| 10/13 | Additional income? | No, this is my only income | |
| 11/13 | Monthly debt payments | **$500** | empty field, placeholder `1,500`; seed had 500 |
| 12/13 | Roughly, what is your credit score? | **720–759** | |
| 13/13 | FCRA soft-pull authorisation | ticked | |

**Step count promise KEPT** — it said "Step 1 of 13 · ~3 min left" and ended at "Step 13 of 13 ·
100% complete". The percentage tracked the step number honestly the whole way.

**The licensing promise is KEPT, and it is excellent.** Selecting **California** produced a hard
stop with no Continue button at all:

> *"We can't take applications in California yet. Homiquity is currently licensed to arrange
> mortgage financing in Illinois only, so we can't yet accept applications or provide quotes for
> properties in CA. Our licensing is independently verifiable through NMLS Consumer Access
> (NMLS #427468). Pick a different state to continue, or see where we're licensed."*

That is the Landing's *"We'll tell you up front if we can't arrange financing where you're
buying"* delivered exactly. `LICENSED_STATES = ["IL"]` (`companyIdentity.ts:120`). One blemish:
the LIVE ANALYSIS panel **kept rendering "EST. MONTHLY PAYMENT $3,054/mo"** beside a block saying
the product cannot *provide quotes* for that property — both strings verified present in the DOM
simultaneously. Filed as part of `J-0822-01`.

**The FCRA gate is honest.** The authorisation checkbox is unchecked by default, and submitting
without it produced *"Please complete all fields — Please authorize the soft credit check to
continue."* No pre-ticked consent anywhere in the funnel.

### 1.4 The teaser modal, the auth wall, the submit

Submitting raised **"You're likely in range — $391,244 – $460,287 · Est. $3,598/mo · Your target of
$440,000 is within this range,"** with the LIVE ANALYSIS panel still showing **$3,054/mo** two
inches to its right. Both verified simultaneously present. See `J-0822-01`.

Then the auth wall: *"One last step — Create an account (or sign in) to see your pre-approval
results. **Your answers are already saved.**"* **That claim is true** — `localStorage` held
`homiquity_preapproval_draft` with all fifteen fields and `homiquity_preapproval_pending_submit:
"true"`. ✅

`/signup` accepted Jordan Walker / `jw2+0822@test.local`. `POST /api/auth/register` → 200, and the
deferred submit fired: **`POST /api/loan-applications` → 201 Created**. No 4xx under any success
message anywhere on this leg.

### 1.5 Seam 4 — every funnel answer against the application record

`GET /api/loan-applications/034aa746-45c8-4ca1-aaec-a452e4dffe1d`:

| field | I entered | stored | |
|---|---|---|---|
| `loanPurpose` | Buying a Home | `purchase` | ✅ |
| `propertyType` | Single Family Home | `single_family` | ✅ |
| `propertyState` | Illinois | `IL` | ✅ |
| `purchasePrice` | 440,000 | `440000.00` | ✅ |
| `downPayment` | 50,000 | `50000.00` | ✅ |
| `annualIncome` | 145,000 | `145000.00` | ✅ |
| `monthlyDebts` | 500 | `500.00` | ✅ |
| `creditScore` | 720–759 | `720` | ✅ |
| `employmentType` | W-2 Employee | `employed` | ✅ |
| `employmentYears` | 6 | `6` | ✅ |
| `isFirstTimeBuyer` | checked | `true` | ✅ |
| `isVeteran` | unchecked | `false` | ✅ |
| `avoidsInterestFinancing` | unchecked | `false` | ✅ |

**13 of 13 exact.** This is the strongest part of the product. Note `avoidsInterestFinancing`
persists correctly **on the create path** — the known `UPDATABLE_COLUMNS` drop is on autosave, and
this walk did not exercise that leg.

### 1.6 The promotion — and the nav that never heard about it

`GET /api/auth/user` → **`role: "active_buyer"`**. The promotion fired
(`applications.ts:134-137`). `applicationCount` = 1.

At the same instant, the sidebar rendered portal label **"Aspiring Owner"** and sections
**"Explore" / "Get Ready"** — offering *Get Pre-Approved*, *My Journey*, *Gap Calculator*,
*My Lease*, *Down Payment Help*. A full page navigation fixed it (**"Active Buyer" / "My
Mortgage"**), proving it is a client-cache staleness bug, not a server one. `J-0822-02`.

### 1.7 `/loan-options/:id` — the payoff surface

**"Pre-Approved. Congratulations! You're pre-approved for $607,000."**

Everything below that headline then prices a **$440,000** purchase: *Loan Amount $390,000 · Down
Payment $50,000 (11.36%)*. Eight live-pricing options (5.635%–6.760%) plus four payment scenarios.

Genuinely good on this page:
- The **Anti-Steering Loan Options Disclosure** is presented *before* any lock, citing Reg Z
  §1026.36(e), version-stamped 1.1.
- **Rate and APR are shown together** in the Payment Scenarios cards (6.875% / 7.364% etc.).
- *"Pricing is indicative — based on your self-reported profile, not a rate quote or a commitment
  to lend"* and *"Verify your income & assets to make this rate lockable."*
- PMI explained with removal at 20% equity.
- The generated document set is **correct for this persona**: W-2s (2025, 2024), 30 days of pay
  stubs, 2 months of bank statements, government ID. No self-employment artefacts. ✅

Two things wrong, both filed: the $607,000 itself (`J-0822-01`), and **"Generate Pre-Approval
Letter"** → 422 → *"Please try again"* (already **F-061**).

⚠️ **Flagged, not asserted** (CLAUDE.md's Reg Z rail — `docs/reg-z/` holds no authoritative text):
the anti-steering text tells the client the option set includes *the lowest interest rate* **and**
*the lowest total dollar amount of discount points, origination points and origination fees*. The
option list labels **"Lowest rate"** and **"Lowest payment"**. "Lowest payment" is not the second
category the disclosure names. This needs `compliance-auditor` with a captured §1026.36(e), not a
verdict from me.

### 1.8 `/dashboard`

Names the next step plainly — *"Upload your documents — 8 needed. Everything on the list unlocks
your next stage."* **Not a dead end.** ✅ Credit score is rendered as **"720 (720-759)"** — the
point value *and* the band it came from, which is provenance done right.

Three problems: `$607,000` relabelled *"Your pre-approved **loan amount**"* (`J-0822-01`); the
page shows **"68% complete"** and **"Package readiness: 0 of 4 ready · 0%"** simultaneously; and
**"Sign Required Disclosures — 3 consent(s) need your signature"** (`J-0822-04`).

`View pre-qualification letter` **works** — `PQ-MTL2098-…` generated on the first click. So the
product *can* issue a letter in three minutes; it is the **pre-qualification** letter, not the
"verified pre-approval letter" `/apply` advertises.

### 1.9 `/urla-form` — seam 5

7 sections, 0 complete. Correctly captioned *Freddie Mac Form 65 / Fannie Mae Form 1003
(Effective 1/2021)*. The SSN field carries a real explanation: *"Encrypted in transit and at rest
— only your loan team can see this. We use it to verify your credit, nothing else."* (§13
Explanation ✅.)

- **Section 1a — all 17 fields empty**, including `borrower-first-name`, `borrower-last-name` and
  `email`, which the account already holds (`Jordan` / `Walker` / `jw2+0822@test.local`). The
  client typed these into `/signup` minutes earlier.
- **Section 1b — the income seam CARRIES.** Employment years prefilled `6`; monthly base income
  prefilled **`12083`** = $145,000 ÷ 12. The funnel→URLA income handoff works. ✅

I did **not** file the URLA's ~25-inputs-on-one-screen against §12: the register already records
that as a known open item ("two structural §12 gaps … proposed, not shipped").

### 1.10 `/e-consent`, `/verification`, `/application-summary`, `/loan-estimate/:id`

- **`/e-consent`** — 6 required, 0 given: `tax_document_use`, `anti_steering`,
  `credit_authorization`, `e_disclosure`, `privacy_policy`, `fcra_disclosure`. Excellent honesty
  line under every card: *"Nothing is recorded until you submit, and you can read the full text
  above first."* ✅ But the to-do that sent me here said **3**. `J-0822-04`.
- **`/verification`** — *"Verification Service Setup Required … your loan officer will verify your
  documents manually,"* with a **"View Manual Tasks"** fallback. Honest degradation, and expected
  locally (no vendor key; CLAUDE.md's deterministic-simulation rule). **Consequence for this walk,
  stated plainly: the self-reported → verified leg cannot be walked in this environment**, so the
  pre-approval letter can never be earned here and step 8 of §2's route is **reported as not
  walked**, not inferred.
- **`/application-summary`** — every figure matches the record ($145,000/$12,083, $500/$6,000,
  $50,000 assets, $390,000 loan, IL). One provenance defect: `J-0822-05`.
- **`/loan-estimate/:id`** — reachable, and correctly `ConsentGate`d behind the eDisclosure
  consent (ESIGN done right; the Agree button is properly **disabled** until the box is ticked —
  a better pattern than the funnel's enabled-button-plus-toast). After consenting: *"Error Loading
  Loan Estimate."* Server said something far better. `J-0822-06`.

### 1.11 Responsive

`resize_window` to **320×720**, measured `scrollWidth` vs `clientWidth` and enumerated every
element crossing the right edge:

| surface | 320px overflow | offenders |
|---|---|---|
| `/` Landing | **none** (320 = 320) | 0 |
| `/dashboard` | **none** | 0 |
| `/loan-options/:id` | **none** | 0 |

**No horizontal overflow anywhere I measured.** Touch targets were a different story — `ux-51`.
One cosmetic note: on `/loan-options` at 320px the *"What to do next"* heading is squeezed to a
**45px** column beside its badge and button, wrapping to three lines.

---

# 2. Findings, ranked by what they cost a client

## (a) The journey cannot be completed

**None.** The journey completes end to end. The only leg that cannot be finished —
self-reported → verified → pre-approval letter — is blocked by *absent local vendor
configuration*, not by a defect.

## (b) It completes, but data is wrong, lost, or contradicts itself

### J-0822-01 — Three affordability answers in one session, ending in a congratulation 46% above the first

**Seam:** Landing estimator ↔ funnel teaser ↔ decision engine → dashboard.
**Surfaces:** `/` · `/apply` · `/loan-options/:id` · `/dashboard`.

One client, one set of inputs ($145,000 income, $500 debts, $50,000 down, 720–759, IL, $440,000
target), inside about four minutes:

| # | surface | figure | model | rate assumed | disclosed? |
|---|---|---|---|---|---|
| 1 | Landing estimator | **$415,000 – $455,000** | `buyingPowerScenario.ts:41-58` — 28% front-end / 43% back-end | `ASSUMED_RATE = 6.75` (`:26`) | no, deliberately |
| 2 | Funnel teaser modal | **$391,244 – $460,287**, *Est. $3,598/mo* | `affordabilityEstimate.ts:60-115` — 28% front-end | `AFFORDABILITY_ESTIMATE_DEFAULTS.interestRate = 6.5` (`:42`) | **no** |
| 3 | Funnel LIVE ANALYSIS | *EST. MONTHLY PAYMENT **$3,054**/mo* | funnel panel | **6.375%**, stated | ✅ yes |
| 4 | `/loan-options` + `/dashboard` | **$607,000** | `loanAnalysis.ts:380-391` → `maxQualifyingPurchase` — **43% back-end only, no front-end cap** | `baseRateFor(...)` | **no** |

Four sub-defects, each independently buildable:

**(1) The $607,000 headline is a maximum purchase price presented as a congratulation, and on
`/dashboard` it is relabelled a loan amount.** `maxQualifyingPurchase` returns
`maxPrice = loan + downPayment` (`loanAnalysis.ts:270-272`) — a **price**. `/loan-options.tsx:169-173`
renders it as *"Congratulations! You're pre-approved for $607,000"* with no unit; the dashboard
renders it as *"Your pre-approved **loan amount** · valid until Sep 21, 2026"*. The loan amount
for this client is **$557,000**, and every option on the same page prices **$390,000**. A
first-time buyer who anchors on $607,000 shops **33% above** the ceiling the same product computed
sixty seconds earlier and **46% above** what its Landing page said.

**(2) The teaser's payment belongs to a scenario the client never described.**
`FunnelChrome.tsx:105-107` renders `estimate.monthlyPITI` directly above *"Your target of $440,000
is within this range."* But `monthlyPITI` is computed at `maxHomePrice` (**$460,287**) using
`requiredDownPayment = maxHomePrice × minDownPaymentPercent` — **5%, i.e. $23,014**, not the
client's stated **$50,000** (`affordabilityEstimate.ts:83-97`). So $3,598/mo describes a $460,287
home bought with half the money the client said they have, while the panel beside it shows $3,054
for the actual $440,000/$50,000 target. **Δ $544/mo = $6,528/yr**, and the *lower* number is the
harmful one to budget on.

**(3) "Est. monthly" on the Live Market Pricing cards excludes escrow while its own footnote says
it doesn't.** Option E: *"Est. monthly $2,585 — P&I $2,436 + MI $150."* The block's footnote says
*"Taxes and insurance estimated; exact escrow set at Loan Estimate."* The Payment Scenarios block
on the same page gives the same product as **$3,262 Full PITI**. Same page, **$677/mo apart**, and
the same 30-year fixed conventional is quoted at **6.385%** in one block and **6.875%** in the
other.

**(4) The unlicensed-state block and a live quote render together.** With *"we can't yet accept
applications **or provide quotes** for properties in CA"* on screen, the LIVE ANALYSIS panel still
displayed *"EST. MONTHLY PAYMENT $3,054/mo."* Both verified present in the DOM at once.

**Fails:** DESIGN_SYSTEM §13 **Agreement** (primary) and §13 **Provenance** (three of the four
figures never name the rate they used).
**Adjacent, do not re-litigate:** **F-094** covers a different aspect of the same
`preApprovalAmount` — the hardcoded `43` fallback for `CONVENTIONAL_DTI_CAP`.

---

### J-0822-02 — The promotion fires; the navigation never hears about it

**Seam:** `server/routes/lending/applications.ts:134` ↔ `client/src/components/app-sidebar.tsx`.

Measured at the same instant, standing on `/loan-options/:id`:

```
serverRole            : "active_buyer"      (GET /api/auth/user)
renderedPortalLabel   : ["Aspiring Owner"]
renderedSections      : ["Explore", "Get Ready"]
```

`PreApproval.tsx:204-207` invalidates `loanApplicationKeys.all()` and `dashboardKeys.root()` on
submit success — but **not `["/api/auth/user"]`**, the key `useAuth.ts:52` reads and
`app-sidebar.tsx:250,262` branches on. So `aspiringOwnerNavigation` (`:90-111`) renders for the
rest of the session. A full page navigation to `/dashboard` corrected it to **"Active Buyer" /
"My Mortgage"** — confirming the server and the code are both right and only the cache is stale.

What the client sees on their own pre-approval page:
- **"Get Pre-Approved" → `/apply`** — the funnel they just completed. Clicking it starts a second
  application.
- **"My Lease"**, "Gap Calculator", "Down Payment Help", "My Journey" — the renter sandbox.
- **No "To-Do" and no "Documents"** — the two surfaces that same page's *"What to do next"* card
  says are required (4 uploads + consents). `activeBuyerNavigation` (`:113+`) has both.

§2's own gate-collision note predicted this: *"a silent promotion failure is invisible to a gate
check and visible only from the nav."* The promotion succeeded and the nav is wrong anyway — same
client-visible outcome.

**Fails:** DESIGN_SYSTEM §13 **Agreement**.
⚠️ **For whoever fixes it:** `partialMatchKey` is element-wise, not string-prefix — the
invalidation must be `["/api/auth/user"]` exactly.

---

### J-0822-03 — The Landing's primary CTA writes a scenario `/apply` never reads

**Seam:** `client/src/components/BuyingPowerEstimator.tsx:286` ↔ `client/src/pages/lending/PreApproval.tsx`.

`buyingPowerScenario.ts:1-5` states the contract in its own header:

> *"Seed contract between the landing-page Buying Power Estimator and the affordability tool
> (/afford): **answers given to the hero widget are never asked again**."*

The **only** reader of `loadBuyingPowerScenario()` is `AffordabilityCheck.tsx:30` — `/afford`.
The estimator has two CTAs:

- `:277` *"Try it on a real home"* → `seedAndGo("/afford")` — **read, honoured** ✅
- `:286` *"Start my pre-approval"* → `seedAndGo("/apply")` — **written, never read** ❌

`/apply` is the **primary** button. So the funnel re-asks all four answers, and I watched it
happen with the seed still sitting unread in `sessionStorage`:

```
sessionStorage["homiquity:buying-power-scenario"]
  = {"goal":"first","annualIncome":145000,"monthlyDebts":500,"downPayment":50000}

step  1/13  "What are you looking to do?"          seed goal "first"        → asked again
step  3/13  "I am a first-time home buyer"          seed goal "first"        → asked again
step  5/13  down payment,  input value ""           seed downPayment 50000   → asked again
step  7/13  household income, input value ""        seed annualIncome 145000 → asked again
step 11/13  monthly debts,  input value ""          seed monthlyDebts 500    → asked again
```

Silent by construction: the write succeeds, so nothing errors and no guard fires. The client
answers the same four questions twice and the funnel's *"~3 min"* pays for it.

**Fails:** DESIGN_SYSTEM §13 **Explanation** (an intrusive ask the product already had the answer
to). Also the module's own documented contract.

---

### J-0822-04 — A required-disclosures to-do that can never be cleared, and two surfaces that disagree on how many

**Seam:** `server/routes/lending/dashboard.ts:306` ↔ `/e-consent` (`GET /api/consent-templates`).

`dashboard.ts:306`:

```js
const requiredConsentTypes = ["credit_pull", "disclosure", "privacy_policy"];
```

The six **active** consent templates are `tax_document_use`, `anti_steering`,
`credit_authorization`, `e_disclosure`, `privacy_policy`, `fcra_disclosure`.

- **`"credit_pull"` is not a consent type at all.** It is absent from `CONSENT_TYPES`
  (`shared/schema/compliance.ts:513-525`) and its only other uses in the repo are a *retention*
  `dataType` (`creditRetention.ts:31,172`) and a decision-recalc *trigger* (`decisions.ts:21`) —
  unrelated vocabularies. No template can ever carry it.
- **`"disclosure"` is in `CONSENT_TYPES` but has no active template.** Also unsatisfiable.
- Only `privacy_policy` is real.

`pendingConsentTypes` (`:310`) filters the required list against what has been given, so it can
**never fall below 2**. The borrower can sign every consent the product offers and
**"Sign Required Disclosures — 2 consent(s) need your signature"** stays on their dashboard
forever. A permanently unclearable to-do on the borrower's primary work surface.

The same defect produces a visible contradiction today: the action item says **3**, and clicking
its *"Review & Sign"* lands on `/e-consent` showing **6**, all marked Required. Neither number is
the truth.

**Fails:** DESIGN_SYSTEM §13 **Agreement** ("does any fraction's denominator move?" — it does,
3 → 6).

---

### J-0822-05 — Self-reported debts attributed to a credit check that never ran

**Surface:** `/application-summary` · **File:** `client/src/pages/lending/ApplicationSummary.tsx:164`.

Under a card headed **"You told us"**, the Debts group renders:

> *"**From your soft credit check** — the kind that never affects your credit score."*
> Monthly debts $6,000 / $500

The **$500 came from funnel step 11**, typed by the client. No credit pull has occurred:
`/verification` reports the verification service is unconfigured, and the funnel captured the
*authorisation*, not a pull. The note is a **hard-coded string** on `:164` — it renders
unconditionally, whatever the data's real provenance.

`shared/dataProvenance.ts:15-21` defines exactly three states — `self_reported`, `verified`,
`system_calculated` — and this figure is `self_reported`. The copy upgrades it to bureau-sourced,
which is the **harmful direction**, and it contradicts its own card heading two lines above.

**Fails:** DESIGN_SYSTEM §13 **Provenance**, and §13 **Agreement** with the card's own heading.

## (c) It completes, but the experience is not best-in-class

### J-0822-06 — The Loan Estimate page throws away the server's honest explanation

**Surface:** `/loan-estimate/:id` · **File:** `client/src/pages/lending/LoanEstimate.tsx:160-176`.

```
GET /api/loan-applications/…/loan-estimate
→ 409 {"error":"Your Loan Estimate is being prepared — a required pricing setup step by our
        team is still pending.","code":"COMPENSATION_ELECTION_PENDING"}
```

That message is borrower-appropriate, honest, and tells the client the ball is not in their court.
The page renders instead: **"Error Loading Loan Estimate — Unable to generate the loan estimate for
this application."** The `error` object is in scope at `:160` and never read.

This is the **same shape as F-061** on a different surface — a pattern worth fixing together: two
disclosure surfaces where the server hands the client a precise reason and the client component
substitutes a generic failure. The underlying condition is **F-079**.

**Fails:** DESIGN_SYSTEM §13 **Explanation**.

---

### ux-51 — Five sub-44px controls on the Landing's primary capture widget, invisible to the guard

**File:** `client/src/components/BuyingPowerEstimator.tsx:59-61`.

Measured at **320×720** on `origin/main` `4206025f`:

| control group | height | ≥44px |
|---|---|---|
| debt bands (None … $1,500+) | 50px | ✅ *by accident* — the labels wrap to two lines |
| **down-payment bands (~$10k … Not sure)** | **34px** | ❌ ×5 |
| "See my buying power" | 48px | ✅ |
| "← Adjust my numbers" (step 3) | **16px** | ❌ |

Both band groups use the same class; only text wrapping saves the first. **The whole
down-payment row of the hero estimator is untappable-by-standard on the smallest phone.**

**Why no guard caught it:** the class is built inside a `cn()` ternary —
`compact ? "px-2.5 py-2 text-xs" : "p-3 text-sm"` — and `guard:ui` is a text scan whose className
metrics see only literal double-quoted strings. This is the documented blind spot, and it is why
**#605 ("clear the touch-target backlog to zero, 232 → 0", merged 2026-08-20T19:06:58Z) can be
truthful and this can still be 34px today.** A guard only answers its own question.

**Fails:** DESIGN_SYSTEM §12 (designed at 320px).

---

### ux-52 — `/signup` links to neither the Terms of Use nor the Privacy Policy

**File:** `client/src/pages/public/Signup.tsx`.

The account-creation form's only links are *Skip to content*, *homiquity* and *Sign in* — verified
by enumerating every `<a href>` on the page. There is no consent checkbox and no footer. Every
other surface in the product carries *Privacy Policy* / *Terms of Use* / *Disclosures & Licensing*
in its footer; the signup page is a `BareLayout` with none.

This is the account that will hold the client's SSN, income and credit data. I am **not** asserting
a specific regulatory violation — only that the one screen where a person agrees to be a customer
is the one screen that shows them nothing to agree to, against the product's own standard
everywhere else.

**Fails:** DESIGN_SYSTEM §13 **Honesty** (positive, informed opt-in).

---

# 3. Buildable tickets

| # | ticket | owner lane | acceptance test |
|---|---|---|---|
| 1 | **`J-0822-02`** — invalidate `["/api/auth/user"]` in `PreApproval.tsx:204-207`'s `onSuccess` so the sidebar re-reads the promoted role without a reload | Capture Path Engineer (09:10) | Submit the funnel as a fresh `aspiring_owner`; without navigating, the sidebar reads **"Active Buyer" / "My Mortgage"** and offers *To-Do* and *Documents* |
| 2 | **`J-0822-04a`** — replace `dashboard.ts:306`'s `["credit_pull","disclosure","privacy_policy"]` with types that active templates can actually satisfy; add a unit test asserting every entry of `requiredConsentTypes` matches a live `consent_templates` row | Workflow Completion Engine (09:53) | Sign all six consents on `/e-consent`; the dashboard's *"Sign Required Disclosures"* action item **disappears**. Test fails if any required type has no active template |
| 3 | **`J-0822-04b`** — make the action-item count and `/e-consent` read one list | Workflow Completion Engine | The number in *"N consent(s) need your signature"* equals the *Pending* count on `/e-consent`, for 0, partial and complete states |
| 4 | **`J-0822-01a`** — label the `$607,000`: it is a **maximum qualifying purchase price at the 43% DTI cap**, not a loan amount. Fix the dashboard's *"pre-approved loan amount"* string; give the `/loan-options` headline a unit and a one-line basis | Primary Engineer (07:15) | For income 145k / debts 500 / down 50k / 720, `/dashboard` and `/loan-options` both name the figure as a max **purchase price** and state the DTI cap it assumes |
| 5 | **`J-0822-01b`** — `FunnelChrome.tsx:105-107`: render the PITI at the client's **target price**, or label it *"at the top of this range"* | Primary Engineer | With target $440,000, the teaser's `Est. …/mo` equals the LIVE ANALYSIS figure ($3,054), or explicitly says which price it describes |
| 6 | **`J-0822-01c`** — reconcile the four rate assumptions (6.75 / 6.5 / 6.375 / `baseRateFor`) onto one source, or make each surface state the rate it used | Primary Engineer | No two borrower-visible figures in one session are computed at different rates without both saying so |
| 7 | **`J-0822-01d`** — suppress the LIVE ANALYSIS payment while the unlicensed-state block is shown | Capture Path Engineer | Select California at funnel step 6 → no monthly payment renders anywhere on screen |
| 8 | **`J-0822-03`** — have `/apply` read `loadBuyingPowerScenario()` and prefill goal, income, debts and down payment, honouring the module's own stated contract | Capture Path Engineer | Complete the Landing estimator, click *Start my pre-approval*; steps 1, 5, 7 and 11 arrive **pre-filled** with 145,000 / 500 / 50,000 and the first-time-buyer box ticked |
| 9 | **`J-0822-05`** — `ApplicationSummary.tsx:164`: derive the note from the figure's real provenance instead of hard-coding "From your soft credit check" | Feature Completion Engine (12:30) | On an application with no `credit_pulls` row, the Debts note says the borrower reported it; after a pull, it says the pull |
| 10 | **`J-0822-06`** (+ **F-061**) — surface the server's `error` field on both disclosure surfaces: `LoanEstimate.tsx:160-176` and `LoanLetterButton.tsx:96-98` | Feature Completion Engine | The 409 renders *"…a required pricing setup step by our team is still pending"*; the 422 renders the verify-first reason, not *"Please try again"* |
| 11 | **`ux-51`** — raise the `compact` branch at `BuyingPowerEstimator.tsx:59-61` to ≥44px and give *"← Adjust my numbers"* a `touch-target` | Primary Engineer | At 320px every control inside `#buying-power` measures ≥44px tall in `scripts/browser-probe.cjs` output |
| 12 | **`ux-52`** — add Privacy Policy / Terms of Use links to `/signup` | Feature Completion Engine | `/signup` renders `<a href="/privacy">` and `<a href="/terms">` |
| 13 | **`J-0822-01e`** (needs a human first) — `/apply` promises *"a verified pre-approval letter in about 3 minutes."* The product issues a **pre-qualification** letter in three minutes and correctly refuses a pre-approval letter until documents are verified. Align the copy with the capability | founder call, then Primary Engineer | `/apply`'s intro names what the client actually receives |

**Not tickets — already registered, re-confirmed only:** F-0820-21, F-061, F-079.
**Flagged for `compliance-auditor`, not for a build lane:** the anti-steering option-category
mismatch in §1.7. It needs a captured Reg Z §1026.36(e), which `docs/reg-z/` does not hold.

---

# 4. What is genuinely solid

The founder asked which paths hold. These do, and several are better than the market:

1. **The application record.** Thirteen of thirteen funnel answers land in Postgres exactly as
   entered. No drops, no coercions, no silent defaults.
2. **The unlicensed-state hard stop.** Naming Illinois, citing NMLS #427468, offering
   independent verification, and removing the Continue button entirely. This is the Landing's
   promise kept precisely.
3. **Provenance discipline at the decision boundary.** The server refuses to mint a pre-approval
   letter from self-reported data, in as many words. `assertVerifiedForDecisioning` is real and it
   fires. The *UI* around it needs work; the *rail* does not.
4. **The FCRA opt-in.** Unchecked by default, submit genuinely blocked, canonical disclosure text
   plus IP and user agent written to `credit_consents`. I tried to break it and could not.
5. **Reg Z hygiene on the marketing surface.** The Landing estimator renders a price range and
   deliberately never renders its assumed rate or a payment; `/loan-options` pairs every Rate with
   an APR.
6. **`/e-consent`'s honesty line** — *"Nothing is recorded until you submit, and you can read the
   full text above first"* — and the eDisclosure gate's **disabled-until-ticked** button.
7. **The funnel's progress promise.** "Step 1 of 13 · ~3 min" → "Step 13 of 13 · 100%". The
   denominator never moved.
8. **The generated document set.** Correct for a W-2 buyer: W-2s for 2025 and 2024, 30 days of pay
   stubs, 2 months of bank statements, government ID. Nothing self-employed leaked in.
9. **Credit score rendered as "720 (720-759)"** — the value *and* the band it came from.
10. **No horizontal overflow at 320px** on the Landing, the dashboard, or the loan-options page.
11. **`/verification` degrades honestly** when its vendor is unconfigured, and offers a manual
    fallback rather than a spinner.
12. **ux-30 and ux-49 are fixed**, verified by walking to them rather than by reading a line.

---

# 5. Ledger

`knowledge-base/routines/journey-walk/LEDGER.md` updated: journey 2 walked 2026-08-22 against
`4206025f`, verdict WARN. **Next run walks journey 3 — active buyer, self-employed**, fresh signup
as `jse+<MMDD>@test.local`, with genuinely complex answers (`employmentType: "self_employed"`,
ownership ≥ 25%, two entities, one rental property).

**Standing note added for journey 3:** the rAF-starvation workaround in §0 is mandatory — the
funnel cannot be walked in this harness without forcing a frame after every click.

STATUS: WARN
