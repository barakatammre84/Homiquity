> **Landed 2026-08-18** (audit Step 2, same provenance as the sibling knowledge doc). This is the
> **append-only audit trail** — the raw observations behind every claim in
> [HOMIQUITY-PROJECT-KNOWLEDGE.md](HOMIQUITY-PROJECT-KNOWLEDGE.md). Never edited, only appended
> by future logged-in deep-dives (founder signs in; Claude observes — no credential handling,
> ever). All borrower PII was deliberately excluded at capture time.

# Better.com Experience Teardown — for Homiquity
Session: 2026-08-18 | Method: user-driven walkthrough, Claude observing

## Baseline captures

### Better.com homepage (logged out)
- Nav: Buy | Refinance | Home Equity | Rates | Better+ ... phone icon | Sign in | **Get started** (green pill CTA)
- Hero: dark forest-green background, huge display type.
  H1: "**Betsy AI** gets you cash from your home cheaper, faster, and easier."
  ("Betsy AI" rendered in a pink→cyan gradient; rest in white)
- Sub: "Ask Betsy about buying, refinancing, or cashing out. She'll get you the best product and make everything fast and easy."
- Social proof INSIDE hero, low-contrast grey numerals: **$110B+** funded loans · **600k** customers served
- **Primary interaction = a chat composer**, not a form. Rounded white card, mic icon + send arrow.
  Placeholder: "I want to lower my monthly pay"
- 4 intent chips under the composer (each with an icon):
  → Start my pre-approval | ↓ Lower my rate | 🏛 Start saving | 💳 Get cash
- Trust row inside the composer card footer: "Direct lender:" + Fannie Mae, Equal Housing, Freddie Mac logos
- Right side of composer footer: **Betsy AI Mode ⟷ Classic Mode** toggle (AI is default)
- Micro-disclaimer under card: chat is recorded / privacy policy
- Below fold: family-of-companies grid (Mortgage, Real Estate, Cover/insurance, Inspect, Settlement/title)
- Footer: calculators (affordability, mortgage, rent-vs-buy, HELOC payment, HELOC vs cash-out), company, heavy legal/licensing block

### Type & color (extracted from live DOM)
- Typeface: **"Better Sans"** (custom), fallback -apple-system/system-ui/Segoe UI/Roboto. Secondary: Graphik.
- Only two weights in use: **400 and 700**. No 500/600 — deliberate simplicity.
- Body text: 16px / 24px line-height (1.5), letter-spacing normal
- Muted text color: rgb(86,93,90) — a desaturated green-grey, NOT neutral grey
- Button radius: **8px**, padding 0 40px
- Disabled button: bg rgb(199,201,197), text rgb(111,118,114)

### Sign-in screen (/login)
- Radically stripped: white bg, centered column, ~325px form width, nothing else. No nav, no footer, no marketing.
- Wordmark "Better" in green serif-ish display, centered, large
- Copy: "Enter your email or phone number to continue"
- **Single field: "Email or phone number"** — one input, accepts either. No password on this screen.
- Continue button disabled until valid (grey), then presumably green
- "or" divider → Sign in with Google
- "Don't have a Better account? Sign up →"
- NOTE: passwordless-first / progressive auth. Identifier first, credential second.

## Homiquity.com — current state (baseline for gap analysis)
- Nav: homiquity wordmark (green) | Buy ▾ | Refinance & HELOC ▾ | Rates | Calculators | Resources | Glossary | phone (224) 400-0531 | [CTA button appears EMPTY/unstyled — bug]
- Trust pill above H1: "Built by a military veteran with 15+ years in banking"
- H1: "Clarity for every stage of homeownership." ("of homeownership" in green)
- Sub: buying / refinancing / investing — understand options, move forward with confidence
- CTAs: **Start Your Pre-Approval →** (green solid) | Can I Afford This Home? (white outline)
- Reassurance row: ✓ No hard credit check ✓ Takes about 3 minutes ✓ 100% free
- Hero right: **large empty card — image/illustration is missing or failed to load**
- Sections: See Your Buying Power (3-step GOAL→NUMBERS→ESTIMATE mini-quiz, on-device, no signup)
  · Journey personas (First-Time, Current Homeowners, Move-Up, Complex Income, Veterans & Military, Investors)
  · How it works (4 steps) · Before You Shop · Today's rates · Trust block (15+ yrs, Veteran-Founded,
    Rules-Based Decisions "No black-box AI approvals", Fair Lending First, Bank-Grade Security)
  · Founder note · Final CTA + "Not sure yet? Talk to our AI Coach"

### Immediate gaps vs Better (first pass)
1. Hero image slot is blank — kills first impression.
2. Header CTA button renders empty.
3. Homiquity leads with a *statement*; Better leads with an *input*. Better's hero is interactive.
4. Homiquity has no social-proof numbers in hero (Better: $110B+ / 600k).
5. "AI Coach" is buried in the final CTA; Better makes its AI the entire hero.
6. Positioning tension: Homiquity's trust block says "No black-box AI approvals" while also selling an AI Coach — needs reconciliation, not removal (it's actually a strong differentiator if framed right).

---

## WALKTHROUGH LOG (user-driven)

### STEP 1 — Post-login loan dashboard (/my-loan/{loanId}/overview)
Layout shifts completely from marketing site → app shell. No marketing nav, no footer.

**Top bar:** collapse-sidebar icon | "Better" wordmark (now BLACK, not green) | right side: circular
property/avatar thumbnail + a small pill "**Purchase**" + "**Orland Park, IL**" + chevron.
→ Loan-switcher in the top-right. The pill tells you WHICH loan you're in (loan type + property
   location) — critical because a user can have multiple loans. Cheap, high-value pattern.

**Left sidebar (5 items, icon + label):**
Overview (active — light grey pill, green text) | Tasks **[6]** badge | My files ▾ | Help & Learn ▾ | Account
→ Only ONE numeric badge, on Tasks. The badge IS the call to action. Nothing else competes.

**Main column:**
- "Hi anmre," / "Welcome to your loan dashboard!" — personalized, 2-line H1, uses the name as entered
  (lowercase "anmre" — they do NOT title-case it. Small polish miss.)
- Body copy sells the NEXT action with a *reason*: upload financial info → One Day Verified Approval
  Letter → "your offers stand out, because sellers will see you've been vetted by a lender and so your
  offer is less likely to fall through."
  → Note the structure: action → artifact → **competitive benefit**. Not "upload docs" but "win the house."
- Single green pill CTA: **Get verified**

**Right rail — the 5-step loan tracker (the spine of the whole app):**
1. ~~Pre-Approval~~ (strikethrough) — badge "Done: Nov 25" (pale green)
2. **Make an offer & lock your rate** — badge "Required" (solid green)
   sub: "Confirm your property address and secure your rate for your new home."
   link w/ clock icon: "Get Verified Approval Letter" + ⓘ tooltip
   secondary link: "Add property details"
3. Conditional Approval — "We review and verify your financial information"
4. Final Underwriting Approval — "Your loan is reviewed and prepared for final approval"
5. Closing — "Sign your closing documents and complete the purchase of your home."
→ Steps 3–5 are greyed/inactive with plain-language descriptions. **They show the whole road, but only
  one step is lit.** Completed = struck through + dated. Current = "Required" badge + actions inline.
  This is the single most copyable pattern for Homiquity.

**Below the fold — "We're finding the right Loan Consultant to help you personalize your rate!"**
- Waiting state is turned into a productive state: "While we match you with a Loan Consultant, get a
  head start by completing your tasks to keep things moving smoothly."
- Green-tinted card: "Here's how your Loan Consultant can help you:" ✓ tailored financing solution
  ✓ clear, straightforward guidance ✓ expert consultation for informed decisions
- "Your Loan Consultant will be assigned soon · Call us anytime at the number below. 415-523-8837"
→ They never leave dead air. An unassigned human is reframed as an anticipated benefit + a task to do
  meanwhile + a phone number as the escape hatch.

**Persistent "Ask Betsy" button** — bottom-right, dark green pill w/ logo mark, floats above content.
→ AI is present in the *servicing* experience too, not just acquisition.

### STEP 2 — "Verified approval" task flow (borrower information)
[PII redacted throughout — recording structure and copy only, not the user's real values.]

**Task shell chrome:**
- Top: a floating rounded "task card" header — 📄 icon + "**Verified approval**" + superscript progress
  "**1/1**" + a ▾ chevron (expands to show sub-steps / jump between them).
  → Progress indicator is *inline in the task title*, not a separate progress bar. Compact.
- Bottom: a **persistent sticky action bar** pinned to the viewport, above the content:
  left = "Support ?" pill (white, outlined) · right = "**Submit**" (green pill) · "Ask Betsy" floats beside it.
  → Submit is ALWAYS reachable. You never scroll hunting for the button. Support is always one click away,
    at the exact moment of confusion. This is a big one.

**Form: "Confirm {FirstName}'s information"** / sub: "Let's make sure we have the correct details for you."
→ Note the framing verb: **"Confirm"**, not "Enter". Fields arrive pre-filled from earlier steps. The
  psychological ask is review-and-approve, not data entry. Much lower perceived effort.
→ Also note: the H2 title-cases the name ("Confirm Anmre's information") while the dashboard greeting
  did not ("Hi anmre"). **Inconsistent name formatting between screens.** Real bug worth avoiding.

Field sequence observed:
1. "Confirm your full legal name*" → First Name* | Middle Name | Last Name* | Suffix (select)
   → 4 fields on ONE row. Required marked with a red asterisk. Middle/Suffix optional and unmarked.
2. "Marital status*" → select (Unmarried / …). Focused state = **green 2px border**.
3. "Is there a person who isn't your spouse but could make an ownership claim on the property? This
    could be a relationship like a domestic partnership or civil union.*" → Yes / No segmented pills
   → Legally-required question, but written in plain English WITH an example clause. No jargon
     ("non-borrowing party with dower rights"). Copy pattern to steal: **question + "This could be…" example.**
4. "Citizenship status*" → select, placeholder "Select an option"
5. **"Enter your residential history"** — a bordered sub-card (a fieldset-as-card):
   - "Your address*" → street (wide) | unit (narrow) — 2-col ratio ~3:1
   - city (full width)
   - state (select, wide) | ZIP (narrow)
   - "When did you move into this address?*" → native date input mm/dd/yyyy w/ picker
   - "Is this your current residence?*" → Yes/No segmented; **selected state = white pill + green ✓ icon
     inside it**, unselected = flat grey pill. The checkmark inside the chosen option is a nice touch.
   - "How would you describe your living situation?*" → select (Own / …)
   - horizontal rule, then **Cancel (outline) | Save (green)** — LOCAL actions scoped to this sub-card
   → Two-tier action model: sub-cards Save/Cancel independently; the page Submits as a whole.
     Lets them collect a *repeating* structure (address history = N entries) without losing page state.
6. Below: checkbox "My mailing address is different from my current address"
   → Progressive disclosure. Default assumes the common case; the exception is opt-in.

**Input styling:** ~8px radius, 1px grey border, generous height (~56px), label ABOVE field (never
placeholder-as-label), red `*` for required. Selects use the native chevron.

### STEP 2b — Conditional branching inside the same form
More of the same task, scrolled. This is where the real logic shows.

**Checkbox cluster (progressive disclosure, all default-off):**
- ☐ My mailing address is different from my current address.
- ☐ I used different home address on my **2024** tax return.
- ☐ I used different home address on my **2023** tax return.
→ Two separate tax-year checkboxes, hard-coded to the last two years. Each presumably reveals an
  address sub-card. Rather than "add prior addresses" (vague), they ask the *specific* question the
  underwriter needs. User doesn't have to guess how much history is enough.

**Occupancy & ownership:**
- "Do you plan to occupy the property as your primary residence?*" → Yes/No (Yes selected)
- "Have you owned any other real estate in the past three years?*" → Yes/No
  **→ Answering YES expands two more required question groups in place (no page change, no modal):**
    · "What type of property did you own?*" → radios: Primary residence / Second home / Investment /
      FHA secondary residence
    · "How did you hold title to the property?*" → radios: By yourself / Jointly with spouse /
      Jointly with another person
→ **Branch-in-place.** The form grows underneath the answer that caused it. No wizard step, no reload.
  Combined with the sticky Submit bar, the user never loses their place.

**⚠️ BUG SPOTTED (do not copy):** every radio *option* renders its own red asterisk —
"Primary residence *", "Second home *", "Investment *", "By yourself *", "Jointly with spouse *".
The required marker belongs on the **question**, not on each option. Looks like a required-field
decorator applied at the wrong node in the tree. Homiquity should mark required once, at group level.

**Control-type logic (consistent and worth codifying):**
- **2 mutually-exclusive options** → segmented Yes/No pills (selected = white pill + green ✓ inside)
- **3–5 mutually-exclusive options** → radio list, vertical
- **6+ options / known taxonomy (state, citizenship, marital)** → native select
- **Independent true/false, default false** → checkbox
- **Repeating structured entity (an address)** → bordered sub-card w/ its own Cancel/Save

**End of form:** the sticky bar un-sticks and settles inline above the footer once you hit the bottom.
Footer then appears with "Better" wordmark + "Better Mortgage Corporation is a direct lender dedicated
to providing a fast, transparent digital mortgage experience backed by superior customer support." +
Contact Us. So even inside the app, the legal/contact footer is reachable — but only at the true end.

### STEP 2c — Saved sub-card collapses to a read-only summary
After Save, the address sub-card **collapses from inputs into a labelled read-only summary**:
   "When did you move into this address?" / 5/17/2022
   "Is this your current residence?" / Yes
   "How would you describe your living situation?" / Own
   ─────────────────────────────────
   [ Edit ]  [ **Delete** ]      ← Delete is outlined in RED (destructive styling), Edit is neutral
Then, outside the sub-card, a right-aligned **[ Add Address ]** outline button.

→ Three-state component: **empty → editing → saved summary**. The saved state keeps the *questions*
  visible next to the answers, so review doesn't require remembering what the field meant. Cheap and
  it kills "wait, what did I put?" anxiety at submit time.
→ Destructive action = red outline, never red fill. Present but not inviting.
→ "Add Address" sits outside the entity card = clearly a collection-level action, not an entity action.

### STEP 3 — Submit → success / empty state
Submit succeeded. Observable changes:
- Sidebar **Tasks badge went 6 → 5**. Immediate, visible reward for finishing one thing.
- Task-card header **lost its "1/1" progress superscript** (task complete, counter retired).
- Content replaced with an **empty state**:
  "**You're all caught up!**"
  "There are no tasks you need to complete right now. We'll notify you when new tasks are ready. If you
   have questions, reach out to your loan team using the contact info below."
- Card: circular pale-green avatar icon + "**Your Loan Consultant will be assigned soon**" /
  "Call us anytime at the number below." + **full-width green phone button: 📞 415-523-8837**
- Footer: Contact Us → "Schedule a conversation" / hello@better.com / 415-523-8837

→ Empty state does 3 jobs at once: (1) confirms completion, (2) sets expectation for what happens next
  and who initiates it ("**We'll** notify you"), (3) offers a human. Not a shrug — a handoff.
→ The phone number is a **big green primary button**, not a text link. At the moment of "now what?",
  the most reassuring affordance is the largest one.

**⚠️ CONTRADICTION SPOTTED (do not copy):** the sidebar badge reads **Tasks 5** while the panel says
"**There are no tasks you need to complete right now.**" Two different sources of truth for the same
question, on screen simultaneously. Almost certainly: badge counts ALL open tasks across the loan,
panel counts only tasks unblocked/actionable *right now*. Both defensible alone; together they read
as a bug and undermine trust in the number.
→ Homiquity fix: one counter, and it must count **actionable-now**. If you need the other number,
  label it ("5 upcoming"). A badge the user can't zero out is a badge they learn to ignore.

### STEP 4 — "Ask Betsy" in-app assistant (docked panel)
Launcher: dark-green pill, bottom-right, logo mark + "Ask Betsy". Persists on every app screen.

Opened panel (~385px wide, docked bottom-right, does NOT cover the sticky action bar area it replaces):
- **Header:** dark green bar, circular green logo mark + "Ask Betsy" + a "−" **minimize** control
  (minimize, not close — the conversation is preserved, not discarded)
- **Disclosure block, above the first message, small grey text:**
  "Chat sessions are recorded by Better and our service providers. By using chat, you agree to our
   privacy policy."
- **Escape hatch, immediately under it:** "Need help by phone? We're here 24/7. Call us at 415-523-8837."
  → The human fallback is offered BEFORE the AI's first word, not after it fails. Confident, not defensive.
- **Message:** "Betsy · 10:15 AM"
  "Hi 👋 I'm Betsy, Better.com's AI loan advisor. **This is your overview page—here you can track your
   progress and see your next steps.** Want help understanding any item or what to do next?"
  → **PAGE-AWARE OPENING.** She names the screen you're on and what it's for, then offers help scoped to
    it. This is the single highest-leverage detail in the whole assistant: it converts a blank "how can
    I help?" (which makes the user do the work of framing a question) into a concrete, answerable offer.
    Costs almost nothing — a route→description map passed as context.
- **Per-message feedback:** 👍 / 👎 under the response
- **Composer:** rounded input, green focus ring, placeholder "Type your message…"
- Identity: named persona, female, "AI loan advisor" — explicitly labelled AI, never implied human.

**Design tension worth naming:** Better positions Betsy as the product ("Betsy AI gets you cash…") on
the marketing site, but inside the app she is a **docked helper panel**, not the driver. The funnel is
still forms; Betsy explains them. The hero promise and the logged-in reality are different products.
→ For Homiquity this is the strategic question: is the AI Coach the *interface* or the *guide*?
  Better markets the former and ships the latter. Being honest about shipping the latter — a guide
  that explains every screen and every question — is both cheaper AND more consistent with Homiquity's
  "no black-box AI approvals / deterministic rules" trust position.

### STEP 4b — Betsy answers a loan-specific question  ★ HEADLINE FINDING ★
User asked (verbatim, lowercase, no punctuation — a realistic query, not a clean one):
   "what my rate and what do i need to upload"
→ Two questions in one, ungrammatical. She handled both. Good sign for intent parsing.

**Betsy's reply (structure):**
  "Here's what you need to upload and complete right now:
   • Confirm if you financially support any dependents and provide their names/ages
   • Provide details about all your assets (such as checking, savings, retirement, stocks, other accounts)
   • Add details about your real estate agent and your upcoming offer
   • Share your military service information (if applicable)
   • Enter your interest rate, original loan amount, and loan term for your existing VA loan
   Find and upload everything on the [Tasks](link) page.

   About your interest rate: currently it looks like we're still waiting for you to provide your rate
   for your existing VA loan. Once you complete that, your file can move forward.

   Want a summary of each outstanding step or help with a specific item?"

**What this proves — she is READ-CONNECTED to the live loan file:**
- Enumerated **exactly 5** outstanding items — matching the sidebar badge (Tasks 5).
- Knew loan-specific facts: there's an **existing VA loan**, and the missing datum is its rate/term.
- Reframed an unanswerable question honestly: "what's my rate?" → *we're waiting on YOU for that*,
  and named the unblocking action. She didn't hallucinate a rate, and she didn't just say "I don't know."
- **Deep-linked** to the Tasks page inside the answer.
- Closed with a **menu of next moves** ("summary of each step, or help with a specific item?") rather
  than a dead stop. Every turn ends by offering the next turn.
- Response is READ-ONLY. She tells you where to go; she does not fill anything in or take the action.
  → Read + route, not write. That's the shipped scope, and it's the right first scope.

**★ THE BIG ONE — the AI contradicts the UI, and the AI is correct.**
On the same screen, at the same moment:
   Page panel: "**You're all caught up!** There are no tasks you need to complete right now."
   Sidebar:    "**Tasks 5**"
   Betsy:      "Here's what you need to upload and complete right now:" → **lists 5 real items**
The assistant had a truer model of the user's state than the primary interface did. The user asked an
AI a question that the screen they were looking at should have answered — and got a *better* answer.

→ Diagnosis: the empty-state panel is scoped to ONE task flow ("Verified approval", now complete) but
  its copy makes a **global claim** ("there are no tasks you need to complete"). Classic scope/copy
  mismatch — the component doesn't know how small its own world is.
→ **The lesson for Homiquity, and it's the most important one from this whole session:**
  If your AI Coach reads the same state your UI renders, the Coach will expose every place your UI
  lies. That's a feature — treat the Coach as a **consistency oracle**. Concretely:
    1. ONE source of truth for "what's outstanding" — the Coach, the badge, and the page all read it.
    2. Empty-state copy must be scoped to what the component actually knows. If it only knows about
       one flow, it says "You've finished the pre-approval questions" — never "you're all caught up."
    3. Build a test that asks the Coach "what do I need to do?" on every screen and diffs the answer
       against the UI. Any divergence is a bug in the UI, not the Coach.

**Betsy interaction patterns worth copying verbatim:**
- Answer the *asked* question, then the *unasked but implied* one (rate → why no rate → how to unblock)
- Deep-link to the destination inside the answer text
- Never end a turn without offering the next one
- Honest "we're waiting on you" beats both a hallucinated number and a bare "I don't know"
- Tolerate messy input; do not require the user to phrase one question at a time

## TECHNICAL AUDIT — homiquity.com (from live DOM)

**Stack:** Tailwind + shadcn/ui design-token system. 80 CSS custom properties on `:root`, HSL-triplet
format, plus a full `.dark` theme block. Vite-built (hashed asset filenames). This is GOOD news —
every recommendation below can be expressed as a token or component change, not a redesign.

**Existing token system (already in place — use it, don't reinvent):**
- `--font-sans`: "Geist", "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif
- `--font-serif`: "Source Serif 4", Georgia, serif
- `--font-mono`: "Geist Mono", "JetBrains Mono", monospace
- `--radius`: .75rem (12px)   ·   `--spacing`: .25rem
- `--primary`: 163 94% 24%  (deep green)      `--primary-foreground`: 0 0% 100%
- `--ring`: 161 94% 30%     `--sidebar-ring`: 160 84% 39%
- `--background`: 0 0% 100%   `--foreground`: 222 47% 11%   `--border`: 214 32% 91%
- `--muted`: 210 40% 98%   `--muted-foreground`: 215 24% 37%   `--surface`: 210 40% 97%
- `--sidebar`: 224 71% 24% (navy)  `--sidebar-accent`: 224 52% 32%   `--accent`: 224 60% 24%
- Semantic set (already there, currently under-used):
  `--success` 160 84% 39% · `--warning` 38 92% 51% · `--info` 216 51% 40% · `--destructive` 0 72% 51%
  each with a `-subtle` pair: `--success-subtle` 160 60% 94% / `-foreground` 160 84% 24%, etc.
- Brand-specific: `--veteran-gold` 42 64% 42% · `--veteran-navy` 234 31% 33% · `--veteran-red` 351 66% 42%
  · `--veteran-seal-bg` 45 44% 96%
- Chart ramp: `--chart-1` 216 51% 24% · `-2` 184 65% 34% · `-3` 38 85% 45% · `-4` 255 55% 58% · `-5` 340 68% 50%
- 8-step shadow scale `--shadow-2xs` → `--shadow-2xl`, all tinted #131820 (cool near-black). Nice.

→ The `-subtle` semantic pairs are exactly what Better's status badges need
  ("Done: Nov 25" = success-subtle; "Required" = primary solid). Already built. Just unused.

### ⚠️ BUGS FOUND (live, on the homepage)

**B1 — Two of four images are 404ing (naturalWidth = 0).** This is the blank hero card.
  · `learning-planning-CWoHtMSc.jpg` — alt: "A person reviewing home-buying information on a laptop
     at home" — laid out at 542×406, renders empty
  · `founder-note-C-1Css8X.jpg` — alt: "A parent holding their two children in front of their home" —
     256×160, renders empty
  Hashed filenames = Vite build output. The markup references build-hash A while the deployed assets
  are build-hash B, or those two files were never uploaded. **The alt text proves the design intent
  exists — the images were chosen, they're just not being served.** Highest-priority fix on the site:
  it's the first thing above the fold and it's a blank rectangle.

**B2 — Invalid nested interactive elements: `<a>` wrapping `<button>`.**
  Confirmed on the header phone link ("(224) 400-0531") and on "Glossary". An anchor containing a
  button is invalid HTML, produces two focusable stops for one control, and screen readers announce
  it as both a link and a button. Almost certainly a shadcn `<Button asChild>` used *around* a link
  instead of *as* one. Fix: `<Button asChild><a href="tel:…">…</a></Button>` — one element, not two.

**B3 — Flash of empty CTA on first paint.** The top-right header control renders as a bare grey
  rounded rectangle (270×36, no label) before auth state resolves, then becomes
  "Barakat RE Holdings LLC". First impression above the fold is a broken-looking button.
  Fix: skeleton with the right shape *and* a label, or reserve the slot and render the logged-out
  label ("Sign in") as the default until auth resolves.

**B4 — No social proof above the fold.** Better puts "$110B+ funded loans · 600k customers served"
  inside the hero in low-contrast type. Homiquity's equivalent asset — "15+ years banking,
  veteran-founded" — is real and differentiated but sits far below the fold in a trust block.

**B5 — Positioning tension to resolve, not a bug.** Trust block says "**No black-box AI approvals.
  Clear, deterministic rules.**" while the final CTA offers "Talk to our AI Coach." Read together in
  sequence this reads as a contradiction. It isn't — it's the strongest differentiator on the site,
  but only if stated as one sentence instead of two contradicting ones. See recommendation R7.

## VERIFICATION PASS (re-measured on live better.com)
- H1: **72px / 72px line-height (1.0), weight 500**, font `betterSans` + `betterSans Fallback`, ls normal
- Weights present on MARKETING site: **300, 400, 500, 700** (four)
  → CORRECTION to earlier note: the "only 400/700" observation was taken on **/login**, and holds for
    the logged-in app, not the marketing site. Split is: marketing = 4 weights, app = 2 weights.
- Radius is **contextual**: nav/CTA pills `9999px`; form controls & cards `8px`. Two radii, two jobs.
- Confirmed unchanged: muted text `rgb(86,93,90)`; disabled button `bg rgb(199,201,197)` /
  `text rgb(111,118,114)`; body 16px/24px.
Report corrected accordingly (§02 hero metrics, §09 typography).

### STEP 5 — Application Summary (/my-loan/{id}/application-summary)  ★ BEST SCREEN ON THE SITE ★
[All figures, names, addresses and creditor balances redacted — structure and copy only.]

Sidebar note: "My files" is now expanded, revealing two children — **Application summary** (active) and
**Documents**. Active sub-item styling = pale pill + green text + green icon + a vertical rail on the
left of the child group. Parent chevron flips. Only one nav item ever expands.

**Page header**
  H1 "Application summary" / sub "See your application details here"
  Body: "This is what you told us about your finances and property on your application — **we're here to
  help if you need to make any changes.**"
→ The page's job is stated in one line, and the anxiety it creates ("is this locked in?") is answered
  in the same sentence.

**Help card, pinned near the top, not the bottom:**
  "Questions about your application? We're happy to help guide you through it or make edits to
   financial info. Call us at 415-523-8837"
→ On the densest, most intimidating screen in the product, help is offered *before* the density starts.

**Structure — three groups, each a card:**
  1. **Contact info** — Applicant → name / phone / mailing address
     · Inline upsell: "Want to add a co-borrower? This normally helps strengthen your application.
       We'll just need their financial info and credit score." → [Get started]
     → Upsell is placed where it's relevant, framed as benefit-to-you, and states the cost honestly.
  2. **Financial info** — Income · Assets · Debts
  3. **Loan summary** — Real estate agent · Loan · Property info

**★ PROVENANCE BADGES — the standout pattern on this page ★**
Each financial section carries a small label declaring **how the number was obtained**:
     Income  → "Initial"
     Assets  → "Initial"
     Debts   → "**Soft check**"
→ The user can see, per-section, whether a figure is self-reported or pulled/verified, and (via "soft")
  that their credit was not hard-pulled. This is *provenance as a first-class UI element.*
→ Enormous trust value for near-zero effort, and it pre-answers the two questions every borrower has:
  "where did you get that?" and "did you just ding my credit?"

**"Why we ask" explainer under every section heading:**
  Income: "Your income determines your debt-to-income ratio (DTI), and we use documents like your
          paystubs and W-2 to verify it."
  Assets: "We gather bank statements, withdrawal guidelines, and gift letters to make sure you can
          cover closing costs and any cash that's due."
  Debts:  "We look at the minimum payments you're required to make toward existing debts each month
          and use your credit check to verify everything."
→ Every intrusive data request is paired with (a) what it's used for and (b) what will be asked of you
  next to verify it. Nothing arrives as a surprise later.

**Underwriting rules stated inline, next to the number they govern:**
  "This must be consistent for a 2-year period."  ← appears under Salary, and again under
                                                     Bonus/commission/overtime
→ The rule that will disqualify you is printed beside the field it applies to, before it bites.

**Income table: dual-unit display**
  Columns: Income type | **Annual** | **Monthly**  — every row shows both.
  Rows nest: Salary → base pay, RSU grant value, **Total salary** (bold subtotal); then
  Bonus/commission/overtime; then Other (rental income).
→ Borrowers think annually; underwriters think monthly. Showing both removes an entire class of
  "that number looks wrong" support contacts.

**Debts table** — pulled from the credit report: creditor name + a **type tag** (CC / FX / Mortgage /
  HELOC) stacked under it, then Minimum payment, then Balance. A separate small table below for
  "Other payments" (monthly, balance "—") with the note "This includes your other regular payments,
  like rent."
→ Two tables, not one, because credit-reported debts and self-reported obligations have different
  provenance. Consistent with the badges above. Balance "—" rather than "$0" — an em-dash for
  not-applicable vs a zero for actually-zero.

**Inline "Real estate agent" collector (currently "Not added"), collapsible:**
  Copy: "Add your agent to keep them updated on important things like your appraisal status and
  closing. **We won't ever share anything private like your credit report or bank statements.**"
  Fields: First name / Last name / Phone / Email — **labels in a LEFT column, inputs right** (a
  two-column label/field layout, unlike the stacked layout used in the task flow)
  Consent line: "I agree to let Better Mortgage share application updates with my agent."
  Actions: [Cancel] [Add]
→ Privacy limit stated at the exact moment of the ask, unprompted, and it names the specific things
  that will NOT be shared rather than a vague "we protect your data."
→ Note the layout inconsistency: this page uses left-label/right-field; the task flow uses stacked
  labels. Two form layouts in one product.

**Loan card:** Loan amount / Down payment / Home value, prefaced with
  "If you make changes based on what you need, your total loan amount may shift as you go through
   the process."
→ Sets expectation that the headline number is provisional. Prevents the "but you said $X" call.

**Property info:** "We'll use an appraisal conducted by an independent third party to determine your
  home's value. This lets us know if the loan covers the entire value of the home or just part of it."
  Then: Location / Usage / Type.
→ Explains LTV without ever saying "LTV".

**⚠️ Name casing bug persists here too:** applicant rendered "anmre barakat" — lowercase, third
distinct rendering of the same name across three screens. Confirms it's a data-layer normalization
gap, not a one-off view bug.

**Why this screen matters most for Homiquity:** it is the "single source of truth" page — the place a
borrower goes to check what the lender thinks is true about them. Homiquity's entire pitch is
*clarity*. This page is what clarity looks like when it's built, and Better executes it better than
they execute their AI. Provenance badges + "why we ask" + inline underwriting rules is a combination
Homiquity should ship as a flagship screen, not an afterthought.

### STEP 6 — "Lock your rate" task (/tasks/continue-lock)  — a SECOND, DIFFERENT form pattern
This screen contradicts §STEP 2 in an interesting way: Better ships **two form paradigms**.

**NEW: a macro journey bar above everything**, distinct from the task progress:
   [✓ green filled check]  ─────────────────────○
        Pre-approved                              Next step: Offer accepted  ⓘ
  · Left node: completed milestone, solid green circle + white check, label beneath.
  · Track: green filled portion → grey remainder → hollow grey end node.
  · Right: "Next step: <name>" as text + an ⓘ tooltip. The FUTURE milestone is named but not
    rendered as a full node — it's a caption, not a step.
  · Accessible name of the whole thing: "Lock rate progress".
→ So there are now THREE nested progress indicators in this product:
    1. Loan-level 5-step tracker (Overview page, right rail)
    2. Milestone bar (this: Pre-approved → Offer accepted)
    3. Task-level counter ("Lock your rate 1/5")
  Each is at a different altitude and each is legible on its own. That layering is good design —
  but see the risk note below.

**Task header upgraded:** 🔓 icon + "**Lock your rate**" + superscript "**1/5**" + ▾ chevron,
  and NEW on the right: **‹ ›  circular prev/next buttons**.
  (The earlier "Verified approval 1/1" task had the chevron but no arrows — arrows appear only when
   the task has multiple sub-steps.)
→ Sub-step navigation is explicit and reversible. The user can go back without losing work and
  without using the browser Back button.

**★ ONE QUESTION PER SCREEN ★**
   H2: "Confirm household dependents"
   Q:  "Do you financially support any children or relatives?*"  → [Yes] [No]
   …and nothing else on the page. Vast white space below.

→ This is a **completely different pattern** from the Verified-Approval task in STEP 2, which was a
  long scrolling form with many questions, sub-cards and inline branching.
→ Better appears to segment by *stakes and length*:
   · Long, mostly-known data the user is REVIEWING  → single long form, pre-filled, branch-in-place
   · Short, consequential, sequential decisions      → one question per screen, with ‹ › navigation
  Rate lock is time-sensitive and legally consequential; slowing the user to one decision per screen
  is a deliberate choice, not laziness.

**Sticky bar unchanged:** Support ? left, Submit right — consistent across BOTH form paradigms.
That consistency is what makes shipping two paradigms survivable.

**⚠️ Weakness to avoid:** on a 1324×887 viewport the single question occupies the top ~25% and the
remaining ~500px is empty. Nothing fills the space — no context, no "why we ask", no preview of the
remaining 4 steps. Compare with the Application Summary, where every section explains itself.
→ For Homiquity: if you adopt one-question-per-screen, **use the recovered space**. Put the "why we
  ask" there, or a live preview of the number being affected, or the remaining sub-steps. An empty
  75% of viewport reads as an unfinished screen, and on a rate-lock flow it's prime real estate for
  the reassurance that reduces abandonment.

**⚠️ Risk of the three-tier progress stack:** three simultaneous progress indicators can conflict the
same way the badge/panel pair did in STEP 3. Rule for Homiquity: each tier must derive from the same
state, and each must state its altitude in its own label ("Loan progress" / "Lock rate progress" /
"Step 1 of 5"). Never show two indicators that could disagree without saying what they measure.

### STEP 6b — ★★ THE PROGRESS COUNTER RUNS BACKWARDS ★★
Observed across three consecutive sub-steps of the "Lock your rate" task:

    screen 1:   Lock your rate ¹/₅      sidebar badge: Tasks 5
    screen 2:   Lock your rate ¹/₄      sidebar badge: Tasks 4
    screen 3:   Lock your rate ¹/₃      sidebar badge: Tasks 3

**The numerator never moves. The denominator counts DOWN.**

Diagnosis: the denominator is bound to the same value as the sidebar badge — the number of
*remaining open tasks* — while the numerator is a static index ("you're on the first one").
So the fraction conflates two different quantities: an **index** over a **remaining count**.

Why it's bad:
- A user watching this sees 1/5 → 1/4 → 1/3. The part that represents *them* never advances.
  All the motion is in the denominator, which most people read as "the size of the job."
  Psychologically it reads closer to "the goal is shrinking" than "I am progressing."
- It is unfalsifiable as a progress signal: at the last step it would read 1/1, which is
  indistinguishable from a single-step task that hasn't been started.
- It silently disagrees with the ⁿ/ₙ convention every other product uses (index/total), so the
  user's learned reading of the glyph is wrong here.

Correct options (pick one, never mix):
  · **Index over total**  → 1/5, 2/5, 3/5 … total FIXED at the count when the task began
  · **Remaining count**   → "4 left" / "3 left" — a word, not a fraction
  · **Both, labelled**    → "Step 2 of 5 · 3 tasks left"
Never render a fraction whose denominator moves. It is the single most confusing thing in the
product and it's a one-line fix.

→ This is the SECOND state-consistency defect found in one session (the first: sidebar badge 5 vs
  "You're all caught up"). Both trace to the same root cause: **loan progress is being derived
  ad-hoc at each render site instead of from one selector.** It's now a pattern, not a one-off,
  and it's the strongest possible argument for R2.

### STEP 6c — Corrections & additions to STEP 6
**Correction to "one question per screen":** it's **one TOPIC per screen**, not one question.
The Assets sub-step showed five inputs at once:
   "Checking and savings accounts"  [$250,000]   ← currency formatted live, in-field
   "Retirement accounts"            [ ]
   "Stocks and bonds (brokerage account)"  [ ]
   "Gifts from others"              [ ]
   "Other (trust, business accounts, etc.)"  [ ]
        └ helper line under the label: "Example: Trusts, business accounts, other loans,
          sale of other properties"
→ Rule inferred: **one underwriting concept per screen**, however many fields that takes.
  "Dependents" is one question; "Assets" is five. The screen boundary follows the *concept*, not
  the field count. That's a better rule than "one question per screen" and it's the one to copy.

**Excellent persuasive copy for OPTIONAL data:**
   "Sharing your assets helps us gauge your down payment and closing costs potential.
    **It boosts your borrower profile, even if you don't plan to use them.**"
→ Handles the exact objection a user has about volunteering more financial detail than required
  ("why should I tell you about money I'm not using?") and answers it with a benefit. Note the
  structure: what it's used for → and the reason to give MORE than the minimum.

**Label + example-line pattern:** label, then a smaller grey "Example: …" line, then the input.
Used where the category is ambiguous. Same family as the "This could be…" pattern from STEP 2.

**⚠️ Stray-asterisk bug confirmed SYSTEMIC:** the radios here also carry per-option asterisks —
"I already made one *", "I plan on making one soon *". Same defect as STEP 2b, different task,
different component instance. It's in the shared field primitive, not in one screen.

**Task header arrows:** ‹ › are present but the ‹ (back) renders in a lighter/disabled style on
the first sub-step. Forward/back nav is state-aware.

**Whitespace note stands:** the offer-stage screen has two radio options and ~500px of empty
viewport beneath. Prime real estate for the "why we ask" copy that this product does so well
elsewhere.

### STEP 6d — The task-header dropdown is a TASK NAVIGATOR (▾ expanded)
Clicking the ▾ beside "Lock your rate ¹/₂" opens a small panel, left-aligned under the header:

    Shortcuts
      🔓 Lock your rate      ²      ← superscript = count of items in this group
      📄 Verified approval   ¹
    ─────────────────────────
    Status
      ✓ Under review               ← greyed / pale check = empty bucket, non-interactive
      ✓ Completed            ⁴     ← dark check + count

→ Two axes in one menu: **jump by task group** (Shortcuts) and **filter by state** (Status).
→ Empty buckets stay VISIBLE but greyed ("Under review" with no count). The user learns the state
  machine exists even when nothing is in that state — so when something lands there later, it isn't
  a surprise. Cheap, and better than hiding empty states.
→ Counts as superscripts, matching the header's own superscript treatment. Consistent typography
  for "a count attached to a label" across the whole app.

**★ This ALSO explains the backwards counter (refines STEP 6b) ★**
The header fraction is *position within the REMAINING set*, and completed sub-steps leave the set.
Since you are always standing on the first remaining item, the numerator is **structurally pinned
to 1**. It cannot ever display 2. It's not a rendering bug — the model is wrong: progress is being
computed over a shrinking collection instead of over a fixed one captured at task start.
→ Fix for Homiquity: snapshot `total` when the task begins and never recompute it. Index = number
  completed + 1. Then 1/5 → 2/5 → 3/5 falls out for free.

### STEP 6e — Military service screen  ★ MOST RELEVANT SCREEN TO HOMIQUITY ★
   H2: "Military service information for anmre barakat"
   Intro: "This helps us figure out what loans you might be eligible for and determine how your
           property should be classified. **If you (or a deceased spouse) aren't part of the
           military, just click "No" so we can keep that info for our records.**"
   Q: "Did you (or your deceased spouse) ever serve, or are you currently serving, in the United
       States Armed Forces?*"  → [✓ Yes] [No]
   → answering Yes branches in place to:
   "Select which option applies:*"  → CHECKBOXES (multi-select):
        ☐ Currently serving on active duty
        ☐ Currently retired, discharged, or separated from service
        ☑ Served only as a non-activated member of the Reserve or National Guard
        ☐ A surviving spouse

→ **The stand-out copy pattern: tell the user what to do when the question does NOT apply.**
  "…just click 'No' so we can keep that info for our records." Most products leave the non-applicable
  user hesitating over whether skipping will hurt them. One clause removes that entirely, and it
  explains WHY the negative answer is still wanted (records), so "No" doesn't feel like a loss.
→ Handles the deceased-spouse case with care and without euphemism, in the question itself.
→ Categories are written as the user would describe themselves, not as VA eligibility codes.

**Direct relevance:** Homiquity is veteran-founded, ships `--veteran-gold/-navy/-red/-seal-bg` tokens,
and has a "Veterans & Military" persona card on the homepage. This screen is the reference
implementation for that path — and Homiquity can plausibly do it *better*, because for Better it's
one screen among many and for Homiquity it's a founding story.

**⚠️ Minor copy/control mismatch:** the label reads "Select which option**s** applies:" — actually
"Select which option applies:" (singular) — while the control is a multi-select checkbox group.
Should be "Select all that apply."

**Branch-in-place confirmed in BOTH paradigms:** the offer screen also expanded a second question
("Was your offer accepted?" → Yes / No / **I'm waiting to hear back**) after the first was answered.
So inline branching is universal in this product, not specific to the long-form pattern.
→ Note that third option: "I'm waiting to hear back." A real state, not forced into a false binary.
  Most forms would have shipped Yes/No and stranded everyone in the middle.

**⚠️ Name casing, 4th occurrence:** "Military service information for **anmre barakat**" — lowercase
again. Four screens, at least three different normalizations. Confirms data-layer, not view.

### STEP 7 — "Uncommon borrower situations" (URLA Declarations)  ★★ BEST INTERACTION PATTERN FOUND ★★
   H2: "Uncommon borrower situations relating to Anmre Barakat"
   Intro: "The following few questions are uncommon scenarios we need to ask for your application.
           **If none apply to you, you can quickly answer "No" to all by checking the box below.**
           Additional questions may be asked based on your answers."
   ☐ **None of the below questions apply to me.**
   …then SEVENTEEN mandatory Yes/No questions.

**★ THE BULK-ANSWER ESCAPE HATCH ★**
This is the single best interaction pattern in the entire teardown.

These are the URLA / Form 1003 Declarations — legally mandated, verbatim, non-negotiable, and
uniformly hostile to read: co-signer/guarantor obligations, outstanding judgments, federal debt
delinquency, party to a lawsuit, deed-in-lieu within 7 years, pre-foreclosure/short sale,
foreclosure, bankruptcy, alimony/child support, undisclosed borrowed funds, other mortgage
applications before closing, new credit before closing, PACE/clean-energy priority liens, military
service, family/business relationship with the seller, homestead & community-property interests.

For ~90% of borrowers every answer is "No". Better collapses all seventeen into **one checkbox**.

Why it's so good:
- It respects that the questions are compulsory (they're all still rendered, all still answerable
  individually) while refusing to make the common case pay for the rare one.
- The intro **states the shortcut before the wall of text**, so the user reads one sentence instead
  of scanning seventeen questions to discover the escape hatch at the bottom.
- "Additional questions may be asked based on your answers" sets the expectation that a Yes costs
  more — honest, and it makes the checkbox feel like a reward for a clean file rather than a trick.
- The regulator gets a complete, individually-answered record; the borrower gets one click.

→ **For Homiquity this is the highest-leverage single pattern to copy.** Every lender must ask these
  exact questions. Almost nobody makes them cheap. If your pitch is clarity and low friction, this
  is where a borrower actually *feels* it — the moment a 17-question legal wall becomes one
  checkbox is the moment they believe you're on their side.

**Milestone bar now shows a PERCENTAGE and a changed next step:**
   [✓ Pre-approved]  50%  ─────────────○   Next step: **Lock your rate** ⓘ
  Earlier on this same flow it read "Next step: Offer accepted" with **no** percentage.
→ So the bar is dynamic on both axes: the numeric completion appears once it's meaningful, and the
  "next step" caption re-targets as milestones are passed. Good — but note this makes it a FOURTH
  progress signal that must agree with the other three.

**⚠️ Name casing — 5th occurrence, and a THIRD distinct rendering:**
   "Hi anmre"  ·  "Confirm Anmre's information"  ·  "anmre barakat"  ·  "for anmre barakat"
   · and now "**Anmre Barakat**" (both words capitalised) on this screen.
  Same user, one session, at least three normalizations. Definitively a data-layer gap.

**⚠️ Same control, two different labels, same product:**
   earlier wizard step: "Select which option applies:"   ← singular, WRONG for a checkbox group
   this screen:         "**Please check all that apply:**" ← correct
  They have the right copy and the wrong copy for the identical control. Ship the primitive with the
  label baked in and this can't happen.

**Structural note:** this screen renders the declarations as one long scroll of segmented Yes/No
pills, i.e. the §STEP 2 long-form paradigm — inside a task that otherwise uses the stepped-wizard
paradigm. So the two paradigms are mixed *within a single task*, chosen per sub-step by content
shape. That's more sophisticated than "two patterns"; it's "the content picks the pattern."

### STEP 8 — "Add details about the new property" (post-offer-acceptance)
Milestone bar: **57%** (was 50% one screen earlier — it increments per sub-step). Counter 1/2.

**Emotional acknowledgment BEFORE the ask:**
   "It looks like you just had an offer accepted. **Congratulations!**"
→ One line. Costs nothing. This is the biggest moment in the customer's month and most lenders
  respond to it with a form. Acknowledge the milestone, then ask.

**Pre-states the ask as a checklist before any field appears:**
   "To keep moving forward, we need a few details about your offer. In particular, we need to know
    your:  · Closing information  · Final address  · Accepted purchase price"
→ The user knows the shape and size of the job before starting. Reduces the "how long is this?"
  abandonment. Pair with a correct step counter and the user is never guessing.

**★ Optional upload framed to remove every reason to stall ★**
   "If you have a purchase contract, you can also upload that too. **We don't need this right now
    but if you have it, that's great. If it's not signed, you can just upload a draft now and give
    us the signed version later.**"
→ Three separate objections pre-answered in two sentences: (1) is this mandatory? no. (2) do I need
  to go find it? not now. (3) mine isn't signed yet — fine, send the draft.
→ Compare with the industry norm ("Upload purchase contract *"), which stalls the user for days.

**Upload tips that preempt the actual rejection reasons:**
   "· Either a .pdf or .jpg is fine
    · Make sure to include all pages, including any addendums or blank pages"
→ "Including any addendums or blank pages" is the single most common document-rejection cause in
  mortgage ops. Putting it at the point of upload saves a rejection round-trip measured in days.
   Dropzone copy: "Choose a file already saved on this device, or drag and drop"

**Partial prefill:** City "Orland Park", State Illinois, ZIP 60467 pre-filled from the loan; street
Address left empty with a placeholder. They prefill what they know and leave the rest — no fake
values, no forcing the user to clear a wrong guess.

**★★ NEGATIVE-CONSENT CHECKBOX — the one clear dark pattern found all session ★★**
   Line 1: "By clicking "Submit" I authorize Better Mortgage Corporation to share updates with my
            real estate agent."
   Line 2: ☐ "Please check this box if you do **not** wish to have Better Mortgage Corporation
            share updates with your real estate agent. **Please be aware that this might delay the
            loan process.**"

Three compounding problems:
  1. **Opt-OUT, not opt-in.** Consent is presumed by the act of submitting the form.
  2. **Double negative.** "Check this box if you do not wish…" — the user must parse a negation to
     decline. Reliably mis-answered.
  3. **A deterrent attached to the opt-out.** "…this might delay the loan process." Exercising your
     privacy choice is framed as self-harm, in the same sentence as the choice.

→ And note the inconsistency: the Application Summary's agent collector used a *positive* opt-in —
  "I agree to let Better Mortgage share application updates with my agent." The SAME permission is
  collected two different ways in the same product, one clean and one not.
→ **DO NOT COPY.** For Homiquity this is a free differentiator: positive opt-in, no double negative,
  no consequence-threat attached to declining. State the real trade-off neutrally if there is one
  ("your agent won't get status updates from us") and let the user choose.

**⚠️ Stray asterisks, 3rd confirmed instance:** "Single Family *", "Condo *", "2 to 4 units *",
"Manufactured Mobile Home *", "Non-Warrantable Condo *". Same primitive defect.

### STEP 9 — Documents page (/documents)  ★ THEIR WEAKEST SCREEN — AND YOUR OPENING ★
Sidebar: "Documents" now active under My files. Page: "Documents" eyebrow / H1 "Your loan documents".
A single flat table, 7 rows, 4 columns: Document type · File name · Preview (👁) · Download (⬇).

Rows as rendered, verbatim:
   homeowners-counseling-list   | homeowners-counseling-list disclosed at Aug 18, 2026 9:02 AM
   your-home-loan-toolkit       | your-home-loan-toolkit disclosed at Aug 18, 2026 9:02 AM
   preapproval                  | preapproval disclosed at Aug 18, 2026 9:02 AM
   preapproval                  | preapproval disclosed at Aug 18, 2026 9:02 AM   ← DUPLICATE
   privacy-policy               | privacy-policy disclosed at Nov 25, 2025 2:16 PM
   terms-of-use                 | terms-of-use disclosed at Nov 25, 2025 2:16 PM
   electronic-delivery-consent  | electronic-delivery-consent disclosed at Nov 25, 2025 2:16 PM

**This screen is markedly worse than everything else in the product.** Same company, same design
system, and none of the care that went into the Application Summary. Defects:

1. **Raw kebab-case slugs used as user-facing labels.** "homeowners-counseling-list",
   "electronic-delivery-consent". These are internal identifiers leaking straight into the UI.
   A borrower should read "Homeowners Counseling List" and "Electronic Delivery Consent".
2. **The "File name" column contains no file name.** It's `{slug} disclosed at {timestamp}` — the
   Document type column concatenated with the date. Two columns carrying one fact. No extension,
   no size, no type icon; the user can't tell a PDF from anything else before clicking.
3. **Two identical "preapproval" rows**, same timestamp to the minute, no disambiguation. The user
   cannot tell what differs or which one to send their agent. (Likely borrower vs property version.)
4. **"disclosed at" is regulatory jargon.** It's a term of art from compliance, not borrower
   language. "Sent to you on Aug 18" says the same thing truthfully.
5. **No grouping, search, sort or filter.** Fine at 7 rows. A real mortgage generates 40–80
   documents by closing; this table becomes unusable and there's no structure to grow into.
6. **No provenance and no direction.** Nothing distinguishes *documents Better sent you* from
   *documents you uploaded* — and this page seems to show only the former, so it's unclear where
   uploads land. Compare with the Application Summary, where provenance is a first-class element.
   The same company solved this problem one screen away and didn't apply it here.
7. **No status.** Several of these (e-delivery consent, disclosures) require acknowledgement or
   e-signature in the real workflow. Nothing indicates whether anything is outstanding — which is a
   third place where "what do I still owe you?" could disagree with the Tasks badge.
8. **No empty state and no explanation.** No sentence anywhere telling the borrower what this page
   is for, what will appear here over time, or how long documents are retained.

→ **This is the sharpest opportunity in the whole teardown for Homiquity.** One of the three
  promises on your own homepage is literally: "**Organization** — Documents, decisions, and progress
  — all in one place." Better's document vault is a raw database table with the column names left
  on. If you want a screen where you can be visibly, obviously better than a lender with 600k
  customers and it costs a week, this is it.

**What good looks like (spec):**
  · Human titles from a slug→label map; slug kept only as a `data-` attribute for support
  · Group by phase (Application · Disclosures · Closing) or by direction (From us · From you)
  · Provenance + status chips reusing the tokens already built: sent to you / you uploaded /
    needs your signature / verified
  · File type icon, size, page count; real filename on download (`homiquity-preapproval-2026-08-18.pdf`)
  · Sortable date column, and search once the list can exceed ~15 rows
  · Disambiguate same-type documents by their subject ("Pre-approval — 1408 W Belmont Ave")
  · Plain-language date verb: "Sent to you on Aug 18, 2026", not "disclosed at"
  · An empty state explaining what will appear here and when
