# Client Journey Walk — 2026-08-20 — Journey 1: Aspiring owner (renter, sandbox, never applies)

**Routine:** `client-journey-walk` (daily since 2026-08-19). **First run of this seat.**
**Persona:** 1 of 4 — aspiring owner. Ledger was absent, so the rotation starts at 1.
**Claim taken:** none. This seat writes no application code (CHARTER §6 — report + tickets only).

## Source of the charter

At the moment I started, `knowledge-base/feature-review/JOURNEYS.md` was **absent from `origin/main`**
(`git cat-file -e origin/main:…` → absent). Per the routine's own rule I therefore walked the
**persona summaries in the task prompt**. Its §1 on the branch copy corroborated the prompt's route,
and nothing in this report depends on it.

> **Now stale, and worth being precise about why.** I attributed that absence to PR **#607** not
> having merged. #607 is indeed still open (`DIRTY`) — but `JOURNEYS.md` reached `main` by a
> different road: **#595** carried it, and merged at **12:47Z**, fifteen minutes into the walk. So
> `JOURNEYS.md` **is on `main` now** and is authoritative from the next run onward. The file a doc
> is *expected* to arrive by is not evidence about whether it has arrived — the check is
> `git cat-file`, and it needs re-running at the end of a long run, not only at the start.

## Server under test — and why it is not the primary checkout

| | |
|---|---|
| Origin | `http://localhost:5001` (local only — the deployed site was never touched) |
| Serving commit | **`b799b91d`** = `origin/main` tip ("a11y: the shared chrome reaches 44px on phones", #602) |
| Worktree | `…/scratchpad/jw-wt`, detached from `origin/main`, `pnpm install` run fresh |
| Process | pid 59915, `cwd` verified via `lsof -a -p 59915 -d cwd`, started **09:32:20** today |
| `/api/health` | `{"status":"ok","commit":null,"email":{…}}` — `commit:null` is the local-dev signature; the presence of the `commit` **and** `email` keys rules out the stale port-5002 orphan class |

**I did not use `preview_start {name}`.** It boots the **primary checkout**, which is on
`feat/landing-coach-first` — 10 commits ahead of `origin/main`, carrying *landing-page* commits
plus three uncommitted files (`App.tsx`, `routeGates.ts`, `LoanDetails.tsx` — a peer's in-flight
ux-30 disclosure-gate work). Journey 1 begins at the Landing doors, so walking that checkout would
have reported findings against unmerged code. Everything below is `origin/main`.

**One consequence worth stating:** the prompt's route describes a *"You're renting now"* door on
Landing. At `b799b91d` **that door did not exist** — `Landing.tsx:36-84` offered six persona cards
(First-Time Buyers, Current Homeowners, Move-Up Buyers, Complex Income, Veterans & Military, Real
Estate Investors) and the string "renting" appeared **zero** times. So I took the **First-Time
Buyers → `/first-time-buyer`** door, which was this persona's door on the commit I walked.

> ## ⚠️ CORRECTED after the walk — `main` moved underneath it
>
> **[PR #595](https://github.com/barakatammre84/Homiquity/pull/595) merged at 2026-08-20T12:47:38Z**
> — roughly **fifteen minutes into this walk** (my server started 12:32Z). `origin/main` is now
> `8260d734`, and it **does** carry the four doors: `Landing.tsx:59-61` is `id: "renting"` /
> `title: "You're renting now"`.
>
> So the charter's route was **not stale — I was.** My original claim above ("that door does not
> exist on `origin/main`") was true of the commit I walked and false by the time I wrote it. The
> walk itself stands: it was a coherent read of one real commit, stated with its hash throughout.
> **The recommendation it produced was wrong and has been withdrawn** — I amended the seat guidance
> in `JOURNEYS.md`, not the Landing route, which needed no fix.
>
> Two further consequences of that merge, both verified rather than assumed:
> - **`JOURNEYS.md` is now ON `main`.** It is authoritative from the next run; this report is the
>   last one entitled to use the `SKILL.md` summaries.
> - **Every finding below was re-verified against `8260d734`.** #595 touched `borrowerGraph.ts`,
>   `HomeReadinessPassport.tsx`, `Profile.tsx` and `RenterHome.tsx` — all files this report cites.
>   **All findings survive**; the only edits were line numbers (`borrowerGraph.ts:582-592` →
>   **`:583-593`**; #595's sole change to that file was a copy string). Re-verification also turned
>   up a *new* regression that PR shipped — **ux-50**, below.
>
> This is the charter's own "date every standing claim" rail firing on the routine that quotes it.
> Fifteen minutes was enough.

## Environment notes (mine, not the product's)

- The browser pane arrived carrying a **stale `buyer@test.com` (`active_buyer`) session** from an
  earlier session's cookie jar. Cleared via `POST /api/auth/logout` before starting. Not a defect.
- `mcp__Claude_Browser__computer left_click` by `ref` **did not deliver clicks** on this page set —
  `elementFromPoint` confirmed the correct button was topmost and nothing fired. I nearly filed
  "the calculator's primary CTA is dead". It is not: invoking the same button's handler produced
  the correct write and navigation. **Reported here as a tool artifact, not a finding.**

---

# 1. The trace

### 1.1 `/` (Landing) — anonymous
Rendered clean, no console errors. Six doors (above). Two of the six — *Move-Up Buyers* and
*Real Estate Investors* — link **straight to `/apply`** with no explainer in between. Rates block
shows Rate **and** APR together (6.375% / 6.570%), which is the Reg Z pairing done right.

### 1.2 `/first-time-buyer` — the persona's door
Live rent→buying-power calculator, 3 inputs (rent, savings, rate slider) — **meets §12's ≤3**.
Defaults rent $2,000 / savings $15,000 / 6.5%.

- Changed rent **$2,000 → $3,300**. Recomputed correctly: P&I $2,475 (75%), T&I $825 (25%),
  loan **$391,572**, + savings $15,000 → headline **$407,000**. Verified independently: at 6.5%/360
  the annuity factor is 158.21, ×$2,475 = $391,570. ✅
- **320px: zero overflow, zero offenders** (`scrollWidth` 320 = `clientWidth` 320). ✅
- **Seam (write side): nothing is handed to the funnel.** `sessionStorage` and `localStorage` were
  both **empty** after tuning. Both CTAs (`FirstTimeBuyer.tsx:313,485`) go to
  `/apply?type=first-time` and never call `writeCalculatorPrefill`. → **JW-11**

### 1.3 `/learn`
9 articles. Two problems, both confirmed in source (§2). Also worth recording: clicking the
*"Home Buying Process"* topic — which advertises **"0 articles"** — lands on *"No articles found /
Check back soon for new content!"*.

### 1.4 `/resources`
8 cards, 4 filter chips. Three differently-titled cards resolve to **one** article. → **JW-09**

### 1.5 `/calculators/affordability` — the prefill seam
Set income **$137,000**, down payment saved **$400,000**, credit 680 (default).

- Result: **"You can afford up to $434,892"**, "Estimated monthly: $3,400/mo", badge
  **"DTI may require review"**, PMI **$172/mo**, front-end DTI **29.8%** against a stated
  *"Target: 28% or less"*. → **JW-02**
- **Seam (write side) — value equality holds.** Captured the write by hooking
  `Storage.prototype.setItem`:
  ```json
  {"annualIncome":137000,"monthlyDebts":0,"downPayment":400000,"creditScore":680,"purchasePrice":434892}
  ```
  All four figures match the screen exactly, and `purchasePrice` matches the rendered $434,892. ✅
  (Minor: the payload is written **twice** per click, identically — idempotent, no impact.)
- **Seam (read side) — also holds.** Landed on `/apply?price=434892&source=calculator`. The payload
  was **consumed at the intro splash**, before any form exists (`readCalculatorPrefill` removes on
  read). It nonetheless reached the funnel: step 1's LIVE ANALYSIS shows **"Qualifying income
  $137,000/yr"** and **"Loan-to-Value (LTV) 8%"** — 8% is exactly $34,892 ÷ $434,892, which proves
  *both* `downPayment` and `purchasePrice` survived. ✅
- I entered nothing into the funnel and **submitted nothing**.

### 1.6 `/signup`
5 inputs (first/last name are `required:false`), no visible terms/privacy acceptance control.
Created **`jr0820@test.local`** through the real form. `POST /api/auth/register` **200**, then 12
follow-on calls all **200**, landing on `/dashboard`. Clean. ✅

### 1.7 The seeded `renter@test.com` seat — **a step I could not walk as specified**
Logged in via `/test-login`; role `aspiring_owner` ✅. But `/dashboard` rendered the **full borrower
dashboard, not `RenterHome`** — because the seat carries a seeded application:

```
{"id":"03dcfb7c-…","status":"processing","employmentType":"self_employed","createdAt":"2026-07-02"}
```

The incubator gate is therefore **behaving correctly** — this user has a workable file. But it
means **the seat the charter names for journey 1 structurally cannot show journey 1's core
surface.** That is the same shape as the charter's own warning about `buyer@test.com` and the
promotion seam, and it should be fixed in the charter. I walked `RenterHome` on the fresh
`jr0820@test.local` account instead, and say so at every point below.

That seat did surface one real defect before I left it: **189 identical rows**. → **JW-06**

### 1.8 `/dashboard` → `RenterHome` (fresh account)
This is a genuinely good surface and it **has a floor**. Toolkit: Rent vs. Buy, Buying Power,
Rent-to-Own Path, My Lease & Rent Record, AI Coach; plus "Start pre-approval" and "Browse homes".
Header: **"10 / 100 · Home Readiness · Exploring · 0 of 5 verified"** — the 10 has no declared
source (§13 Provenance).

### 1.9 `/gap-calculator` — the sandbox's primary CTA
**8 pre-filled inputs on one screen** (§12 asks for ≤3 and one decision), seeded with values the
user never gave: credit **600**, income **$5,000/mo**, debts **$500**, rent **$1,500**, savings
**$0**, savings rate **$300**, target price **$350,000**, target down **$17,500**. → **JW-12**

Submitted them unchanged. `POST /api/homeownership-goal` **201** → a real, persisted terminus with
gap analysis, Credit Coach, Savings Vault, 30-Day Roadmap, Milestones and two next steps. **Not a
dead end.** ✅

It reports: Credit 600/640 · Savings $0/$17,500 · **DTI Ratio 10.0% — Within Guideline** ·
**Overall Progress 47% Toward homeownership**.

### 1.10 The seam that breaks — same data, four different answers
Returning to `/dashboard` immediately after, the same account now reads **20 / 100** and
**"Estimated max: $20,172"**. Querying the API behind it:

```json
{"liabilities":[
   {"source":"goal","monthlyAmount":500,"description":"Monthly debts (goal tracker)"},
   {"source":"goal","monthlyAmount":1500,"description":"Current rent payment (goal tracker)"}],
 "totalMonthlyDebts":2000, "estimatedDTI":40, "estimatedMaxPurchase":20172}
```

The renter's **rent is being carried as a debt that survives the purchase**. → **JW-01**

And "how ready am I?" now has four answers at the same instant on the same account:

| surface | reading |
|---|---|
| `/dashboard` (`HomeReadinessPassport.tsx:166`) | **20 / 100** |
| `/gap-calculator` | **47%** |
| `/profile` | **0% of required inputs complete**, "Nothing captured yet." |
| `/ai-coach` Pre-App Profile | **0 of 11 details captured** |

…and DTI has two: **10.0%** on `/gap-calculator`, **40%** from `/api/borrower-graph`. → **JW-03**

### 1.11 The rest of the sandbox nav, each to its terminus

| route | verdict |
|---|---|
| `/my-lease` | ✅ **Exemplary.** *"Saving a lease does not report anything to the credit bureaus. We are not an approved furnisher yet. Nothing here reaches your credit file, and we'll ask you first when that changes."* The qualification sits **at** the promise. Empty state names a next step. |
| `/down-payment-wizard` | ✅ **Best-in-class.** 6 Illinois programs (IHDA / City of Chicago / Cook County), dated provenance *"verified with the administering agencies as of July 2026"*, agency attribution, funding-can-pause caveat. Directly serves Illinois-first. |
| `/ai-coach` | ✅ **Promise kept.** Asked *"I want to buy my first home — where do I begin?"* and got a real, well-structured answer (What's needed / Why / Effort / What it unlocks) in ~9s. PII warning, NMLS #427468, educational disclaimer all present. Its Pre-App Profile reads 0 of 11 — see JW-03. |
| `/onboarding` ("My Journey") | ⚠️ Renders, but is **entirely the application pipeline at 0%** — Apply → Verify ID → Upload Docs → Disclosures → Credit Check → Review → Letter. For a persona defined by not applying, the only forward motion offered is to apply. → **JW-13** |
| `/messages` | ⚠️ "Your Team" lists six staff, none assigned, including **Admin User / Tech/Ops Lead**. → **JW-10** |
| `/profile` | ⚠️ "Nothing captured yet" / "0% of required inputs complete" — see JW-03. |
| `/properties` | ⚠️ Renders 12 **seeded** national listings (Minneapolis, Virginia Beach, Phoenix, Denver…). Simulated inventory; recorded as a launch-readiness observation, **not** filed as a defect. |
| `/apply` (nav "Get Pre-Approved") | Reachable locally. In production it is `<Gated>`; under PRELAUNCH the sandbox's only exit is the waitlist. Recorded as the gate working. |

### 1.12 Responsive
- `/first-time-buyer` @320px — **clean**. ✅
- `/gap-calculator` @320px — **`TabsList` is 466px wide inside a 288px parent**, `overflow-x:
  visible` on both, and the document does **not** scroll (`scrollWidth` 320 = `clientWidth` 320).
  *30-Day Roadmap* (right edge 382) and *Milestones* (right edge 478) are rendered **off-viewport
  with no way to reach them**. → **JW-05**
- 7 sub-44px controls on `/gap-calculator` — **already in flight as PR #605** (232 → 0). **Not
  filed**, per the don't-re-report rail.

### 1.13 End-of-journey assertions

```json
{"email":"jr0820@test.local","role":"aspiring_owner","applicationCount":0}
```

- Role at start **`aspiring_owner`**, role at end **`aspiring_owner`** — **never promoted** ✅
- **Zero applications created** — the forbidden act was not performed ✅
- Console across the whole walk: one 404 (`/api/auth/me`, my own probe — the real endpoint is
  `/api/auth/user`) and 401s from anonymous-state polling. **No 4xx under any success message.**

---

# 2. Findings, ranked by what they cost a client

## (b) Completes, but the data is wrong

### JW-01 — The renter's rent is counted as a debt that survives the purchase (**F-0820-01**)
- **Surface:** `/dashboard` (`HomeReadinessPassport.tsx:176` "Estimated max"), and everything else
  fed by `/api/borrower-graph`.
- **File:** `server/services/borrowerGraph.ts:583-593` (the push), `:700-708` (`totalMonthlyDebts`),
  `:735` (`estimatedDTI`), `:765-771` (`estimatedMaxPurchase`). Line numbers are against `8260d734`;
  the push sat at `:582-592` on the `b799b91d` I walked — #595 shifted it by one and changed nothing else.
- **Observed:** income $60,000/yr, real debts $500/mo, rent $1,500/mo →
  `liabilities` contains `"Current rent payment (goal tracker)": 1500`; `totalMonthlyDebts: 2000`;
  `estimatedDTI: 40`; `estimatedMaxPurchase: 20172`. The dashboard renders
  **"Estimated max: $20,172"** beside the user's own **$350,000** target.
- **Expected:** rent is extinguished by the purchase and is not a continuing liability. Excluding
  it: `5000 × 0.43 − 500 = $1,650` → `1650 × 158.21 × 0.85 ≈ **$221,900**`. The displayed figure is
  **~11× too low**, and DTI is 4× too high.
- **Fails:** DESIGN_SYSTEM §13 **Provenance** (no source declared for a headline number) and
  §13 **Agreement** (40% here vs 10.0% on `/gap-calculator`).
- **Why it is the top finding:** paying rent is the *defining trait* of this persona, and this is
  the highest-traffic authenticated surface set in the product. Every renter who completes the gap
  calculator gets it.
- **Not previously recorded:** `grep -c "current rent payment (goal tracker)" FINDINGS.md` → 0.

### JW-02 — The affordability calculator charges PMI on every scenario and ignores actual savings (**F-0820-02**)
- **Surface:** `/calculators/affordability` — and, via `writeCalculatorPrefill`, the funnel.
- **File:** `client/src/lib/affordabilityEstimate.ts:81` (`minDownPaymentPercent`), `:83`
  (`maxFromDownPayment`), `:93-95` (T&I basis + PMI), `:99-101` (`frontEndDTI`, `withinGuidelines`).
- **Observed (measured, not derived):** income $137,000, **down payment saved $400,000**, credit
  680 → the page still charges **PMI $172/mo** and still says **"DTI may require review"**.
  A 92%-down buyer is charged mortgage insurance.
- **Root cause:** `minDownPaymentPercent` is a function of **credit score only** (0.03 / 0.05 /
  0.10). Its maximum possible value is 0.10, and PMI is gated on `minDownPaymentPercent < 0.2` —
  so **PMI can never be zero for any input**. `downPaymentSaved` enters only as a cap that never
  binds. Separately, PMI and the T&I basis mismatch (`:93-94` compute taxes/insurance on
  `maxHomePrice` while the solver budgeted them off the *loan*) are added **after** the entire 28%
  front-end budget is spent, so `frontEndDTI` is always ≈29.8% > 28 and `withinGuidelines` is
  **always false**.
- **Expected:** derive the down-payment percentage from `downPaymentSaved / maxHomePrice`; drop PMI
  at ≥20%; solve so the returned price satisfies the guideline the page displays.
- **Evidence of the cross-surface cost:** the same scenario one click later at `/apply` reads
  **LTV 8%, $671/mo, "DTI 6% — Looking great!"** against the calculator's **$3,400/mo, 29.8%,
  "may require review"**. Fails §13 **Agreement**.
- **Overlap noted:** the arithmetic belongs to the Algorithm Auditor's lane; it is filed here
  because the wrong `purchasePrice` crosses the seam into the application.

## (a) Cannot complete — on a 320px phone

### JW-05 — Two of the four gap-plan tabs are unreachable at 320px (**ux-44**)
- **Surface:** `/gap-calculator`, results view.
- **File:** `client/src/pages/borrower/GapCalculator.tsx:275-280` — a bare `<TabsList>`.
- **Observed:** `TabsList` measures **466px** inside a **288px** parent; `overflow-x: visible` on
  both; document `scrollWidth` 320 = `clientWidth` 320, so there is no scroll path.
  *30-Day Roadmap* and *Milestones* sit at right edges 382 and 478 — off-screen and unreachable.
- **Expected:** the tab strip scrolls horizontally, wraps, or collapses to a select at 320px.
- **Fails:** DESIGN_SYSTEM §12 (mobile designed at 320px).
- **Dated:** **not** covered by PR #587 (public `/calculators/*` only — 9 files, none of them this
  one) nor by PR #605, whose only `GapCalculator.tsx` change is adding `touch-target` to the
  *Update Info* button.

## (c) Completes, but is not best-in-class

### JW-03 — Four surfaces give four answers to "how ready am I?" (**ux-43**)
Same account, same instant: `/dashboard` **20/100**, `/gap-calculator` **47%**, `/profile` **0% —
"Nothing captured yet"**, `/ai-coach` **0 of 11 captured** — while the goal tracker holds income,
debts, rent, credit score and target price. DTI is **10.0%** on one surface and **40%** on the API
behind another. Fails §13 **Agreement**. The harmful reading is the high one: *47% toward
homeownership* is told to someone with **$0 saved**.
*Honest caveat:* `/ai-coach`'s panel is captioned "Everything the **coach** captures", so 0-of-11 is
literally true of its own scope — but the client is nonetheless asked again for what they just
supplied, and `/profile`'s bare "Nothing captured yet" has no such scoping.
**Files:** `client/src/components/HomeReadinessPassport.tsx:166-176`,
`client/src/pages/borrower/GapCalculator.tsx`, `client/src/pages/profile/Profile.tsx`.

### JW-06 — 189 identical rows on the borrower dashboard (**ux-45**)
- **File:** `client/src/components/BorrowerRequests.tsx:212-231`.
- **Observed:** on `renter@test.com`, **189** consecutive rows reading *"We're reviewing a document
  you uploaded."* — identical, none naming a document. The **pending** list directly above is
  capped with a *"View all N requests"* link (`:196-203`); the in-progress list has **no cap, no
  dedup, no overflow link**. The same card simultaneously renders *"Nothing needed from you right
  now."* (`:206-210`) and a page-level *"Action needed"* banner.
- **Expected:** cap at 3–5 with a count, or group identical `borrowerDisplayText` into one row
  ("We're reviewing 189 documents you uploaded").
- **Honest caveat:** 189 is seed volume; an organic file would carry fewer. The **absence of any
  cap** is structural regardless.
- **Fails:** §13 **Agreement** ("Action needed" vs "Nothing needed from you right now").

### JW-07 — "Browse by Topic" is mouse-only (**ux-46**)
- **File:** `client/src/pages/education/LearningCenter.tsx:216-219`.
- **Observed:** each topic card is a bare `<div onClick={…}>` with **no** `role`, `tabIndex` or key
  handler. Measured: **0 focusable elements** in the entire topic grid. Keyboard and screen-reader
  users cannot browse by topic at all.
- **Expected:** `<button>` (or `role="button"` + `tabIndex={0}` + Enter/Space).
- **Fails:** WCAG **2.1.1 Keyboard** (Level A) — the repo's AA commitment (CLAUDE.md, `ui-components`).
- Secondary: the *"Home Buying Process"* card advertises **"0 articles"** and lands on *"No articles
  found"*. Either seed the category or hide empty ones.

### JW-08 — Public view counters advertise near-zero readership, and say "1 views" (**ux-47**)
- **Files:** `client/src/pages/education/LearningCenter.tsx:75`,
  `client/src/pages/education/ArticleDetail.tsx:178` — `{article.viewCount || 0} views`.
- **Observed on `/learn`:** `3 views`, **`1 views`**, `0 views`, `2 views`, `2 views`, `4 views`,
  `19 views`, `0 views`, `0 views`.
- **Expected:** drop the counter from public marketing surfaces, or suppress below a threshold and
  pluralize. A prospective borrower reading "0 views" on the down-payment guide learns only that
  nobody else has read it.

### JW-09 — `/resources` sends three differently-titled cards to one article (**ux-48**)
- **File:** `client/src/pages/education/Resources.tsx:72`, `:105`, `:116` — all
  `/learn/first-time-homebuyer-guide`.
- **Observed:** *"How to pick a real estate agent"*, *"Making a competitive offer"* and *"The
  complete guide to buying a home"* share one destination. The first two are the **sole** members
  of their filter categories (`agent`, `offer`), so filtering to "Finding an agent" yields exactly
  one card that does not go where it says.
- **Expected:** write the two articles, deep-link to the guide's relevant anchors, or remove the
  categories until content exists.
- **Fails:** §13 **Honesty**.

### JW-10 — "Your Team" is fabricated for a persona with no application (**ux-49**)
- **Surface:** `/messages`; endpoint `/api/team-members`.
- **Observed:** returns **all six** staff accounts — `underwriter`, `processor`, `closer`, `loa`,
  `lo`, and **`admin@test.com` (role `admin`, rendered to the borrower as "Tech/Ops Lead")** — with
  no assignment concept, to an account with **zero** applications, under the heading *"Your Team —
  Chat with your mortgage team"*.
- **Expected:** show only genuinely assigned staff; empty-state honestly ("You'll meet your team
  when you start an application"); exclude the `admin` role from any borrower-facing roster.
- **Fails:** §13 **Honesty**.
- **⛔ Referred for §9 security review** — whether every authenticated borrower should receive the
  full internal staff roster including Tech/Ops is an access-control question, not a walker's call.
  Flagged, **not** asserted as a vulnerability.

### ux-50 — The assistant rename shipped "yHomi" to the profile page, and its own guard can't see it
- **Found during the post-walk re-verification**, not the walk — #595 landed mid-run and I re-read
  every file this report cites against `8260d734`.
- **File:** `client/src/pages/profile/Profile.tsx:298`, `:312`, `:445`.
- **Observed on `main` right now:** *"captured by **yHomi** ·"*, *"Nothing captured yet. Chat with
  **yHomi** — every detail you share is saved here automatically."*, *"Continue with **yHomi**"*.
  All three are `+` lines in #595: the replace matched `our AI Coach` inside **y**`our AI Coach` and
  substituted `Homi`, orphaning the `y`. A comment in the same diff carries the matching slip —
  *"the same record **the Homi** writes to"*.
- **The half that makes it worth a row:** #595 also shipped `tests/assistantNaming.test.ts`
  *specifically* to stop the name drifting again. Its `BANNED` list holds the five **old** names
  (`AI Coach`, `AI Homebuyer Coach`, `Homiquity Coach`, `AI coach`, `readiness assistant`), and its
  own docstring concedes it is *"a VOCABULARY list, not a semantic check — it can only catch
  spellings someone has already thought of."* **A corruption produced by the rename is not an old
  name**, so the suite is green while three user-visible strings are misspelt. A rename guard that
  only knows what it renamed *away from* is blind to what the rename *did*.
- **Expected:** fix the three strings, and add a positive assertion the guard can fail on — `Homi`
  must never be preceded by a word character.
- ⚠️ **Scope honesty:** the three strings on their own are a single-surface copy defect and belong
  to another seat (CHARTER §7). Registered here for the **guard gap**, which is not single-surface.

### JW-11 — The persona's own door drops its figures at the seam
- **File:** `client/src/pages/public/FirstTimeBuyer.tsx:313`, `:485`.
- **Observed:** the page's rent→buying-power calculator produces rent, savings and a home price,
  then links to `/apply?type=first-time` having written **nothing** (`sessionStorage` and
  `localStorage` both empty). `/calculators/affordability` and `/calculators/rent-to-own` both call
  `writeCalculatorPrefill`; this page does not.
- **Expected:** stash `{downPayment, purchasePrice}` on the navigate path — precisely what
  `lib/calculatorPrefill.ts:53-58` authorizes ("Call this ONLY on a path that actually navigates to
  /apply"), whose own docstring calls the channel *"load-bearing for intake quality, not a nicety"*.
- **Constraint the implementer must honour:** the page promises *"Everything stays on this page —
  we don't collect or store any of it."* Either scope that sentence to the on-page calculation or
  adjust it; do not silently contradict it.
- **Dated:** long-standing — the file's last four commits (`da697a7e`, `bc860760`, `7d3e1539`,
  `764df2dc`) are styling/content, none touching the handoff.

### JW-12 — `/gap-calculator` intake: 8 pre-filled inputs on one screen
- **File:** `client/src/pages/borrower/GapGoalOnboardingForm.tsx` (rendered by `GapCalculator.tsx`).
- **Observed:** 8 inputs on one screen, every one **pre-populated with a value the user never gave**
  (credit 600, income $5,000/mo, debts $500, rent $1,500, savings $0, rate $300, target $350,000,
  down $17,500), under the heading *"Tell us about your current situation so we can create your
  personalized plan"*. A user who accepts the defaults gets a "personalized" plan built from
  invented numbers — which then become the dashboard's headline figures via `borrowerGraph`.
- **Fails:** §12 (one decision per screen, ≤3 visible inputs) and §13 **Provenance**.

### JW-13 — `/onboarding` offers a renter nothing but the application
The sandbox's "My Journey" is the application pipeline at 0% (Apply → Verify ID → Upload Docs →
Disclosures → Credit Check → Review → Letter). It renders and names a next step, so it is not
broken — but for the one persona defined by *not* applying, every step is across the boundary.
**The question only this seat answers — after exhausting every offered step without applying, what
is left?** Answer on `main`: the gap plan, the lease ledger, the DPA directory and the coach — all
real. `/onboarding` and `/messages` are the two that have nothing to say to this persona.

## Observations — recorded, deliberately not filed

- **`/signup` has no terms/privacy acceptance control** and 5 inputs. Whether account creation must
  record ToS/Privacy assent is a compliance question → **Compliance Watch**, not a walker ticket.
- **`/properties`** serves 12 seeded national listings. Simulated inventory; a launch-readiness fact.
- **7 sub-44px controls on `/gap-calculator`** — covered by open **PR #605**. Not filed.
- ~~The charter's Landing route is stale against `main`~~ — **WITHDRAWN**: #595 landed the four doors mid-walk. The route was right; see the corrected box in §1.
- **The charter's journey-1 account cannot reach journey 1's core surface** (§1.7).

---

# 3. Buildable tickets

| id | ticket | suggested lane | acceptance test |
|---|---|---|---|
| **F-0820-01** | Stop counting `currentRent` as a liability in `borrowerGraph.ts:583-593`; it must not enter `totalMonthlyDebts`, `estimatedDTI` or `estimatedMaxPurchase`. Keep the rent datum — it is used elsewhere — but exclude it from debt aggregation. | **Backend Data Engineer** (`server/**`) | Goal with income $60k/yr, debts $500/mo, rent $1,500/mo → `/api/borrower-graph` returns `totalMonthlyDebts: 500`, `estimatedDTI: 10`, `estimatedMaxPurchase ≈ 221,900`. Regression test asserts no liability row is sourced from `currentRent`. |
| **F-0820-02** | In `affordabilityEstimate.ts`: derive the down-payment percentage from `downPaymentSaved / maxHomePrice` (floored at the credit-based minimum), zero PMI at ≥20%, compute T&I on the same basis the solver budgets, and solve so the returned price satisfies the displayed 28% target. | **Primary Engineer** (+ Algorithm Auditor to re-verify) | Income $137k, saved $400k, credit 680 → `monthlyPMI === 0` and `withinGuidelines === true`. A ≤5%-down case still charges PMI. |
| **ux-44** | Make `GapCalculator.tsx:275` `<TabsList>` reachable at 320px — horizontal scroll, wrap, or a select. | **Wiring Audit** / UI Conformance | At 320px, `Milestones` is reachable by scroll or tap; no element's right edge exceeds the viewport without a scroll path. |
| **ux-43** | One selector for borrower readiness, consumed by `/dashboard`, `/gap-calculator`, `/profile` and the coach panel — the `lib/outstandingWork.ts` pattern applied to readiness. | **Wiring Audit** (`client/src/**`) | One account, one moment → all four surfaces render the same percentage; a test pins them to one source. |
| **ux-45** | Cap or group the in-progress list in `BorrowerRequests.tsx:212-231`; reconcile "Action needed" with "Nothing needed from you right now". | **Wiring Audit** | 189 in-progress tasks render ≤5 rows plus a count; the card never shows "Nothing needed" while a page banner says "Action needed". |
| **ux-46** | `LearningCenter.tsx:216-219` → real `<button>`; hide or seed zero-article categories. | **UI Conformance Sweep** | Tab reaches every topic card and Enter activates it; the topic grid reports >0 focusable elements. |
| **ux-47** | Remove the public view counter (`LearningCenter.tsx:75`, `ArticleDetail.tsx:178`) or threshold + pluralize it. | **UI Conformance Sweep** | `/learn` renders no "0 views" and no "1 views". |
| **ux-48** | Fix the three-cards-one-article collision in `Resources.tsx:72,105,116`. | **Primary Engineer** (content) | No two `/resources` cards with different titles share an `href`; every filter category has at least one card that goes where it says. |
| **ux-49** | `/api/team-members` returns only assigned staff and never the `admin` role; `/messages` gets an honest empty state. **Ships as a draft PR with a §9 review** (access control). | **Backend Data Engineer** + §9 review | A borrower with 0 applications sees an empty state, not six staff; no response contains `role: "admin"`. |
| **ux-50** | Fix `yHomi` at `Profile.tsx:298,312,445` **and** give `tests/assistantNaming.test.ts` a positive assertion (`Homi` never preceded by a word character) so the guard can fail on the rename's own damage, not only on old names. | **UI Conformance Sweep** | Reintroduce `yHomi` → the naming test reds. Today it stays green. |
| **JW-11** | Call `writeCalculatorPrefill({downPayment, purchasePrice})` on the `/apply` navigate path in `FirstTimeBuyer.tsx:313,485`, and reconcile the "we don't store any of it" copy. | **Capture Path Engineer** | Tuning rent/savings then clicking through lands on `/apply` with those figures reflected in LIVE ANALYSIS. |
| **JW-12** | Split `GapGoalOnboardingForm` to ≤3 inputs per step and stop pre-filling fabricated financial values (empty + placeholder, not a default). | **Wiring Audit** (§12) | No step renders >3 inputs; a fresh user's first render has no numeric value in any financial field. |
| **JW-13** | Give `/onboarding` a renter track, or route `aspiring_owner` with no application to the gap plan instead. | **Feature Completion Engine** | An `aspiring_owner` with 0 applications sees at least one next step that is not "apply". |

Rows **F-0820-01, F-0820-02, ux-43 … ux-49** are new — verified absent from `FINDINGS.md` before minting
(no existing row matches `borrowerGraph`, `estimatedMax`, the readiness split, `BorrowerRequests`,
`LearningCenter`, `Resources.tsx` or `team-members`). Next free ids were `F-0820-01` and `ux-43`.
No Closed row was re-opened.

---

# 4. What is genuinely solid

The founder needs this half too. On `origin/main`, walked as a person, these were right:

- **`/my-lease`** puts the disqualifier *at* the promise: not an approved furnisher, nothing reaches
  your credit file, we'll ask first. This is the standard the rest of the app should copy.
- **`/down-payment-wizard`** — six real Illinois programs, dated to July 2026, attributed to the
  administering agencies, with an explicit "funding can pause without notice". Launch-grade.
- **`/ai-coach`** answers, and answers well, with the PII warning and NMLS ID in place.
- **The calculator → funnel handoff carries all four values exactly** — income, debts, down payment
  and price survived, proven by an 8% LTV that can only come from both of the last two.
- **Signup → `postAuthRoute` → `RenterHome`** is clean: 13 requests, all 200.
- **`/first-time-buyer` is pixel-clean at 320px** and its rent math is correct to the dollar.
- **`RenterHome` has a floor.** Five toolkit destinations, all real, none a stub.
- **The role never moved.** `aspiring_owner` in, `aspiring_owner` out, zero applications created.

---

# 5. Ledger

Next run resumes at **Journey 2 — Active buyer, W-2 salaried**
(`jw2+<MMDD>@test.local`, fresh signup, must end `active_buyer`).
Recorded in `knowledge-base/routines/journey-walk/LEDGER.md`.

STATUS: WARN
