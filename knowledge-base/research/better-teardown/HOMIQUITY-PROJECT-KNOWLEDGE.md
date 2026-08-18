> **Landed 2026-08-18** from the Better-teardown package (rev `2c9ff919`), executing Step 2 of the
> founder-approved [knowledge-file audit](../../logs/2026-08-18-knowledge-file-audit.md).
> **Purpose:** standing competitive/design context from the 2026-08-18 live logged-in Better.com
> walkthrough — positioning, tokens, patterns, anti-patterns, component API, the four-question
> standard (§12). **Supersedes:** the pre-§12 standalone revision (`12beb3e4`) and the Better
> facts in [gtm/COMPETITIVE_BRIEF_2026-07-06.md](../gtm/COMPETITIVE_BRIEF_2026-07-06.md).
> **Corrections against code (audit §3 — code wins):** §2's "-subtle/surface tokens unmapped in
> Tailwind" is false at HEAD (`tailwind.config.ts:57-92`; only `veteran-*` is unmapped, and
> deliberately); §3.2's nested-control defect is real but larger and differently shaped — 12 raw
> `<button>`-in-`<Link>` sites plus ~108 `<Button>`-component-in-`<Link>` sites, zero `asChild`;
> §3.1's "404" images exist and are wired at HEAD (`lifestyleImages.ts:14-15` — stale-deploy
> class if still broken in prod); §3.3's CTA flash is a deliberate loading skeleton
> (`Navigation.tsx:223-224`; the labeled-placeholder ask stays open as a refinement. §9's
> `<ProvenanceBadge>` must bind to `shared/dataProvenance.ts`, never a second enum.
> The desktop Claude-Project copy mirrors this file; **on conflict, this repo copy wins.**

# Homiquity — Product & Design Knowledge Base

> Upload this file to your Claude Project. It is written as standing context: any
> Claude session that reads it should be able to build Homiquity screens, write
> Homiquity copy, and review Homiquity code without needing the original research.
>
> Source: a live, logged-in walkthrough of Better Mortgage on 18 August 2026,
> covering the marketing site, sign-in, loan dashboard, borrower-information task
> flow, application summary, the six-step rate-lock task, the URLA declarations,
> the post-offer property screen, the document vault, and the Betsy AI assistant.
> Design tokens and bug findings were extracted from the deployed DOM/CSS of both
> better.com and homiquity.com. All borrower PII was deliberately excluded.

---

## 1. What Homiquity is

A digital mortgage lender. Live at homiquity.com. Founded by a military veteran
with 15+ years in commercial banking and lending.

**Positioning, in the site's own words:** *"Clarity for every stage of
homeownership."* Three pillars stated on the homepage:

- **Clarity** — know exactly where you stand at every step
- **Organization** — documents, decisions, and progress, all in one place
- **Confidence** — make better decisions with real data, not guesswork

**Trust claims already on the site:** 15+ years banking experience ·
Veteran-founded · **Rules-Based Decisions** ("No black-box AI approvals. Clear,
deterministic rules.") · Fair Lending First (Fannie Mae & Freddie Mac
guidelines) · Bank-Grade Security (256-bit encryption, data never sold).

**Reassurance line used in the hero:** No hard credit check · Takes about 3
minutes · 100% free. Plus, on the buying-power quiz: *"nothing leaves your
device until you decide to continue."*

**Personas addressed on the homepage:** First-Time Buyers · Current Homeowners ·
Move-Up Buyers · Complex Income (self-employed, multiple properties) · Veterans
& Military · Real Estate Investors.

### The strategic position to hold

Better markets an AI that *decides* — their homepage hero is literally a chat
box, "Betsy AI gets you cash from your home." But inside the logged-in product,
Betsy is a docked help panel beside conventional forms. The funnel is still
forms; the AI explains them. **Their hero promise and their shipped product are
two different things.**

Homiquity's advantage is that the honest version of this is also the stronger
one, and Better structurally cannot say it:

> **Our decisions come from published lending rules, not a model. Our AI Coach's
> job is to explain them — every question, every number, every result.**

An AI that *explains a deterministic decision* is more trustworthy and more
defensible in a regulated context than an AI that makes one. Resolve the current
tension on the site — "No black-box AI approvals" in one section, "Talk to our AI
Coach" in another — into that single sentence.

**What not to compete on:** Better's moat is volume — $110B+ funded, 600k
customers, five affiliated companies (mortgage, real estate, title, insurance,
inspection), a One Day Mortgage guarantee backed by underwriting capacity.
Breadth and speed claims are a losing game. What they cannot be is small,
specific and legible: a named founder with a real photograph, a veteran-founded
VA specialisation, decisions from published rules, and nothing leaving your
device until you say so.

---

## 2. Tech stack and design tokens

React + Vite + Tailwind + shadcn/ui. **80 CSS custom properties on `:root`** in
HSL-triplet format, plus a complete `.dark` block.

```
--font-sans   "Geist", "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif
--font-serif  "Source Serif 4", Georgia, serif
--font-mono   "Geist Mono", "JetBrains Mono", monospace
--radius      .75rem          --spacing  .25rem

--background          0 0% 100%      --foreground          222 47% 11%
--border            214 32% 91%      --input               213 27% 84%
--ring              161 94% 30%      --card                  0 0% 100%
--primary           163 94% 24%      --primary-foreground    0 0% 100%
--secondary         210 40% 96%      --muted               210 40% 98%
--muted-foreground  215 24% 37%      --surface             210 40% 97%
--sidebar           224 71% 24%      --sidebar-accent      224 52% 32%
--accent            224 60% 24%

--success 160 84% 39%   --success-subtle 160 60% 94%   --success-subtle-foreground 160 84% 24%
--warning  38 92% 51%   --warning-subtle  38 92% 92%   --warning-subtle-foreground  30 90% 26%
--info    216 51% 40%   --info-subtle    216 60% 94%   --info-subtle-foreground    216 51% 30%
--destructive 0 72% 51% --destructive-subtle 0 84% 96% --destructive-subtle-foreground 0 74% 38%

--veteran-gold 42 64% 42%   --veteran-navy 234 31% 33%
--veteran-red 351 66% 42%   --veteran-seal-bg 45 44% 96%

--chart-1 216 51% 24%  --chart-2 184 65% 34%  --chart-3 38 85% 45%
--chart-4 255 55% 58%  --chart-5 340 68% 50%

8-step shadow scale --shadow-2xs → --shadow-2xl, all tinted #131820
```

**Important:** the `-subtle`, `surface` and `veteran-*` tokens exist on `:root`
but are **not mapped into the Tailwind theme**, so `bg-success-subtle` doesn't
exist as a utility. Until they're added to `tailwind.config`, use arbitrary
values: `bg-[hsl(var(--success-subtle))]`. The config snippet is in
`components/README.md`.

**Semantic mapping to use:**

| Meaning | Token pairing |
|---|---|
| Completed / self-reported | `success-subtle` bg + `success-subtle-foreground` text |
| Required / current / verified | solid `primary` + `primary-foreground` |
| Soft-checked / informational | `info-subtle` pair |
| Needs attention / estimated | `warning-subtle` pair |
| Destructive | `destructive` border + text on transparent — **outline, never fill** |

---

## 3. Known defects on homiquity.com

Found live in the deployed DOM. Fix in this order.

1. **Two of four images are 404-ing** (`naturalWidth === 0`):
   `learning-planning-CWoHtMSc.jpg` (alt: "A person reviewing home-buying
   information on a laptop at home", laid out 542×406 — **this is the blank card
   in your hero**) and `founder-note-C-1Css8X.jpg` (alt: "A parent holding their
   two children in front of their home", 256×160). Hashed filenames mean the
   markup references one Vite build while the deployed assets are from another,
   or those two files were never uploaded. The alt text proves the design intent
   exists. **This is above the fold — fix before anything else.**

2. **Invalid nested interactive elements: `<a>` wrapping `<button>`.** Confirmed
   on the header phone number and on "Glossary". Invalid HTML, two focus stops
   for one control, announced as both link and button by screen readers. Almost
   certainly a shadcn `<Button>` rendered *around* a link instead of *as* one.
   Fix: `<Button asChild><a href="tel:…">…</a></Button>`. Grep for the pattern.

3. **Flash of empty CTA above the fold.** The top-right header control paints as
   an unlabeled grey rounded rectangle before auth resolves, then becomes the
   account name. Reserve the slot and render the logged-out label ("Sign in") as
   the default, or use a skeleton with the right shape *and* a placeholder label.

4. **No social proof above the fold.** Better puts "$110B+ funded loans · 600k
   customers served" inside the hero in low-contrast type. Your equivalent —
   15+ years, veteran-founded — is real and differentiated but sits far below.

---

## 4. Patterns to adopt (observed, with the reasoning)

### 4.1 Show the whole road, light one step
The loan tracker is the single most copyable element. Completed steps struck
through with a dated pale-green badge; the current step badged "Required" with
its actions inline; future steps greyed but **visible**, each with a plain-English
description that **names the actor** — "**We** review and verify your financial
information", "**Your loan** is reviewed and prepared for final approval."

Future steps are not actionable, so a naive design hides them. They earn their
space because a mortgage is long and opaque, and they answer the question
borrowers actually have: *is something wrong, or is this just how long it takes?*
Naming the actor lets the user see when the ball is not in their court.

Reuse the exact step labels from the homepage "How it works" section so the
marketing promise and the in-app reality are literally the same words.

### 4.2 Sticky form bar — Support left, Submit right
`position: sticky; bottom: 0`, pinned the entire time, un-sticking at the true
end of the document. Two guarantees: Submit is never something you scroll to
find, and help is one click away at the moment of confusion rather than requiring
the user to abandon the form to go looking. Highest ratio of retained completions
to engineering hours in the whole teardown.

### 4.3 "Confirm", not "Enter"
Pre-fill everything you already know and frame the screen as review — "Confirm
your full legal name" rather than "Enter your name". Identical keystrokes, a
fraction of the perceived effort. Prefill discipline matters: fill what you know,
leave the rest genuinely empty rather than guessing.

### 4.4 Branch in place, never in a wizard step
Answering "Have you owned any other real estate in the past three years?" with
Yes expands the dependent question groups directly beneath the answer that
triggered them. No modal, no route change, no reload. Combined with the sticky
bar, the user never loses their place. Animate the height so the expansion is
legible.

### 4.5 One underwriting concept per screen
Not one *question* per screen. "Dependents" was one yes/no; "Assets" was five
inputs at once. The screen boundary follows the concept; field count is an
outcome, not the criterion.

### 4.6 Two form paradigms, one chrome
- **Long scrolling form** — bulk review of data you already hold (borrower info)
- **Stepped wizard** — short, consequential, sequential decisions (rate lock)

Segment by stakes, not by length. Keep the sticky Support/Submit bar identical
across both; that shared chrome is what stops two paradigms feeling like two
products. Better even mixes them *within one task*, choosing per sub-step by
content shape.

### 4.7 Repeating entities have three states
`empty → editing → saved`. The saved state renders a read-only summary that
**keeps each question beside its answer** ("Is this your current residence? /
Yes"), which removes the "wait, what did I put?" anxiety at submit time without a
separate review screen. `Edit` neutral, `Delete` red **outline** (present, not
inviting), and the collection-level `Add` button rendered *outside* the card.

### 4.8 Provenance as a first-class UI element
Every financial section declares how the number was obtained — "You told us" /
"Soft credit check" / "Verified" / "Estimated". Two questions every borrower has,
pre-answered by one small label: *where did you get that?* and *did you just hit
my credit?* Near-zero cost, disproportionate trust return, and it fits a lender
selling clarity better than it fits anyone else.

### 4.9 "Why we ask" under every intrusive request
Pair each ask with what it's used for **and** what will be requested next to
verify it, so nothing arrives as a surprise weeks later:

> "Your income determines your debt-to-income ratio (DTI), and we use documents
> like your paystubs and W-2 to verify it."

### 4.10 Print the underwriting rule beside the field it governs
> "This must be consistent for a 2-year period."

The rule that can disqualify you, stated next to the number it applies to,
*before* it bites. This is the purest expression of the "deterministic rules,
clearly explained" position — and Better got there first.

### 4.11 Dual-unit financial display
Every amount shown annually **and** monthly. Borrowers think in annual salary;
underwriters think in monthly DTI. Showing both eliminates a whole category of
"that number looks wrong to me" support contacts. Render `—` for
not-applicable, never `$0` — those are different facts.

### 4.12 The bulk-answer escape hatch — **best pattern found**
The URLA Declarations are 15–17 mandatory yes/no questions (judgments,
foreclosures, bankruptcies, undisclosed debts, priority liens). Every lender must
ask them; for ~90% of borrowers every answer is "No". Better collapses the whole
wall into **one checkbox**:

> "The following few questions are uncommon scenarios we need to ask for your
> application. **If none apply to you, you can quickly answer 'No' to all by
> checking the box below.** Additional questions may be asked based on your
> answers."

Why it works: every question still renders and remains individually answerable,
so the regulator gets a complete record; the shortcut is announced **before** the
wall rather than discovered at the bottom of it; and "additional questions may be
asked" honestly signals that a Yes costs more, so the checkbox reads as a reward
for a clean file rather than a trick.

**Critical implementation detail:** the master checkbox must be **derived** from
the answers, never stored. Then changing any single answer releases it
automatically and the two controls can never disagree.

### 4.13 Page-aware AI opener
> "Hi 👋 I'm Betsy, Better.com's AI loan advisor. **This is your overview page —
> here you can track your progress and see your next steps.** Want help
> understanding any item or what to do next?"

She names the screen you're on. A blank "How can I help?" makes the user do the
work of framing a question and most just close the panel. Implementation is a
`route → {name, purpose}` map passed as context — an afternoon of work, and it's
the difference between an assistant people use and a bubble people dismiss.

Other assistant rules worth copying verbatim:
- Offer the human escape hatch **above** the AI's first message, not after it
  fails. Confident, not defensive.
- Minimize, don't close — preserve the conversation.
- Answer the asked question, then the unasked-but-implied one (rate → why no rate
  → how to unblock).
- Honest "we're waiting on you for X" beats both a hallucinated number and a bare
  "I don't know."
- Deep-link to the destination inside the answer text.
- Never end a turn without offering the next one.
- Tolerate messy input; never make the user ask one question at a time.
- 👍/👎 on every response — you will want the labelled data.
- **Read and route, never write.** Tell the user where to go; don't fill fields or
  change loan state. In a regulated context a write-capable assistant is a
  compliance project, not a feature.

---

## 5. Copy patterns

| Pattern | Shape | Example |
|---|---|---|
| **Action → artifact → benefit** | Do X, receive named thing Y, which gets you Z | "Upload financial info → One Day Verified Approval Letter → sellers see you've been vetted, so your offer is less likely to fall through" |
| **Question + "This could be…"** | Plain-English legal question, then a concrete example | "…could make an ownership claim on the property? This could be a relationship like a domestic partnership or civil union." |
| **Name the actor** | Future steps say who does the work | "**We** review and verify your financial information" |
| **Productive waiting** | Explain the wait, then give a job to do during it | "While we match you with a Loan Consultant, get a head start by completing your tasks" |
| **Confirm, don't enter** | Pre-filled fields framed as review | "Confirm your full legal name" |
| **Specific over sufficient** | Ask the exact question, not "provide enough" | "I used a different home address on my 2024 tax return" |
| **Tell them what to do when it doesn't apply** | Remove the hesitation around a negative answer | "If you (or a deceased spouse) aren't part of the military, just click 'No' so we can keep that info for our records." |
| **Acknowledge the milestone first** | React to the human moment before the form | "It looks like you just had an offer accepted. Congratulations!" |
| **Pre-state the ask** | List what's needed before the first field | "We need to know your: closing information, final address, accepted purchase price" |
| **De-risk optional uploads** | Answer *is it mandatory / must I find it now / mine isn't signed* | "We don't need this right now but if you have it, that's great. If it's not signed, upload a draft now and give us the signed version later." |
| **Preempt the rejection** | Put the ops failure mode at the point of upload | "Include all pages, including any addendums or blank pages" |
| **Justify optional data** | Give a reason to volunteer more than the minimum | "Sharing your assets helps us gauge your down payment and closing costs potential. It boosts your borrower profile, even if you don't plan to use them." |
| **Offer the real third option** | Don't force a false binary | "Was your offer accepted?" → Yes / No / **"I'm waiting to hear back"** |

**Voice rules for Homiquity:** plain English over jargon; explain LTV without
saying "LTV"; state limits specifically ("we will never share your credit report
or bank statements") rather than vaguely ("we protect your data"); use the word
the user would use, not the underwriting term.

---

## 6. Anti-patterns — observed on Better, do not copy

### 6.1 Two sources of truth for the same question
The sidebar badge read **Tasks 5** while the panel beside it read **"You're all
caught up! There are no tasks you need to complete right now"** — and the AI
assistant, asked directly, correctly listed five outstanding items. The AI
contradicted the UI and the AI was right.

Cause: the empty-state panel is scoped to one completed task flow but its copy
makes a global claim. The component doesn't know how small its own world is.

### 6.2 A progress counter that runs backwards
Observed across three consecutive sub-steps: `1/5 → 1/4 → 1/3`, with the sidebar
badge tracking 5 → 4 → 3. **The numerator never moves; the denominator counts
down.** The fraction is *position within the remaining set*, and completed steps
leave the set — so the numerator is pinned to 1 by construction and can never
display 2. At the last step it renders `1/1`, indistinguishable from a task not
yet started.

Fix: snapshot `total` when the task begins and never recompute it; index =
completed + 1. Pick one convention and never mix: index over a fixed total, or a
remaining count as a *word* ("3 left"), or both explicitly labelled. **Never
render a fraction whose denominator moves.**

### 6.3 Consent as an opt-out with a double negative and a threat
> ☐ "Please check this box if you do **not** wish to have Better Mortgage
> Corporation share updates with your real estate agent. Please be aware that
> this might delay the loan process."

Consent presumed by submitting; declining requires parsing a negation; and a
deterrent is welded to the choice. And they collect the *same permission* as a
clean positive opt-in elsewhere in the product — both versions shipped at once.

Always: positive opt-in, never pre-ticked, consequence stated neutrally and
outside the label, and only if it's real.

### 6.4 Required-asterisk on every radio *option*
"Primary residence \*", "Second home \*", "By yourself \*". The required marker
belongs to the question, not to each choice — a required-decorator applied at the
wrong node in the component tree. Confirmed in three different tasks, so it lives
in their shared field primitive. Mark required once, at group level.

### 6.5 Raw slugs and dead columns in the document vault
`homeowners-counseling-list`, `electronic-delivery-consent` shown as user-facing
labels; a "File name" column containing the slug concatenated with a timestamp
rather than a filename; two identical "preapproval" rows with no disambiguation;
"disclosed at" (compliance jargon) instead of "sent to you on"; no grouping,
search, status or provenance. See §7.

### 6.6 Name normalisation drift
The same borrower name rendered at least three different ways across five screens
— lowercase on the dashboard, title-cased in a task heading, lowercase on the
application summary, title-cased again on the declarations screen. Normalise once
at the data layer, never at the view. Add a lint rule.

### 6.7 Copy that doesn't match the control's arity
"Select which option applies:" (singular) above a multi-select checkbox group —
while the correct "Please check all that apply:" appears elsewhere in the same
product. Ship the primitive with the label baked in.

### 6.8 Empty three-quarters of a wizard screen
Single-question steps leave ~500px of unused viewport. Use it: "why we ask", a
live preview of the number being affected, or the remaining sub-steps. On a
rate-lock flow that space is where reassurance reduces abandonment.

---

## 7. The document vault — biggest single opportunity

Better's is a flat seven-row table and it is markedly worse than everything else
they ship. One of Homiquity's three homepage promises is, word for word:
**"Organization — Documents, decisions, and progress — all in one place."**

What good looks like, and what `<DocumentList>` implements:

- Human titles from a `slug → label` map, with a title-cased fallback so a new
  server-side type degrades gracefully instead of breaking the page
- Grouping by phase (Application · Disclosures · Closing) or direction
- Provenance and status chips reusing the §4.8 vocabulary: *From us · You
  uploaded · Needs your signature · Verified · Processing*
- **Subject disambiguation** for same-type documents: "Pre-Approval Letter —
  1408 W Belmont Ave" vs "— Borrower copy"
- File type, page count, size; real download filenames
  (`homiquity-preapproval-2026-08-18.pdf`)
- Search and sort once the list can exceed ~15 rows
- Plain-language dates: "Sent to you on Aug 18, 2026", never "disclosed at"
- An empty state explaining what will appear here and when

---

## 8. The architectural rule that matters most

Two independent state-consistency defects were found in a single session (§6.1
and §6.2). Different components, different screens, same root cause: **loan
progress is derived ad-hoc at each render site instead of from one selector.**
One bug is bad luck; two is architecture.

Do this before building more surfaces that have to agree with each other:

```ts
// One selector. The badge, every progress display, every empty state,
// and the AI Coach all read from it.
export const selectOutstanding = (loan: Loan) => ({
  actionableNow: loan.tasks.filter(t => t.status === "open" && !t.blockedBy.length),
  upcoming:      loan.tasks.filter(t => t.status === "open" &&  t.blockedBy.length),
})
```

- **The badge counts actionable-now.** If you also want the total, label it
  ("5 upcoming"). A badge the user can never zero out is a badge they learn to
  ignore.
- **Empty-state copy is scoped to what the component knows.** `<EmptyState>`
  makes `scope` a required prop and derives the heading from it, so a component
  that only knows about one flow physically cannot claim "you're all caught up."
- **Every progress tier states its own altitude** in its label — "Loan progress"
  / "Rate lock progress" / "Step 2 of 5". Better runs three (soon four)
  simultaneous progress displays; layering is fine, silent disagreement is not.
- **Ship a CI test** that asks the Coach "what do I need to do?" on every route
  and diffs the answer against the rendered UI. Any divergence is a bug in the
  UI, not the Coach. Treat the Coach as a consistency oracle — if it reads the
  same state your UI renders, it will surface every place your UI lies, which is
  free QA rather than a liability.

---

## 9. Component library — API reference

Thirteen components in `components/`, written against the existing shadcn/ui +
Tailwind setup. No new dependencies beyond `class-variance-authority`. Full usage
docs in `components/README.md`; live rendering in
`homiquity-components-preview.html`.

| Component | Purpose | Priority |
|---|---|---|
| `<LoanTracker>` | Whole road visible, one step lit. Statuses: `done` / `current` / `future` / `blocked` | P1 |
| `<StickyFormBar>` + `<SupportPill>` | Support left, Submit right, pinned; iOS safe-area padding; reserves space for the Coach launcher | P1 |
| `<EntityCard>` + `<EntityCollection>` | Three-state repeating entity; saved summary keeps questions beside answers | P1 |
| `<SummarySection>` + `<UnderwritingRule>` | Application-summary block. **`source` and `whyWeAsk` are required props** | P1 |
| `<ProvenanceBadge>` | `self-reported` / `soft-check` / `verified` / `estimated`, with consistent labels and hover explanations held in one place | P1 |
| `<DeclarationsGroup>` + `URLA_DECLARATIONS` | Bulk-answer escape hatch; master checkbox derived, never stored | P1 |
| `<TaskProgress>` + `useTaskProgress` | Counter that can show progress; total frozen on first render, dev warning if it changes | P1 |
| `<ConsentField>` | Positive opt-in only; `defaultChecked` unsupported; dev warning on negative labels | P1 |
| `<EmptyState>` + `<ContactCard>` | `scope` required, heading derived from it; phone as a full-width primary button | P2 |
| `<DualUnitTable>` | Annual + monthly columns, nested rows, subtotals, per-group rule notes, `—` for N/A | P2 |
| `<DocumentList>` + `DOCUMENT_TITLES` | Grouped vault with provenance, status, subject disambiguation, metadata, search | P2 |
| `<MilestoneBar>` | Macro journey tier; `label` required and used as the accessible name | P2 |
| `<OptionalUpload>` | Optional-file ask with `reassurance` and `tips` slots | P3 |

### Design decisions encoded as types

These are deliberate and should survive refactors:

- `SummarySection` requires `source` and `whyWeAsk` → a financial figure cannot
  render without declaring its origin, and an intrusive request cannot ship
  unexplained. Moves "we should explain this" from code review to a compile error.
- `EmptyState` requires `scope` and derives the heading from it → §6.1 becomes
  structurally impossible.
- `TaskProgress` freezes `total` and warns on change → §6.2 becomes loud instead
  of silent.
- `ConsentField` has no `defaultChecked` and warns on negative labels → §6.3
  becomes unavailable.
- `DeclarationsGroup` derives its master checkbox → two controls describing one
  state can't drift apart.
- `MilestoneBar` requires `label` → every progress tier says what it measures.

---

## 10. Recommended build order

1. **Fix the two 404-ing images.** Nothing else matters while the hero is blank.
2. **One selector for "what's outstanding"** (§8) — before more surfaces exist.
3. **`<LoanTracker>`** on the post-application dashboard, reusing the homepage
   "How it works" labels.
4. **`<StickyFormBar>`** on every multi-field flow.
5. **`<DeclarationsGroup>`** — the moment a borrower feels the clarity promise.
6. **Application Summary** with `<SummarySection>` + `<ProvenanceBadge>` +
   `<DualUnitTable>` — the screen to demo.
7. **`<DocumentList>`** — a homepage promise you can win outright, in about a week.
8. **Page-aware AI Coach opener**, with the contact escape hatch above the first
   message.
9. **Resolve the AI positioning** into the single sentence in §1.
10. **Fix the nested anchor/button and the CTA flash.**
11. **Two form paradigms, one chrome** — and fill the empty half of wizard screens.
12. **Make the veterans path flagship.** You're veteran-founded, you ship four
    unused `--veteran-*` tokens, and the persona is already on the homepage.
    Build the VA path end-to-end — eligibility, entitlement, funding fee, COE
    guidance — and let it carry the brand colours. It's the one lane where you
    can be unambiguously better than a lender with 600k customers.
13. **CI test: Coach vs UI consistency** on every route.

---

## 12. Competitive stance — "like Better, but better"

Better is the bar, and on **execution** that's exactly the right call: their
funnel sequencing, loan tracker, form paradigms, disclosure handling and sticky
action bar are tested against 600,000 customers. Copy them outright.

The distinction that matters is between their mechanics and their positioning.

**Do not chase:** $110B funded · 600k customers · five affiliated companies ·
a One Day Mortgage guarantee backed by underwriting capacity · an AI marketed as
the decision-maker. Those are underwritten by capital and volume, not design.
Competing there is competing against their strength.

**The asymmetry to exploit:** Better's product has two personalities. The screens
someone cared about — the application summary, the declarations shortcut, the
loan tracker — are genuinely excellent. The screens nobody owned are careless in
ways a 600k-customer company can absorb and a challenger cannot:

- a document vault that shows raw database slugs as user-facing labels
- a task counter that is structurally incapable of showing progress
- a consent checkbox with a double negative and a penalty attached to declining
- a UI that its own AI assistant contradicted, correctly

**None of those are capital problems.** They are attention problems, and
attention is the thing a small team actually has more of. That gap is the
product strategy.

### Scorecard — 14 surfaces

| Verdict | Count | Surfaces |
|---|---|---|
| **Gap** — behind | 2 | Hero (static + 404ing image) · Scale & breadth (don't chase) |
| **Parity** — match and move on | 4 | Sign-in · Loan dashboard · Long-form collection · Declarations |
| **Win** — can be clearly better | 6 | Stepped wizard · Progress display · Application summary · Document vault · AI assistant · Veterans/VA |
| **Ahead** — already | 2 | Hero reassurance row · Consent & on-device privacy |

### The four-question review gate

If all four hold on a screen, it is measurably better than Better's equivalent.
Put these in the PR template:

1. **Provenance** — can the user tell where every number came from?
2. **Explanation** — is every intrusive ask paired with what it's for and what
   you'll need next to verify it?
3. **Agreement** — could any two elements on this screen disagree about the same
   fact?
4. **Honesty** — is every choice framed in the positive, with no penalty attached
   to declining?

Three of the four are already enforced by the component library
(`SummarySection` requires `whyWeAsk`; `EmptyState` requires `scope`;
`ConsentField` refuses negative labels; `TaskProgress` warns on a moving total).
The library exists so that clearing the bar is the path of least resistance
rather than an act of discipline.

### One caution on sequencing

Better earned the right to a few careless screens by being unambiguously
complete. A challenger does not get that. **Parity on the spine comes before
differentiation** — a borrower who can't find their documents will never notice
how good your rule explanations are.

---

## 11. Confidence and provenance of this document

Everything in §2, §3, §4, §5, §6 and §7 was **directly observed** — either in a
live logged-in session or extracted from deployed DOM/CSS. Sections 8, 9 and 10
are interpretation and recommendation.

Two items are diagnoses rather than facts, and are labelled as such above: the
cause of the badge/panel mismatch (§6.1), and the `<Button asChild>` origin of
the nested anchor/button bug (§3.2). Both are consistent with everything
observed, but neither was confirmed against source.

No borrower PII is recorded anywhere in this document or its companions.
