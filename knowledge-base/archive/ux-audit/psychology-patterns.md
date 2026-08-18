> **⛔ ARCHIVED 2026-08-06 — the UX daily-loop routine is dead (last run 2026-07-16). Do not act on this document.** It lived under `logs/`, which the [KB index](../README.md) declares immutable ("never rewritten"), while its own README described a routine that rewrote these artifacts daily — a contradiction resolved by archiving. The successor register is [feature-review/FINDINGS.md](../../feature-review/FINDINGS.md), which this directory's own exec-summary already named. Design *values* are canonical in [handbook/design/DESIGN_SYSTEM.md](../../handbook/design/DESIGN_SYSTEM.md). Retained for history only.

# Psychology-Driven UX Patterns — with paste-ready copy

House copy style: plain language, second person, no exclamation marks in financial moments,
numbers over adjectives. **Regulatory copy (FCRA/ESIGN/LE/anti-steering) is out of bounds for
conversion rewording.**

## 1. Build trust early

**Progress + certainty (funnel intro)** — already live, keep:
> "We'll get you a verified pre-approval letter in about 3 minutes. No hard credit check."

**Make the autosave visible (currently 10px @ 50% opacity — too quiet):**
> "✓ Saved — you can leave and pick this up anytime."
Show for 1.5s at full contrast after each step advance, then decay to the quiet indicator.

**Transparency tokens (LoanOptions, shipped L5 — lean into it):**
> "Why this rate: 760 credit score −0.25 · 80% loan-to-value +0.125 · Base 6.875%"
Headline above the decomposition: **"No mystery pricing. Here's the math."**

**Social proof — do NOT fabricate.** Until real volume exists, use process proof instead:
> "Every pre-approval is reviewed against 40+ underwriting checks before we put our name on it."
(True: scenario registry + invariant tests.) Swap to real counts only when real.

## 2. Reduce cognitive load

**Chunking** — funnel already does one-question-per-screen. Apply the same to URLA 1003:
section intro screens with time estimates:
> "Next: employment history. About 4 minutes. You'll need your last two years of employers."

**Progressive disclosure** — complex-income block only appears when routed (already built).
Rule to preserve: *never show a field the current answers don't require.*

**Milestone grouping (Tasks, shipped #6):**
> "Upload your documents — 8 needed" — never "Complete 56 pending tasks."

## 3. Nudge toward completion

**Commitment device (EmailCaptureModal):**
> "See your full results. We'll email you a copy — no spam, one email."

**Resume nudge (dashboard, for stalled drafts):**
> "You're 70% through your pre-approval. About 1 minute left."
(Compute from `routeProgress` — the funnel machine already exposes `percent`.)

**Loss aversion — use honestly, only with real deadlines:**
> "Your rate lock expires in 3 days. After that, today's rate isn't guaranteed."
Never invent scarcity ("only 2 spots left") — it's a UDAAP risk in lending.

**Endowed progress:** the intro step counts toward the progress bar (index 0 of N), so users
start at >0%. Preserved by `routeProgress` — don't "fix" this.

## 4. Design for emotion and stress

**Verification wait (VerificationPulse):**
> "Checking your numbers against 40+ loan programs…"
> "This usually takes about 20 seconds. Nothing for you to do."

**Document upload (peak PII anxiety, UploadDocumentDialog):**
> "Encrypted in transit and at rest. Only your loan team can see this."
> After L4 match: "✓ W-2 received — this clears 1 of your 3 document requests."

**Adverse/error moments** — never blame, always give the next step:
> "We couldn't verify that automatically. A loan officer will review it within 1 business day —
> nothing else is needed from you right now."

**Human fallback (every underwriting/verification screen):**
> "Prefer to talk it through? [Message your loan team]" — one tap, no phone tree.

## 5. Accessibility and fairness

- Plain-language summary above every legal block: "**In plain terms:** checking this box lets us
  look at your credit without affecting your score."
- Reading level target: grade 8 for all non-legal copy (glossary tooltips via `TermTooltip` for
  unavoidable terms: APR, LTV, escrow, points).
- All progress/status conveyed by color must also be conveyed by text + icon (the 2-aria-label
  finding makes this urgent).
- HMDA demographics page: explain *why* we ask and that answering is optional, per Reg C:
  > "Federal law asks us to collect this to help ensure fair lending. You can select
  > 'I do not wish to provide this information.' Your answers never affect your loan decision."

## Anti-patterns to keep out (they show up in mortgage UIs)

1. Fake urgency / invented scarcity — UDAAP exposure.
2. Fake liveness — presence dots with no transport (Messages page, F9): remove until real.
3. Confetti/celebration on *conditional* approval — celebrate at clear-to-close, be calm before.
4. Dual scores that disagree (RenterHome today) — one number, one owner (server).
5. Dark-pattern consent (pre-checked boxes) — all consent checkboxes start unchecked, always.
